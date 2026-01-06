import fetch from "node-fetch";

async function runCron() {
  try {
    console.log("[CRON] Running recurring tasks generation...");

    // const res = await fetch("http://localhost:3000/api/tasks/recurring/run", {
    const res = await fetch("https://e8productions.com/api/tasks/recurring/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();

    console.log("[CRON RESULT]:", data);
  } catch (err) {
    console.error("[CRON ERROR]:", err);
  }

  process.exit(0);
}

runCron();
