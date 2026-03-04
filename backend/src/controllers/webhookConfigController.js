/**
 * Webhook Config Controller
 * ═════════════════════════
 *
 * CRUD operations for webhook configurations.
 * All endpoints require JWT authentication.
 *
 * Endpoints:
 *   POST   /api/webhook-config          → Create a new webhook
 *   GET    /api/webhook-config           → List user's webhooks
 *   GET    /api/webhook-config/:id       → Get single webhook
 *   PUT    /api/webhook-config/:id       → Update webhook
 *   DELETE /api/webhook-config/:id       → Delete webhook
 *   POST   /api/webhook-config/:id/regenerate-secret → Regenerate secret
 */

const {
  createWebhookConfig,
  getWebhookConfigsByUser,
  getWebhookConfigById,
  updateWebhookConfig,
  deleteWebhookConfig,
  regenerateSecret,
} = require("../services/webhookService");

/**
 * POST /api/webhook-config
 * Create a new webhook configuration.
 */
const create = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data, error } = await createWebhookConfig(userId, req.body);

    if (error) {
      console.error("[webhookConfig.create] Error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to create webhook configuration.",
      });
    }

    return res.status(201).json({
      message: "Webhook configuration created.",
      webhook: data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/webhook-config
 * List all webhook configs for the authenticated user.
 */
const list = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data, error } = await getWebhookConfigsByUser(userId);

    if (error) {
      console.error("[webhookConfig.list] Error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to fetch webhook configurations.",
      });
    }

    return res.status(200).json({
      webhooks: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/webhook-config/:id
 * Get a single webhook config.
 */
const getOne = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await getWebhookConfigById(id);

    if (error || !data) {
      return res.status(404).json({
        error: "Not Found",
        message: "Webhook configuration not found.",
      });
    }

    // Ownership check
    if (data.user_id !== userId) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You do not own this webhook configuration.",
      });
    }

    return res.status(200).json({ webhook: data });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/webhook-config/:id
 * Update a webhook config.
 */
const update = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await updateWebhookConfig(id, userId, req.body);

    if (error) {
      console.error("[webhookConfig.update] Error:", error.message);
      return res.status(error.code === "PGRST116" ? 404 : 500).json({
        error: error.code === "PGRST116" ? "Not Found" : "Database Error",
        message:
          error.code === "PGRST116"
            ? "Webhook configuration not found or not owned by you."
            : "Failed to update webhook configuration.",
      });
    }

    return res.status(200).json({
      message: "Webhook configuration updated.",
      webhook: data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/webhook-config/:id
 * Delete a webhook config.
 */
const remove = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await deleteWebhookConfig(id, userId);

    if (error) {
      console.error("[webhookConfig.remove] Error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to delete webhook configuration.",
      });
    }

    return res.status(200).json({
      message: "Webhook configuration deleted.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/webhook-config/:id/regenerate-secret
 * Generate a new secret key for the webhook.
 */
const rotateSecret = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await regenerateSecret(id, userId);

    if (error) {
      console.error("[webhookConfig.rotateSecret] Error:", error.message);
      return res.status(500).json({
        error: "Database Error",
        message: "Failed to regenerate webhook secret.",
      });
    }

    return res.status(200).json({
      message: "Webhook secret regenerated.",
      webhook: data,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, list, getOne, update, remove, rotateSecret };
