import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import BrandLogoLink from "../components/BrandLogoLink";
import {
  blobToBase64,
  buildDeliveryFileName,
  canResumeDelivery,
  canRetryDelivery,
  countDeliveryPhases,
  generateDeliveryPdf,
  getDeliveryMeta,
} from "../utils/projectMemberDelivery";

const BACKEND =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const sortMembersByCreatedAt = (members = []) =>
  [...members].sort(
    (left, right) =>
      new Date(right.created_at || 0).getTime() -
      new Date(left.created_at || 0).getTime(),
  );

const mergeMembersById = (previousMembers = [], incomingMembers = []) => {
  const nextMap = new Map(previousMembers.map((member) => [member.id, member]));

  for (const member of incomingMembers) {
    if (!member?.id) continue;
    nextMap.set(member.id, {
      ...(nextMap.get(member.id) || {}),
      ...member,
    });
  }

  return sortMembersByCreatedAt([...nextMap.values()]);
};

export default function ProjectDashboard() {
  const { slug, projectId } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewMode, setRenewMode] = useState("continue");
  const [renewing, setRenewing] = useState(false);
  const [deliveryQueue, setDeliveryQueue] = useState([]);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [activeDeliveryId, setActiveDeliveryId] = useState("");

  const membersRef = useRef([]);
  const deliveryQueueRef = useRef([]);
  const deliveryProcessingRef = useRef(false);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const updateQueue = useCallback((updater) => {
    const nextQueue =
      typeof updater === "function"
        ? updater(deliveryQueueRef.current)
        : updater;
    deliveryQueueRef.current = nextQueue;
    setDeliveryQueue(nextQueue);
  }, []);

  const mergeMembers = useCallback((incomingMembers = []) => {
    if (!Array.isArray(incomingMembers) || incomingMembers.length === 0) return;
    setMembers((previousMembers) =>
      mergeMembersById(previousMembers, incomingMembers),
    );
  }, []);

  const removeMemberFromQueue = useCallback(
    (memberId) => {
      updateQueue((previousQueue) =>
        previousQueue.filter((queuedId) => queuedId !== memberId),
      );
    },
    [updateQueue],
  );

  const enqueueMembers = useCallback(
    (nextMembers = []) => {
      const nextIds = nextMembers
        .map((member) => member?.id)
        .filter(Boolean);

      if (nextIds.length === 0) return;

      updateQueue((previousQueue) => {
        const mergedQueue = [...previousQueue];

        for (const memberId of nextIds) {
          if (!mergedQueue.includes(memberId)) {
            mergedQueue.push(memberId);
          }
        }

        return mergedQueue;
      });
    },
    [updateQueue],
  );

  const getAuthHeaders = useCallback(
    async (includeJson = false) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return null;
      }

      return includeJson
        ? {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          }
        : {
            Authorization: `Bearer ${session.access_token}`,
          };
    },
    [navigate],
  );

  const loadData = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);

      try {
        const headers = await getAuthHeaders();
        if (!headers) {
          setLoading(false);
          return;
        }

        const [orgRes, projectRes, statsRes, membersRes] = await Promise.all([
          fetch(`${BACKEND}/api/org/slug/${slug}`, { headers }),
          fetch(`${BACKEND}/api/projects/${projectId}`, { headers }),
          fetch(`${BACKEND}/api/projects/${projectId}/stats`, { headers }),
          fetch(`${BACKEND}/api/members/${projectId}`, { headers }),
        ]);

        const [orgJson, projectJson, statsJson, membersJson] = await Promise.all([
          orgRes.json().catch(() => ({})),
          projectRes.json().catch(() => ({})),
          statsRes.json().catch(() => ({})),
          membersRes.json().catch(() => ({})),
        ]);

        if (!projectRes.ok || !statsRes.ok || !membersRes.ok) {
          throw new Error(
            projectJson.error ||
              statsJson.error ||
              membersJson.error ||
              "Failed to load project data.",
          );
        }

        if (orgRes.ok) {
          setOrg(orgJson.org || null);
        }

        setProject(projectJson.project || null);
        setStats(statsJson.stats || null);
        setMembers(sortMembersByCreatedAt(membersJson.members || []));
      } catch (loadError) {
        setError(loadError.message || "Failed to load project data.");
      } finally {
        setLoading(false);
      }
    },
    [getAuthHeaders, projectId, slug],
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useEffect(() => {
    setSelected((previousSelected) => {
      const pendingIds = new Set(
        members
          .filter((member) => member.status === "pending")
          .map((member) => member.id),
      );
      return new Set(
        [...previousSelected].filter((memberId) => pendingIds.has(memberId)),
      );
    });
  }, [members]);

  useEffect(() => {
    if (!deliveryBusy) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue =
        "A delivery queue is still running. Leaving now may stop PDF generation in this tab.";
      return event.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [deliveryBusy]);

  const persistDeliveryStatus = useCallback(
    async (memberId, payload) => {
      const headers = await getAuthHeaders(true);
      if (!headers) return null;

      const response = await fetch(
        `${BACKEND}/api/members/${memberId}/delivery-status`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        },
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json.error || "Failed to update delivery status.");
      }

      if (json.member) {
        mergeMembers([json.member]);
      }

      return json.member || null;
    },
    [getAuthHeaders, mergeMembers],
  );

  const queueMemberForDelivery = useCallback(
    async (memberId) => {
      const headers = await getAuthHeaders();
      if (!headers) return { member: null, warning: "" };

      const response = await fetch(
        `${BACKEND}/api/members/${memberId}/queue-delivery`,
        {
          method: "POST",
          headers,
        },
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json.error || "Failed to queue card delivery.");
      }

      if (json.member) {
        mergeMembers([json.member]);
      }

      return {
        member: json.member || null,
        warning: json.warning || "",
      };
    },
    [getAuthHeaders, mergeMembers],
  );

  const sendCardEmail = useCallback(
    async (member, pdfBlob) => {
      const headers = await getAuthHeaders(true);
      if (!headers) return null;

      const memberIndex = Math.max(
        0,
        membersRef.current.findIndex((item) => item.id === member.id),
      );

      const response = await fetch(`${BACKEND}/api/email/send-card`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          recipientEmail: member.email.trim(),
          recipientName: member.name,
          pdfBase64: await blobToBase64(pdfBlob),
          fileName: buildDeliveryFileName(member, memberIndex),
          orgName: org?.name || slug,
          projectName: project?.name || "Project",
          memberId: member.id,
          cardId: member.delivery_card_id,
          verificationUrl: member.delivery_verification_url,
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (json.member) {
        mergeMembers([json.member]);
      }

      if (!response.ok) {
        const sendError = new Error(
          json.message || json.error || "Failed to send the delivery email.",
        );
        sendError.backendPersisted = Boolean(json.member);
        throw sendError;
      }

      return json;
    },
    [getAuthHeaders, mergeMembers, org?.name, project?.name, slug],
  );

  const deliverMember = useCallback(
    async (memberId) => {
      let member = membersRef.current.find((item) => item.id === memberId);
      if (!member || member.status !== "approved") return;

      if (!member.email?.trim()) {
        await persistDeliveryStatus(memberId, {
          phase: "skipped_no_email",
          error: "No email address is available for automatic delivery.",
        });
        return;
      }

      if (!member.delivery_card_id || !member.delivery_verification_url) {
        const preparation = await queueMemberForDelivery(memberId);
        member =
          preparation.member ||
          membersRef.current.find((item) => item.id === memberId);

        if (preparation.warning) {
          setSuccess(preparation.warning);
        }

        if (
          !member ||
          member.delivery_phase === "failed_prepare" ||
          member.delivery_phase === "skipped_no_email" ||
          !member.delivery_card_id
        ) {
          return;
        }
      }

      await persistDeliveryStatus(memberId, {
        phase: "generating_pdf",
        cardId: member.delivery_card_id,
        verificationUrl: member.delivery_verification_url,
        clearError: true,
      });

      let pdfBlob;

      try {
        pdfBlob = await generateDeliveryPdf({
          member,
          project,
          org,
        });
      } catch (generationError) {
        await persistDeliveryStatus(memberId, {
          phase: "failed_generate",
          error:
            generationError.message || "Client-side PDF generation failed.",
          cardId: member.delivery_card_id,
          verificationUrl: member.delivery_verification_url,
        });
        return;
      }

      await persistDeliveryStatus(memberId, {
        phase: "pdf_ready",
        clearError: true,
        cardId: member.delivery_card_id,
        verificationUrl: member.delivery_verification_url,
        pdfGeneratedAt: new Date().toISOString(),
      });

      await persistDeliveryStatus(memberId, {
        phase: "sending_email",
        clearError: true,
        incrementAttempt: true,
        cardId: member.delivery_card_id,
        verificationUrl: member.delivery_verification_url,
      });

      try {
        await sendCardEmail(member, pdfBlob);
      } catch (sendError) {
        if (!sendError.backendPersisted) {
          await persistDeliveryStatus(memberId, {
            phase: "failed_send",
            error: sendError.message || "Email delivery failed.",
            cardId: member.delivery_card_id,
            verificationUrl: member.delivery_verification_url,
          });
        }
      }
    },
    [
      org,
      persistDeliveryStatus,
      project,
      queueMemberForDelivery,
      sendCardEmail,
    ],
  );

  const runDeliveryQueue = useCallback(async () => {
    if (deliveryProcessingRef.current || !project) return;

    deliveryProcessingRef.current = true;
    setDeliveryBusy(true);

    try {
      while (deliveryQueueRef.current.length > 0) {
        const memberId = deliveryQueueRef.current[0];
        setActiveDeliveryId(memberId);
        try {
          await deliverMember(memberId);
        } catch (queueError) {
          setError(
            queueError.message ||
              "A delivery step failed unexpectedly for one member.",
          );
        } finally {
          removeMemberFromQueue(memberId);
        }
      }
    } finally {
      deliveryProcessingRef.current = false;
      setDeliveryBusy(false);
      setActiveDeliveryId("");
    }
  }, [deliverMember, project, removeMemberFromQueue]);

  useEffect(() => {
    if (!project || deliveryQueue.length === 0 || deliveryProcessingRef.current) {
      return;
    }

    void runDeliveryQueue();
  }, [deliveryQueue, project, runDeliveryQueue]);

  const approveMember = async (memberId) => {
    setError("");
    setSuccess("");

    const headers = await getAuthHeaders();
    if (!headers) return;

    const response = await fetch(`${BACKEND}/api/members/${memberId}/approve`, {
      method: "PATCH",
      headers,
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(json.error || "Failed to approve member.");
      return;
    }

    if (json.member) {
      mergeMembers([json.member]);
      if (json.member.delivery_phase === "queued") {
        enqueueMembers([json.member]);
      }
    }

    await loadData();

    setSuccess(
      json.warning || "Member approved. Delivery is now queued in this tab.",
    );
  };

  const rejectMember = async (memberId) => {
    setError("");
    setSuccess("");

    const headers = await getAuthHeaders();
    if (!headers) return;

    const response = await fetch(`${BACKEND}/api/members/${memberId}/reject`, {
      method: "PATCH",
      headers,
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error || "Failed to reject member.");
      return;
    }

    removeMemberFromQueue(memberId);
    await loadData();
  };

  const deleteMember = async (memberId) => {
    if (!confirm("Remove this member permanently?")) return;

    setError("");
    setSuccess("");

    const headers = await getAuthHeaders();
    if (!headers) return;

    const response = await fetch(`${BACKEND}/api/members/${memberId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setError(json.error || "Failed to delete member.");
      return;
    }

    removeMemberFromQueue(memberId);
    setMembers((previousMembers) =>
      previousMembers.filter((member) => member.id !== memberId),
    );
    await loadData();
  };

  const bulkApproveAll = async () => {
    const pendingMembers = members.filter((member) => member.status === "pending");
    if (pendingMembers.length === 0) return;

    const ids =
      selected.size > 0 ? [...selected] : pendingMembers.map((member) => member.id);

    setError("");
    setSuccess("");

    const headers = await getAuthHeaders(true);
    if (!headers) return;

    const response = await fetch(`${BACKEND}/api/members/bulk-approve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ memberIds: ids }),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(json.error || "Bulk approval failed.");
      return;
    }

    const approvedMembers = json.approved || [];
    mergeMembers(approvedMembers);
    enqueueMembers(
      approvedMembers.filter((member) => member.delivery_phase === "queued"),
    );
    setSelected(new Set());
    await loadData();

    setSuccess(
      json.warning ||
        `${approvedMembers.length} member(s) approved. Delivery is now queued in this tab.`,
    );
  };

  const queueMemberRetry = async (member) => {
    setError("");
    setSuccess("");

    try {
      let nextMember = member;
      let warning = "";

      if (member.delivery_phase === "failed_prepare" || !member.delivery_card_id) {
        const preparation = await queueMemberForDelivery(member.id);
        nextMember = preparation.member || nextMember;
        warning = preparation.warning || "";
      } else if (member.delivery_phase !== "queued") {
        nextMember =
          (await persistDeliveryStatus(member.id, {
            phase: "queued",
            clearError: true,
            cardId: member.delivery_card_id,
            verificationUrl: member.delivery_verification_url,
          })) || {
            ...member,
            delivery_phase: "queued",
            delivery_error: "",
          };
      }

      if (warning) {
        setSuccess(warning);
      }

      if (!nextMember?.email?.trim()) {
        setError("This member has no email address for automatic delivery.");
        return;
      }

      if (nextMember?.delivery_phase === "queued") {
        enqueueMembers([nextMember]);
        setSuccess(`Delivery queued for ${nextMember.name}.`);
      } else if (nextMember?.delivery_phase === "failed_prepare") {
        setError(
          nextMember.delivery_error || "Could not prepare the card for delivery.",
        );
      }
    } catch (queueError) {
      setError(queueError.message || "Failed to queue delivery.");
    }
  };

  const resumePendingDeliveries = async () => {
    const candidates = membersRef.current.filter(canRetryDelivery);
    if (candidates.length === 0) return;

    setError("");
    setSuccess("");

    const queuedMembers = [];

    for (const member of candidates) {
      let nextMember = member;

      if (member.delivery_phase === "failed_prepare" || !member.delivery_card_id) {
        try {
          const preparation = await queueMemberForDelivery(member.id);
          nextMember = preparation.member || nextMember;
        } catch (queueError) {
          setError(queueError.message || "Failed to prepare delivery queue.");
          continue;
        }
      } else if (member.delivery_phase !== "queued") {
        nextMember =
          (await persistDeliveryStatus(member.id, {
            phase: "queued",
            clearError: true,
            cardId: member.delivery_card_id,
            verificationUrl: member.delivery_verification_url,
          })) || nextMember;
      }

      if (nextMember?.delivery_phase === "queued" && nextMember.email?.trim()) {
        queuedMembers.push(nextMember);
      }
    }

    enqueueMembers(queuedMembers);

    if (queuedMembers.length > 0) {
      setSuccess(
        `${queuedMembers.length} member(s) queued for delivery in this tab.`,
      );
    }
  };

  const handleExportCsv = async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    const response = await fetch(
      `${BACKEND}/api/projects/${projectId}/export-csv`,
      {
        headers,
      },
    );

    if (!response.ok) {
      setError("CSV export failed.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project?.name || "members"}_export.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSuccess("CSV downloaded!");
  };

  const handleRenew = async () => {
    setRenewing(true);

    try {
      const headers = await getAuthHeaders(true);
      if (!headers) return;

      const response = await fetch(`${BACKEND}/api/projects/${projectId}/renew`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mode: renewMode }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(json.error || "Renewal failed.");
        return;
      }

      setSuccess(json.message);
      setShowRenewModal(false);
      await loadData();
    } catch {
      setError("Network error during renewal.");
    } finally {
      setRenewing(false);
    }
  };

  const copyFormLink = () => {
    const link = `${window.location.origin}/register/${projectId}`;
    navigator.clipboard.writeText(link);
    setSuccess("Form link copied to clipboard!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const toggleSelect = (memberId) => {
    setSelected((previousSelected) => {
      const nextSelected = new Set(previousSelected);
      if (nextSelected.has(memberId)) {
        nextSelected.delete(memberId);
      } else {
        nextSelected.add(memberId);
      }
      return nextSelected;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#2563EB] border-t-transparent rounded-full" />
      </div>
    );
  }

  const visibleMembers = members.filter((member) =>
    filter === "all" ? true : member.status === filter,
  );
  const pendingVisibleMembers = visibleMembers.filter(
    (member) => member.status === "pending",
  );
  const approvedMembers = members.filter((member) => member.status === "approved");
  const deliveryCounts = countDeliveryPhases(approvedMembers);
  const resumableMembers = approvedMembers.filter(canRetryDelivery);
  const pendingCount = stats?.pending || 0;

  const statusColors = {
    pending: "text-amber-600 bg-amber-50 border-amber-200",
    approved: "text-emerald-600 bg-emerald-50 border-emerald-200",
    rejected: "text-red-600 bg-red-50 border-red-200",
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8] text-slate-900 font-['Public_Sans',sans-serif]">
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-2 sm:py-3 gap-2 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3 text-sm min-w-0">
            <BrandLogoLink
              className="shrink-0"
              imageClassName="h-7 sm:h-8 w-auto"
              showText={false}
            />
            <div className="w-px h-6 bg-slate-200 shrink-0 hidden sm:block" />
            <button
              onClick={() => navigate(`/org/${slug}/dashboard`)}
              className="text-[#2563EB] hover:underline transition cursor-pointer font-medium text-xs sm:text-sm"
            >
              {slug}
            </button>
            <svg
              className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="font-bold text-slate-900 truncate max-w-32 sm:max-w-xs text-xs sm:text-sm">
              {project?.name || "Project"}
            </span>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={copyFormLink}
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white rounded-lg text-[10px] sm:text-xs font-medium transition cursor-pointer shadow-sm"
            >
              Copy Link
            </button>
            <button
              onClick={() => navigate(`/org/${slug}/bulk/${projectId}`)}
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] sm:text-xs font-medium transition cursor-pointer shadow-sm"
            >
              Bulk Import
            </button>
            <button
              onClick={() => {
                navigate("/generate", {
                  state: {
                    fromProject: true,
                    projectId,
                    slug,
                    template: project?.template || "custom",
                    orgName: org?.name || slug,
                    logoUrl: org?.logo_url || "",
                    members: approvedMembers.map((member) => ({
                      id: member.id,
                      name: member.name,
                      email: member.email || "",
                      photo_url: member.photo_url || "",
                      custom_fields: member.custom_fields || {},
                    })),
                  },
                });
              }}
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] sm:text-xs font-medium transition cursor-pointer shadow-sm"
            >
              Generate
            </button>
            <button
              onClick={handleExportCsv}
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[10px] sm:text-xs font-medium transition cursor-pointer"
            >
              CSV
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError("")}
              className="float-right text-red-400 hover:text-red-600 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            {success}
            <button
              onClick={() => setSuccess("")}
              className="float-right text-emerald-400 hover:text-emerald-600 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {[
            {
              label: "Total",
              value: stats?.totalMembers || 0,
              color: "text-slate-900",
              bg: "bg-white",
              iconBg: "bg-slate-100",
              iconColor: "text-slate-600",
            },
            {
              label: "Pending",
              value: pendingCount,
              color: "text-amber-600",
              bg: "bg-white",
              iconBg: "bg-amber-50",
              iconColor: "text-amber-500",
            },
            {
              label: "Approved",
              value: stats?.approved || 0,
              color: "text-emerald-600",
              bg: "bg-white",
              iconBg: "bg-emerald-50",
              iconColor: "text-emerald-500",
            },
            {
              label: "Rejected",
              value: stats?.rejected || 0,
              color: "text-red-600",
              bg: "bg-white",
              iconBg: "bg-red-50",
              iconColor: "text-red-500",
            },
            {
              label: "Cards",
              value: stats?.cardsGenerated || 0,
              color: "text-[#2563EB]",
              bg: "bg-white",
              iconBg: "bg-[#2563EB]/10",
              iconColor: "text-[#2563EB]",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bg} border border-slate-200 rounded-xl p-3 sm:p-5`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 ${stat.iconBg} rounded-lg flex items-center justify-center`}
                >
                  <span className={`text-sm sm:text-lg font-bold ${stat.iconColor}`}>#</span>
                </div>
                <div>
                  <p className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Approval Delivery Queue
              </p>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Client-side PDF generation with persisted send status
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Approval prepares the card record on the backend. This dashboard
                tab generates the PDF in the browser, calls the email endpoint,
                and stores the last confirmed state for every approved member.
              </p>
            </div>
            {resumableMembers.length > 0 && (
              <button
                onClick={resumePendingDeliveries}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white rounded-lg text-sm font-medium transition cursor-pointer shadow-sm"
              >
                {deliveryBusy
                  ? "Queue Running..."
                  : `Resume Delivery (${resumableMembers.length})`}
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
            {[
              { label: "Queued", value: deliveryCounts.queued, color: "text-sky-600" },
              { label: "Generating", value: deliveryCounts.generating, color: "text-violet-600" },
              { label: "Generated", value: deliveryCounts.generated, color: "text-indigo-600" },
              { label: "Sending", value: deliveryCounts.sending, color: "text-amber-600" },
              { label: "Sent", value: deliveryCounts.sent, color: "text-emerald-600" },
              { label: "Failed", value: deliveryCounts.failed, color: "text-rose-600" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {item.label}
                </p>
                <p className={`text-xl font-bold mt-1 ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-500">
            {deliveryBusy ? (
              <span>
                Delivery queue is running in this tab
                {activeDeliveryId
                  ? ` for ${
                      members.find((member) => member.id === activeDeliveryId)?.name ||
                      "the current member"
                    }.`
                  : "."}
              </span>
            ) : (
              <span>
                Queue is idle. Reloading this page will keep the last stored phase for
                each approved member.
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 mb-1 font-medium">
                Public Registration Link
              </p>
              <code className="block text-sm text-[#2563EB] truncate font-mono bg-[#2563EB]/5 px-3 py-1.5 rounded-lg">
                {window.location.origin}/register/{projectId}
              </code>
            </div>
            <button
              onClick={copyFormLink}
              className="px-4 py-2 bg-[#2563EB] hover:bg-[#2563EB]/90 text-white rounded-lg text-sm font-medium transition cursor-pointer shrink-0 shadow-sm"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 overflow-x-auto">
            {["all", "pending", "approved", "rejected"].map((nextFilter) => (
              <button
                key={nextFilter}
                onClick={() => {
                  setFilter(nextFilter);
                  setSelected(new Set());
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  filter === nextFilter
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {nextFilter.charAt(0).toUpperCase() + nextFilter.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {pendingCount > 0 && (
            <button
              onClick={bulkApproveAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
            >
              ✓ Approve{" "}
              {selected.size > 0
                ? `(${selected.size})`
                : `All (${pendingCount})`}
            </button>
          )}

          <button
            onClick={() => setShowRenewModal(true)}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Renew Project
          </button>
        </div>
        {visibleMembers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-slate-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="font-medium text-slate-600">No members yet</p>
            <p className="text-sm mt-1 text-slate-400">
              Share the registration link to start receiving submissions.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-xs bg-slate-50/50">
                    <th className="text-left px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelected(
                              new Set(
                                pendingVisibleMembers.map((member) => member.id),
                              ),
                            );
                          } else {
                            setSelected(new Set());
                          }
                        }}
                        checked={
                          pendingVisibleMembers.length > 0 &&
                          pendingVisibleMembers.every((member) =>
                            selected.has(member.id),
                          )
                        }
                        className="accent-[#2563EB] rounded"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 font-semibold">Email</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Delivery</th>
                    <th className="text-left px-4 py-3 font-semibold">Submitted</th>
                    <th className="text-left px-4 py-3 font-semibold">
                      Custom Fields
                    </th>
                    <th className="text-right px-4 py-3 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((member) => {
                    const deliveryMeta =
                      member.status === "approved"
                        ? getDeliveryMeta(member.delivery_phase)
                        : null;

                    return (
                      <tr
                        key={member.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition"
                      >
                        <td className="px-4 py-3">
                          {member.status === "pending" && (
                            <input
                              type="checkbox"
                              checked={selected.has(member.id)}
                              onChange={() => toggleSelect(member.id)}
                              className="accent-[#2563EB] rounded"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {member.name}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {member.email || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              statusColors[member.status] ||
                              "text-slate-400 bg-slate-50 border-slate-200"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {member.status === "approved" ? (
                            <div className="space-y-1 max-w-xs">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${deliveryMeta.badgeClassName}`}
                              >
                                {deliveryMeta.label}
                              </span>
                              {member.delivery_error && (
                                <p className="text-[11px] text-rose-500 leading-4">
                                  {member.delivery_error}
                                </p>
                              )}
                              {member.delivery_card_id && (
                                <p className="text-[11px] text-slate-400 font-mono">
                                  Card {String(member.delivery_card_id).slice(0, 8)}
                                </p>
                              )}
                              {member.email_sent_at && (
                                <p className="text-[11px] text-slate-400">
                                  Sent{" "}
                                  {new Date(member.email_sent_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-56 truncate">
                          {member.custom_fields &&
                          Object.keys(member.custom_fields).length > 0
                            ? Object.entries(member.custom_fields)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(", ")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5 flex-wrap">
                            {member.status === "pending" && (
                              <>
                                <button
                                  onClick={() => approveMember(member.id)}
                                  className="px-2.5 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-md text-xs font-medium transition cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => rejectMember(member.id)}
                                  className="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-md text-xs font-medium transition cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {member.status === "approved" &&
                              canRetryDelivery(member) && (
                                <button
                                  onClick={() => queueMemberRetry(member)}
                                  disabled={activeDeliveryId === member.id}
                                  className="px-2.5 py-1 bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/15 border border-[#2563EB]/20 rounded-md text-xs font-medium transition cursor-pointer disabled:opacity-60"
                                >
                                  {activeDeliveryId === member.id
                                    ? "Running..."
                                    : canResumeDelivery(member)
                                      ? "Resume"
                                      : "Retry"}
                                </button>
                              )}
                            {member.delivery_verification_url && (
                              <a
                                href={member.delivery_verification_url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 bg-white text-slate-600 hover:text-[#2563EB] border border-slate-200 hover:border-[#2563EB]/30 rounded-md text-xs font-medium transition"
                              >
                                Verify
                              </a>
                            )}
                            <button
                              onClick={() => deleteMember(member.id)}
                              className="px-2.5 py-1 bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-md text-xs font-medium transition cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {showRenewModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Renew Project</h2>
            <p className="text-sm text-slate-500">
              Choose how to handle existing members when renewing this project
              for a new subscription period.
            </p>
            <div className="space-y-3">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  renewMode === "continue"
                    ? "border-[#2563EB] bg-[#2563EB]/5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="renewMode"
                  value="continue"
                  checked={renewMode === "continue"}
                  onChange={() => setRenewMode("continue")}
                  className="accent-[#2563EB] mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Continue from last point
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Keep all existing members. New registrations will be added
                    alongside previous ones. The form link stays the same.
                  </p>
                </div>
              </label>
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  renewMode === "reset"
                    ? "border-red-500 bg-red-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="renewMode"
                  value="reset"
                  checked={renewMode === "reset"}
                  onChange={() => setRenewMode("reset")}
                  className="accent-red-500 mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Fresh start (reset all)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All existing members will be removed. The project starts
                    clean with no data. Download CSV first if you need the data.
                  </p>
                </div>
              </label>
            </div>
            {renewMode === "reset" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-600">
                  This will permanently delete all member data for this project.
                  Make sure you have exported the CSV before proceeding.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleRenew}
                disabled={renewing}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm ${
                  renewMode === "reset"
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-[#2563EB] hover:bg-[#2563EB]/90 text-white"
                } disabled:opacity-50`}
              >
                {renewing
                  ? "Processing..."
                  : renewMode === "continue"
                    ? "Renew & Continue"
                    : "Reset & Renew"}
              </button>
              <button
                onClick={() => setShowRenewModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
