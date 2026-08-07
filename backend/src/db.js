import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://promptlib:promptlib@db:5432/promptlib",
  max: 5,
});

export async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await pool.query(sql);
      console.log("[db] schema ready");
      return;
    } catch (err) {
      console.log(`[db] migrate attempt ${attempt} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Could not run migrations");
}
