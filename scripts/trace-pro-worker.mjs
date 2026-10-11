import { parentPort } from "node:worker_threads";
import { generateIcon } from "./trace-pro-icon.mjs";
parentPort.on("message", async (entry) => {
  try {
    parentPort.postMessage({ result: await generateIcon(entry) });
  } catch (error) {
    parentPort.postMessage({ failure: { id: entry.id, error: String(error) } });
  }
});
