/**
 * Project Controller
 * ──────────────────
 * HTTP handlers for project CRUD + stats.
 */

const projectService = require("../services/projectService");
const memberService = require("../services/projectMemberService");
const orgService = require("../services/orgService");
const formFieldService = require("../services/formFieldService");

const createProject = async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const {
      type,
      name,
      template,
      memberLimit,
      expiryDays,
      formSchema,
      cardConfig,
    } = req.body;

    if (!type || !name) {
      return res.status(400).json({ error: "Type and name are required." });
    }
    if (!["service", "bulk"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Type must be 'service' or 'bulk'." });
    }

    const { data, error } = await projectService.createProject({
      orgId,
      type,
      name,
      template,
      memberLimit,
      expiryDays,
      formSchema,
      cardConfig,
    });

    if (error) return res.status(500).json({ error: error.message });

    // Seed system form fields (name, email, photo) for the new project
    await formFieldService.seedSystemFields(data.id, 1);

    // If formSchema was provided with custom fields, save them to form_fields table
    if (formSchema && Array.isArray(formSchema) && formSchema.length > 0) {
      await formFieldService.saveCustomFields(data.id, formSchema, false);
    }

    res.status(201).json({ project: data });
  } catch (err) {
    next(err);
  }
};

const listProjects = async (req, res, next) => {
  try {
    const orgId = req.orgId || req.params.orgId;
    const { data, error } = await projectService.getProjectsByOrg(orgId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ projects: data });
  } catch (err) {
    next(err);
  }
};

const getProject = async (req, res, next) => {
  try {
    const { data, error } = await projectService.getProjectById(
      req.params.projectId,
    );
    if (error || !data)
      return res.status(404).json({ error: "Project not found." });
    res.json({ project: data });
  } catch (err) {
    next(err);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const { data, error } = await projectService.updateProject(
      req.params.projectId,
      req.body,
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ project: data });
  } catch (err) {
    next(err);
  }
};

const getProjectStats = async (req, res, next) => {
  try {
    const stats = await projectService.getProjectStats(req.params.projectId);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/projects/:projectId/public — Public project info for registration forms
 * Returns: project name, org name/logo, form_schema, status, member_limit
 * NO AUTH REQUIRED
 */
const getPublicProjectInfo = async (req, res, next) => {
  try {
    const { data: project, error } = await projectService.getProjectById(
      req.params.projectId,
    );
    if (error || !project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Check project is active
    if (project.status !== "active") {
      return res.status(410).json({
        error: "This project is no longer accepting registrations.",
        status: project.status,
      });
    }

    // Fetch org info for display
    let orgName = "";
    let orgLogo = "";
    let orgSlug = "";
    if (project.org_id) {
      const { data: org } = await orgService.getOrgById(project.org_id);
      if (org) {
        orgName = org.name || "";
        orgLogo = org.logo_url || "";
        orgSlug = org.slug || "";
      }
    }

    // Check capacity — only pending + approved count against the limit
    let spotsRemaining = null;
    if (project.member_limit) {
      const { data: existing } = await memberService.getMembersByProject(
        req.params.projectId,
      );
      const activeCount = (existing || []).filter(
        (m) => m.status === "pending" || m.status === "approved",
      ).length;
      spotsRemaining = Math.max(0, project.member_limit - activeCount);
    }

    // Fetch form fields from the dedicated table (falls back to form_schema JSONB)
    let formFields = [];
    const { fields: ffData } = await formFieldService.getPublicFormFields(req.params.projectId);
    if (ffData && ffData.length > 0) {
      formFields = ffData;
    } else {
      // Fallback to legacy form_schema
      formFields = (project.form_schema || []).map((f, i) => ({
        field_key: f.field_key || f.label?.toLowerCase().replace(/[^a-z0-9]+/g, "_") || `field_${i}`,
        label: f.label,
        type: f.type || "text",
        required: f.required || false,
        placeholder: f.placeholder || "",
        description: f.description || "",
        options: f.options || [],
        default_value: f.default_value || "",
        is_system: false,
        validation_rules: f.validation_rules || {},
      }));
    }

    res.json({
      project: {
        id: project.id,
        name: project.name,
        type: project.type,
        template: project.template,
        form_schema: project.form_schema || [],
        form_fields: formFields,
        card_config: project.card_config || {},
        member_limit: project.member_limit,
        spots_remaining: spotsRemaining,
        status: project.status,
      },
      organization: {
        name: orgName,
        logo_url: orgLogo,
        slug: orgSlug,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/projects/:projectId/export-csv — Export project members as CSV
 * Requires auth + org membership
 */
const exportMembersCsv = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status: filterStatus } = req.query;

    const { data: project, error: pErr } =
      await projectService.getProjectById(projectId);
    if (pErr || !project) {
      return res.status(404).json({ error: "Project not found." });
    }

    const { data: members, error: mErr } =
      await memberService.getMembersByProject(projectId, filterStatus || null);
    if (mErr) return res.status(500).json({ error: mErr.message });

    if (!members || members.length === 0) {
      return res.status(200).send("No members found.");
    }

    // Collect all custom_fields keys across members
    const customKeys = new Set();
    members.forEach((m) => {
      if (m.custom_fields && typeof m.custom_fields === "object") {
        Object.keys(m.custom_fields).forEach((k) => customKeys.add(k));
      }
    });
    const sortedCustomKeys = [...customKeys].sort();

    // Build CSV header
    const baseHeaders = [
      "id",
      "name",
      "email",
      "photo_url",
      "status",
      "created_at",
    ];
    const allHeaders = [...baseHeaders, ...sortedCustomKeys];
    const csvRows = [allHeaders.join(",")];

    // CSV-safe helper — wraps in quotes and escapes inner quotes
    const csvSafe = (val) => {
      const str = String(val ?? "");
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV rows
    members.forEach((m) => {
      const row = [
        csvSafe(m.id),
        csvSafe(m.name),
        csvSafe(m.email),
        csvSafe(m.photo_url),
        csvSafe(m.status),
        csvSafe(m.created_at),
      ];
      sortedCustomKeys.forEach((key) => {
        row.push(csvSafe(m.custom_fields?.[key]));
      });
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_members.csv"`,
    );
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  getProjectStats,
  getPublicProjectInfo,
  exportMembersCsv,
};
