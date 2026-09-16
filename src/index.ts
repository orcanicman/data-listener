import { createServer } from "node:http";
import { appendFile, access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";

type Vector3 = { x: number; y: number; z: number };

type MPU5600Data = {
  acc: Vector3;
  gyro: Vector3;
};

const CSV_FILE = "output.csv";
const CSV_HEADER = "timestamp,acc_x,acc_y,acc_z,gyro_x,gyro_y,gyro_z\n";

/**
 * Ensure CSV file exists and has headers before taking writes
 */
async function initCsvFile(): Promise<void> {
  try {
    await access(CSV_FILE, constants.F_OK);
  } catch {
    await writeFile(CSV_FILE, CSV_HEADER, "utf8");
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "text/plain" });
    response.end("Method Not Allowed");
    return;
  }

  try {
    // Collect the request stream chunks
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }

    const bodyText = Buffer.concat(chunks).toString("utf8");
    const data: MPU5600Data = JSON.parse(bodyText);

    // Format as CSV: timestamp, acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z
    const timestamp = Date.now();
    const row = `${timestamp},${data.acc.x},${data.acc.y},${data.acc.z},${data.gyro.x},${data.gyro.y},${data.gyro.z}\n`;

    console.log(`
      ------------------
      [${timestamp}] \n
      ACC: {x: ${data.acc.x}, y: ${data.acc.y}, z: ${data.acc.z} \n
      GYR: {x: ${data.gyro.x}, y: ${data.gyro.y}, z: ${data.gyro.z} \n
      ------------------
      `);

    // Append to file asynchronously
    await appendFile(CSV_FILE, row, "utf8");

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  } catch (err) {
    console.error("Failed to process request:", err);
    response.writeHead(400, { "Content-Type": "text/plain" });
    response.end("Invalid JSON or write error");
  }
});

await initCsvFile();
server.listen(6767, () => {
  console.log("Listening on http://localhost:6767");
});
