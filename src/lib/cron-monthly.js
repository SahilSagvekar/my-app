import fetch from "node-fetch";

async function runCron() {
  try {
    console.log("[CRON] Running monthly cron job...");

    const res = await fetch(process.env.BASE_URL + "/api/cron/monthly");
    const data = await res.json();

    console.log("[CRON RESULT]:", data);
  } catch (err) {
    console.error("[CRON ERROR]:", err);
  }
}

runCron();
