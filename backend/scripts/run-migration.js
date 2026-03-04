#!/usr/bin/env node
/**
 * run-migration.js
 * ────────────────
 * Executes a SQL migration file against your Supabase Postgres database.
 *
 * Prerequisites:
 *   Add DATABASE_URL to backend/.env (find it in Supabase Dashboard →
 *   Settings → Database → Connection string → URI).
 *
 * Usage:
 *   node scripts/run-migration.js 003_token_system.sql
 *   node scripts/run-migration.js --list        # list available
 *   node scripts/run-migration.js 3             # by index number
 *   node scripts/run-migration.js --print 003   # just print SQL
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

// ── Helpers ──────────────────────────────────────────────────
function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function resolveMigration(arg) {
  const migrations = listMigrations();
  if (/^\d+$/.test(arg)) {
    return migrations[parseInt(arg, 10) - 1];
  }
  return migrations.find((f) => f.includes(arg));
}

function printMigrationAndExit(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, "utf-8");
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  MIGRATION: ${filename.padEnd(44)}║
╚════════════════════════════════════════════════════════════╝

Copy this SQL into Supabase Dashboard → SQL Editor → Run:

───────────────────── SQL START ─────────────────────────────
`);
  console.log(sql);
  console.log(
    `───────────────────── SQL END ───────────────────────────────\n`,
  );
  process.exit(0);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // --list
  if (!args.length || args[0] === "--list") {
    const files = listMigrations();
    console.log("\n📁  Available migrations:\n");
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log(`\nUsage: node scripts/run-migration.js <filename or number>`);
    console.log(
      `       node scripts/run-migration.js --print 003  (just print SQL)\n`,
    );
    process.exit(0);
  }

  // --print <name>
  if (args[0] === "--print") {
    const target = resolveMigration(args[1] || "");
    if (!target) {
      console.error("❌  Migration not found");
      process.exit(1);
    }
    printMigrationAndExit(target);
  }

  // Resolve target file
  const target = resolveMigration(args[0]);
  if (!target) {
    console.error(`❌  No migration matching "${args[0]}".`);
    console.error(`Available: ${listMigrations().join(", ")}`);
    process.exit(1);
  }

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error(`
❌  DATABASE_URL not set in .env

   Find it in: Supabase Dashboard → Settings → Database → Connection string (URI)
   It looks like:
     postgresql://postgres.[ref]:[password]@aws-0-xxx.pooler.supabase.com:6543/postgres

   Add this line to backend/.env:
     DATABASE_URL=<your-connection-string>

   Or use --print to just display the SQL:
     node scripts/run-migration.js --print ${target}
`);
    process.exit(1);
  }

  // Read SQL
  const sqlPath = path.join(MIGRATIONS_DIR, target);
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log(`\n🚀  Running migration: ${target}\n`);

  // Connect and execute
  const { Client } = require("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log(`✅  Migration "${target}" applied successfully!\n`);
  } catch (err) {
    console.error(`❌  Migration failed:\n`);
    console.error(err.message);
    if (err.detail) console.error("Detail:", err.detail);
    if (err.hint) console.error("Hint:", err.hint);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
