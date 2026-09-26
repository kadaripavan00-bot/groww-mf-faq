import { Client } from "@neondatabase/serverless";

const c = new Client(process.env.NEON_URL);
await c.connect();
const r = await c.query(process.argv[2] || "SELECT extname FROM pg_extension");
console.log(JSON.stringify(r.rows));
await c.end();
