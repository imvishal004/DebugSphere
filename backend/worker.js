require("dotenv").config();
const { Worker } = require("bullmq");
const connectDB = require("./src/config/database");
const { getRedisConnection } = require("./src/config/redis");
const Execution = require("./src/models/Execution");
const { executeInDocker } = require("./src/services/dockerManager");

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
        // Mark as running
        await Execution.findByIdAndUpdate(executionId, { status: "running" });

        // Execute code inside Docker
        const result = await executeInDocker(language, code, input);

        // Persist result
        await Execution.findByIdAndUpdate(executionId, {
          status: result.timedOut ? "timeout" : result.exitCode === 0 ? "completed" : "failed",
          output: result.stdout,
          error: result.stderr,
          runtime: result.executionTime,
          exitCode: result.exitCode,
          completedAt: new Date(),
        });

        console.log(`✅  Job ${job.id} finished in ${result.executionTime}ms`);
      } catch (err) {
        console.error(`❌  Job ${job.id} crashed:`, err.message);
        await Execution.findByIdAndUpdate(executionId, {
          status: "failed",
          error: err.message,
          completedAt: new Date(),
        });
      }
    },
    {
      connection,
      concurrency: 5,
      limiter: { max: 10, duration: 1000 },
    }
  );

  worker.on("completed", (job) => console.log(`🏁  Job ${job.id} completed`));
  worker.on("failed", (job, err) =>
    console.error(`💥  Job ${job?.id} failed:`, err.message)
  );

  console.log("🔄  Worker listening for jobs …");
}

startWorker().catch(console.error);