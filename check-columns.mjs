import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name ILIKE '%otp%' ORDER BY column_name`);
console.log("Columns:", result.rows.map(r => r.column_name));
await pool.end();
