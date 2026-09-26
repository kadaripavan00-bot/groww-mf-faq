// Apply migration + seeds to Neon. Connection via NEON_URL env (never committed).
// Run: $env:NEON_URL="<connection-string>"; node scripts/apply_neon.mjs
import { readFileSync } from "node:fs";
import { Client } from "@neondatabase/serverless";

const url = process.env.NEON_URL;
if (!url) {
  console.error("NEON_URL env required");
  process.exit(1);
}
const client = new Client(url);
await client.connect();

function splitStatements(text) {
  const code = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  return code
    .split(/;\s*\n/)
    .map((s) => s.trim().replace(/;$/, ""))
    .filter((s) => s && s !== "BEGIN" && s !== "COMMIT");
}

const files = ["db/migrations/001_init.sql", "db/seeds/seed.sql"];
let done = 0;
for (const f of files) {
  const stmts = splitStatements(readFileSync(f, "utf-8"));
  console.log(f, "statements:", stmts.length);
  for (const s of stmts) {
    await client.query(s);
    if (++done % 500 === 0) console.log("  applied", done);
  }
}
console.log("APPLIED", done, "statements");
const counts = await client.query(
  "SELECT (SELECT COUNT(*) FROM schemes) AS schemes, (SELECT COUNT(*) FROM sources) AS sources, (SELECT COUNT(*) FROM facts) AS facts, (SELECT COUNT(*) FROM fund_directory) AS directory"
);
console.log("COUNTS:", JSON.stringify(counts.rows[0]));
await client.end();
