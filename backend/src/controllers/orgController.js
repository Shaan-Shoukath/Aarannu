/**
 * Organization Controller
 * ───────────────────────
 * Handles HTTP concerns for organization endpoints.
 * Delegates all DB logic to orgService.
 */

const orgService = require("../services/orgService");

/**
 * POST /api/org — Create a new organization
 */
const createOrg = async (req, res, next) => {
  try {
    const { name, slug } = req.body;
    const userId = req.user.id;

    if (!name || !slug) {
      return res.status(400).json({ error: "Name and slug are required." });
    }

    // Validate slug format
    const cleanSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (cleanSlug.length < 3) {
      return res
        .status(400)
        .json({ error: "Slug must be at least 3 characters." });
    }

    // Check availability
    const available = await orgService.isSlugAvailable(cleanSlug);
    if (!available) {
      return res
        .status(409)
        .json({ error: "This slug is already taken. Try another." });
    }

    const { org, membership, error } = await orgService.createOrganization({
      name: name.trim(),
      slug: cleanSlug,
      logoUrl: req.body.logoUrl || "",
      userId,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ org, membership });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/org/my — List orgs the current user belongs to
 */
const getMyOrgs = async (req, res, next) => {
  try {
    const { data, error } = await orgService.getUserOrganizations(req.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ organizations: data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/org/slug/:slug — Get org by slug
 */
const getOrgBySlug = async (req, res, next) => {
  try {
    const { data, error } = await orgService.getOrgBySlug(req.params.slug);
    if (error || !data) {
      return res.status(404).json({ error: "Organization not found." });
    }

    // Check user is a member
    const { role } = await orgService.getUserOrgRole(data.id, req.user.id);
    if (!role) {
      return res
        .status(403)
        .json({ error: "You are not a member of this organization." });
    }

    res.json({ org: data, userRole: role });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/org/:id — Get org by ID
 */
const getOrgById = async (req, res, next) => {
  try {
    const { data, error } = await orgService.getOrgById(req.params.id);
    if (error || !data) {
      return res.status(404).json({ error: "Organization not found." });
    }

    const { role } = await orgService.getUserOrgRole(data.id, req.user.id);
    if (!role) {
      return res
        .status(403)
        .json({ error: "You are not a member of this organization." });
    }

    res.json({ org: data, userRole: role });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/org/:id — Update org (admin/owner only)
 */
const updateOrg = async (req, res, next) => {
  try {
    const { data, error } = await orgService.updateOrganization(
      req.params.id,
      req.body,
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ org: data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/org/:id/stats — Get org statistics (admin/owner only)
 */
const getOrgStats = async (req, res, next) => {
  try {
    const stats = await orgService.getOrgStats(req.params.id);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/org/:id/members — List org members (admin/owner only)
 */
const getOrgMembersHandler = async (req, res, next) => {
  try {
    const { data, error } = await orgService.getOrgMembers(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ members: data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/org/check-slug/:slug — Public slug availability check
 */
const checkSlug = async (req, res, next) => {
  try {
    const available = await orgService.isSlugAvailable(req.params.slug);
    res.json({ available });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOrg,
  getMyOrgs,
  getOrgBySlug,
  getOrgById,
  updateOrg,
  getOrgStats,
  getOrgMembersHandler,
  checkSlug,
};
