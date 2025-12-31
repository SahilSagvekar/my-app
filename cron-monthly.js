import fetch from "node-fetch";

async function runCron() {
  try {
    console.log("[CRON] Running monthly cron job...");

    // const res = await fetch("http://localhost:3000/api/cron/monthly");
    const res = await fetch("https://e8productions.com/api/cron/monthly");
    const data = await res.json();

    console.log("[CRON RESULT]:", data);
  } catch (err) {
    console.error("[CRON ERROR]:", err);
  }

  process.exit(0);
}

runCron();
