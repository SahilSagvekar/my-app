import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import * as relations from "./relations";

// The HTTP client is safe to reuse across Cloudflare Worker requests. A Neon
// WebSocket Pool must instead be created and closed inside every request.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, {
  schema: { ...schema, ...relations },
});
