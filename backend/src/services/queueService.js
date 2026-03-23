const { Queue } = require("bullmq");
const { getRedisConnection } = require("../config/redis");

const QUEUE_NAME = "code-execution";

let queue = null;

function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
    console.log("📨  BullMQ queue ready");
  }
  return queue;
}

async function addExecutionJob(data) {
  const q = getQueue();
  const job = await q.add("execute", data, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 1,
  });
  return job;
}

module.exports = { addExecutionJob };