import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";
import * as relations from "./relations";

const fullSchema = { ...schema, ...relations };

// Use for the vast majority of routes — simple reads/writes, no interactive
// transaction needed. Stateless HTTP, no connection to close. This avoids the
// "Network connection lost" errors the WebSocket-based Pool was throwing on
// nearly every route under Cloudflare Workers' one-request-per-invocation model.
export function getDbHttp() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzleHttp(sql, { schema: fullSchema });
}

// Use ONLY for routes that call db.transaction(...) — Stripe/billing/payroll
// code that needs real multi-statement interactive transactions, which the
// HTTP driver cannot do.
export function getDbPool() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzlePool(pool, { schema: fullSchema });
  return { db, closeDb: () => pool.end() };
}
