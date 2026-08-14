import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query('SELECT COUNT(*) FROM "Task"');
console.log("Task count:", result.rows[0].count);
await pool.end();
