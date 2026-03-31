require("dotenv").config();
const { Worker } = require("bullmq");
const connectDB = require("./src/config/database");
const { getRedisConnection } = require("./src/config/redis");
const Execution = require("./src/models/Execution");
const { analyzeError } = require("./src/services/aiService");

// ✅ Only this line changed — dockerManager → isolatedExecutor
const { executeInDocker } = require("./src/services/isolatedExecutor");

const QUEUE_NAME = "code-execution";

async function startWorker() {
  await connectDB();
  const connection = getRedisConnection();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { executionId, language, code, input } = job.data;
      console.log(`⚙️  Processing job ${job.id} | execution ${executionId}`);

      try {
        // ── Step 1: Mark as running ───────────────────────────
        await Execution.findByIdAndUpdate(executionId, { status: "running" });

        // ── Step 2: Execute code inside isolated process ──────
        const result = await executeInDocker(language, code, input);

        // ── Step 3: Determine final status ───────────────────
        let finalStatus;
        if (result.timedOut)            finalStatus = "timeout";
        else if (result.exitCode === 0) finalStatus = "completed";
        else                            finalStatus = "failed";

        // ── Step 4: Build base update payload ─────────────────
        const updatePayload = {
          status:      finalStatus,
          output:      result.stdout,
          error:       result.stderr,
          runtime:     result.executionTime,
          exitCode:    result.exitCode,
          completedAt: new Date(),
        };

        // ── Step 5: AI analysis (only on user code failures) ──
        //
        // Trigger conditions (ALL must be true):
        //   A. finalStatus === "failed"
        //      → excludes "timeout" (no error to analyze)
        //      → excludes "completed" (no error occurred)
        //
        //   B. !result.timedOut
        //      → redundant with A but explicit for clarity
        //
        //   C. result.stderr has content OR exitCode is non-zero
        //      → catches cases where stderr is empty but code crashed
        //
        // We do NOT trigger AI for:
        //   • Timeout: "your code timed out" is self-explanatory
        //   • Infrastructure errors: caught in the catch block below
        //   • Successful runs: nothing to debug

        const shouldAnalyze =
          finalStatus === "failed" &&
          !result.timedOut &&
          (result.stderr || result.exitCode !== 0);

        if (shouldAnalyze) {
          console.log(
            `🤖  Triggering AI analysis for execution ${executionId}`
          );

          const aiResult = await analyzeError({
            language,
            code,
            error:    result.stderr,
            exitCode: result.exitCode,
          });

          // Build aiDebug payload regardless of AI success/failure
          // If AI failed, we store the error reason so the frontend
          // can show a graceful message instead of empty space
          updatePayload.aiDebug = {
            triggered:   true,
            explanation: aiResult.explanation,
            suggestion:  aiResult.suggestion,
            model:       aiResult.model,
            tokensUsed:  aiResult.tokensUsed,
            analyzedAt:  new Date(),
            aiError:     aiResult.error,
          };

          if (aiResult.success) {
            console.log(
              `✅  AI analysis complete for ${executionId} ` +
              `(${aiResult.tokensUsed} tokens, model: ${aiResult.model})`
            );
          } else {
            console.warn(
              `⚠️  AI analysis failed for ${executionId}: ${aiResult.error}`
            );
          }
        }

        // ── Step 6: Persist everything in one DB write ────────
        // Single atomic update — execution result + AI data together
        // Prevents a race condition where frontend polls between
        // the execution write and the AI write
        await Execution.findByIdAndUpdate(executionId, updatePayload);

        console.log(
          `✅  Job ${job.id} finished in ${result.executionTime}ms`
        );

      } catch (err) {
        // Infrastructure-level failure (process crash, OOM, etc.)
        // Not a user code error — do NOT trigger AI analysis
        console.error(`❌  Job ${job.id} crashed:`, err.message);
        await Execution.findByIdAndUpdate(executionId, {
          status:      "failed",
          error:       err.message,
          completedAt: new Date(),
          // aiDebug intentionally omitted — not a code error
        });
      }
    },
    {
      connection,
      concurrency: 5,
      limiter: { max: 10, duration: 1000 },
    }
  );

  worker.on("completed", (job) =>
    console.log(`🏁  Job ${job.id} completed`)
  );
  worker.on("failed", (job, err) =>
    console.error(`💥  Job ${job?.id} failed:`, err.message)
  );

  console.log("🔄  Worker listening for jobs …");
}

startWorker().catch(console.error);