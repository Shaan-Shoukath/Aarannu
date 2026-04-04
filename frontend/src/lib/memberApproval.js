import { supabase } from "./supabaseClient";

export async function getMemberApprovalRecord(userId) {
  if (!userId) {
    return {
      member: null,
      error: new Error("A user ID is required to check approval."),
    };
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, user_id, name, role, approved")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    member: data || null,
    error,
  };
}
