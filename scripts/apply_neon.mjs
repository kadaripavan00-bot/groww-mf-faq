// Apply migration + seeds to Neon. Connection via NEON_URL env (never committed).
// Run: $env:NEON_URL="<connection-string>"; node scripts/apply_neon.mjs
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.NEON_URL;
if (!url) {
  console.error("NEON_URL env required");
  process.exit(1);
}
const sql = neon(url);

function splitStatements(text) {
  return text
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--") && s !== "BEGIN" && s !== "COMMIT");
}

const files = ["db/migrations/001_init.sql", "db/seeds/seed.sql"];
let done = 0;
for (const f of files) {
  const stmts = splitStatements(readFileSync(f, "utf-8"));
  console.log(f, "statements:", stmts.length);
  for (const s of stmts) {
    await sql.query(s);
    if (++done % 500 === 0) console.log("  applied", done);
  }
}
console.log("APPLIED", done, "statements");
const counts = await sql.query(
  "SELECT (SELECT COUNT(*) FROM schemes) AS schemes, (SELECT COUNT(*) FROM sources) AS sources, (SELECT COUNT(*) FROM facts) AS facts, (SELECT COUNT(*) FROM fund_directory) AS directory"
);
console.log("COUNTS:", JSON.stringify(counts[0]));
