/**
 * Supabase Client Configuration
 * ─────────────────────────────
 * Creates two Supabase clients:
 *
 *  1. `supabase`        – uses the SERVICE_ROLE key.
 *     → Bypasses RLS.  Used for admin operations (approve users,
 *       list pending members, cleanup expired records).
 *     ⚠ NEVER expose this key to the frontend.
 *
 *  2. `supabasePublic`  – uses the ANON key.
 *     → Respects RLS.  Used when operating in the context of
 *       an authenticated user (after JWT verification).
 *
 * Both clients are singletons — imported wherever needed.
 */

const { createClient } = require("@supabase/supabase-js");

// ── Validate required env vars ───────────────────────────────
const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`❌  Missing environment variable: ${key}`);
    process.exit(1);
  }
}

// ── Service-role client (bypasses RLS) ───────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

// ── Anon / public client (respects RLS) ──────────────────────
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

module.exports = { supabase, supabasePublic };
