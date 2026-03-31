require("dotenv").config();
const { Worker }       = require("bullmq");
const connectDB        = require("./src/config/database");
const { getRedisConnection } = require("./src/config/redis");
const Execution        = require("./src/models/Execution");
const { analyzeError } = require("./src/services/aiService");
const { executeInDocker } = require("./src/services/isolatedExecutor");

const QUEUE_NAME = "code-execution";

// ── startWorker ────────────────────────────────────────────
// Exported so server.js can call it after boot.
// When running standalone (node worker.js), the bottom
// of this file calls startWorker() directly.
async function startWorker() {
  // connectDB is safe to call multiple times —
  // database.js guards against duplicate connections
  await connectDB();

  const connection = getRedisConnection();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { executionId, language, code, input } = job.data;
      console.log(`⚙️  Processing job ${job.id} | execution ${executionId}`);

      try {
        // ── Step 1: Mark as running ───────────────────────
        await Execution.findByIdAndUpdate(executionId, {
          status: "running",
        });

        // ── Step 2: Execute code ──────────────────────────
        const result = await executeInDocker(language, code, input);

        // ── Step 3: Determine final status ────────────────
        let finalStatus;
        if (result.timedOut)            finalStatus = "timeout";
        else if (result.exitCode === 0) finalStatus = "completed";
        else                            finalStatus = "failed";

        // ── Step 4: Build update payload ──────────────────
        const updatePayload = {
          status:      finalStatus,
          output:      result.stdout,
          error:       result.stderr,
          runtime:     result.executionTime,
          exitCode:    result.exitCode,
          completedAt: new Date(),
        };

        // ── Step 5: AI analysis on failure ────────────────
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
              `(${aiResult.tokensUsed} tokens)`
            );
          } else {
            console.warn(
              `⚠️  AI analysis failed for ${executionId}: ${aiResult.error}`
            );
          }
        }

        // ── Step 6: Persist result ────────────────────────
        await Execution.findByIdAndUpdate(executionId, updatePayload);

        console.log(
          `✅  Job ${job.id} finished in ${result.executionTime}ms`
        );

      } catch (err) {
        console.error(`❌  Job ${job.id} crashed:`, err.message);
        await Execution.findByIdAndUpdate(executionId, {
          status:      "failed",
          error:       err.message,
          completedAt: new Date(),
        });
      }
    },
    {
      connection,
      concurrency: 3,           // reduced from 5 — single instance now
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

  return worker;
}

module.exports = { startWorker };

// ── Standalone mode ────────────────────────────────────────
// Allows running: node worker.js directly for local dev.
// When imported by server.js, this block does NOT run.
if (require.main === module) {
  startWorker().catch((err) => {
    console.error("❌  Worker startup failed:", err.message);
    process.exit(1);
  });
}