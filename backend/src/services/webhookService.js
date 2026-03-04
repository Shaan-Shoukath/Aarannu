/**
 * Webhook Service
 * ───────────────
 * CRUD operations for `webhook_configs` table in Supabase.
 *
 * Schema:
 *   webhook_configs (
 *     id            UUID PK DEFAULT gen_random_uuid(),
 *     user_id       UUID FK→auth.users NOT NULL,
 *     name          TEXT NOT NULL,
 *     secret        TEXT NOT NULL,
 *     template      TEXT NOT NULL DEFAULT 'custom',
 *     org_name      TEXT DEFAULT '',
 *     logo_url      TEXT DEFAULT '',
 *     field_mapping JSONB DEFAULT '{}',
 *     card_styles   JSONB DEFAULT '{}',
 *     gradient_colors JSONB DEFAULT '{"start":"#1152d4","end":"#ef4444"}',
 *     field_visibility JSONB DEFAULT '{"dob":true,"gender":true,"blood_group":true,"role":true,"address":true}',
 *     orientation   TEXT DEFAULT 'horizontal',
 *     validity_text TEXT DEFAULT 'Valid for 1 year from issue',
 *     auto_email    BOOLEAN DEFAULT true,
 *     is_active     BOOLEAN DEFAULT true,
 *     created_at    TIMESTAMPTZ DEFAULT now(),
 *     updated_at    TIMESTAMPTZ DEFAULT now()
 *   )
 */

const { supabase } = require("../config/supabaseClient");
const crypto = require("crypto");

/**
 * Generate a secure random webhook secret (hex string).
 * @returns {string} 64-char hex secret
 */
const generateSecret = () => crypto.randomBytes(32).toString("hex");

/**
 * Create a new webhook config for a user.
 */
const createWebhookConfig = async (userId, config) => {
  const secret = generateSecret();

  const row = {
    user_id: userId,
    name: config.name || "My Webhook",
    secret,
    template: config.template || "custom",
    org_name: config.org_name || "",
    logo_url: config.logo_url || "",
    field_mapping: config.field_mapping || {},
    card_styles: config.card_styles || {},
    gradient_colors: config.gradient_colors || {
      start: "#1152d4",
      end: "#ef4444",
    },
    field_visibility: config.field_visibility || {
      dob: true,
      gender: true,
      blood_group: true,
      role: true,
      address: true,
    },
    orientation: config.orientation || "horizontal",
    validity_text: config.validity_text || "Valid for 1 year from issue",
    auto_email: config.auto_email !== false,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("webhook_configs")
    .insert(row)
    .select()
    .single();

  return { data, error };
};

/**
 * Get all webhook configs for a user.
 */
const getWebhookConfigsByUser = async (userId) => {
  return supabase
    .from("webhook_configs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
};

/**
 * Get a single webhook config by ID (no user filter — for webhook handler).
 */
const getWebhookConfigById = async (webhookId) => {
  return supabase
    .from("webhook_configs")
    .select("*")
    .eq("id", webhookId)
    .single();
};

/**
 * Update a webhook config (only the owner can update).
 */
const updateWebhookConfig = async (webhookId, userId, updates) => {
  // Strip fields that shouldn't be updated directly
  const { id, user_id, secret, created_at, ...safeUpdates } = updates;

  return supabase
    .from("webhook_configs")
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq("id", webhookId)
    .eq("user_id", userId)
    .select()
    .single();
};

/**
 * Delete a webhook config.
 */
const deleteWebhookConfig = async (webhookId, userId) => {
  return supabase
    .from("webhook_configs")
    .delete()
    .eq("id", webhookId)
    .eq("user_id", userId);
};

/**
 * Regenerate the secret for a webhook.
 */
const regenerateSecret = async (webhookId, userId) => {
  const newSecret = generateSecret();
  const { data, error } = await supabase
    .from("webhook_configs")
    .update({ secret: newSecret, updated_at: new Date().toISOString() })
    .eq("id", webhookId)
    .eq("user_id", userId)
    .select()
    .single();

  return { data, error };
};

/**
 * Verify the webhook secret matches.
 * Uses timing-safe comparison to prevent timing attacks.
 */
const verifyWebhookSecret = (provided, stored) => {
  if (!provided || !stored) return false;
  if (provided.length !== stored.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided, "utf8"),
      Buffer.from(stored, "utf8"),
    );
  } catch {
    return false;
  }
};

module.exports = {
  generateSecret,
  createWebhookConfig,
  getWebhookConfigsByUser,
  getWebhookConfigById,
  updateWebhookConfig,
  deleteWebhookConfig,
  regenerateSecret,
  verifyWebhookSecret,
};
