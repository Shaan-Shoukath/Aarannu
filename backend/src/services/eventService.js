/**
 * Event Service
 * ─────────────
 * DB operations for events and event check-ins.
 *
 * All functions return { data, error } tuples (Supabase style).
 * No HTTP concerns — those live in the controller.
 */

const { supabase } = require("../config/supabaseClient");
const { getCardForVerification } = require("./generateService");

/**
 * Create a new event for an organization.
 */
const createEvent = async ({ orgId, projectId, name, description, eventDate, createdBy }) => {
  return supabase
    .from("events")
    .insert({
      org_id: orgId,
      project_id: projectId || null,
      name,
      description: description || "",
      event_date: eventDate,
      created_by: createdBy,
    })
    .select()
    .single();
};

/**
 * Get all events for an organization, newest first.
 */
const getEventsByOrg = async (orgId) => {
  return supabase
    .from("events")
    .select("*")
    .eq("org_id", orgId)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });
};

/**
 * Get a single event by ID.
 */
const getEventById = async (eventId) => {
  return supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();
};

/**
 * Update event status ('active' | 'ended').
 */
const updateEventStatus = async (eventId, status) => {
  return supabase
    .from("events")
    .update({ status })
    .eq("id", eventId)
    .select()
    .single();
};

/**
 * Delete an event. Cascades to event_checkins via FK.
 */
const deleteEvent = async (eventId) => {
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId);
  return { error };
};

/**
 * Record a check-in by scanning a card QR code.
 *
 * Returns one of:
 *   { data: checkin }
 *   { error: { code: 'CARD_NOT_FOUND' | 'CARD_REVOKED' | 'CARD_EXPIRED' | 'EVENT_ENDED' | 'DUPLICATE_CHECKIN', message } }
 */
const checkinWithCard = async (eventId, cardId, scannedBy) => {
  // 1. Look up the card with member details
  const { data: card, error: cardError } = await getCardForVerification(cardId);

  if (cardError || !card) {
    return { error: { code: "CARD_NOT_FOUND", message: "Card not found." } };
  }

  // 2. Validate card status
  if (card.status === "revoked") {
    return { error: { code: "CARD_REVOKED", message: "This card has been revoked." } };
  }
  if (card.status === "expired" || new Date(card.expires_at) < new Date()) {
    return { error: { code: "CARD_EXPIRED", message: "This card has expired." } };
  }

  // 3. Fetch the event and check it's still active
  const { data: event, error: eventError } = await getEventById(eventId);
  if (eventError || !event) {
    return { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } };
  }
  if (event.status !== "active") {
    return { error: { code: "EVENT_ENDED", message: "This event has ended." } };
  }

  // 4. Insert the check-in (unique constraint handles dedup at DB level)
  const member = card.project_members;
  const { data: checkin, error: insertError } = await supabase
    .from("event_checkins")
    .insert({
      event_id: eventId,
      card_id: cardId,
      member_id: card.member_id,
      member_name: member?.name || "Unknown",
      member_email: member?.email || "",
      member_photo_url: member?.photo_url || "",
      scanned_by: scannedBy,
    })
    .select()
    .single();

  if (insertError) {
    // Postgres unique violation code
    if (insertError.code === "23505") {
      return { error: { code: "DUPLICATE_CHECKIN", message: "This card has already checked in." } };
    }
    return { error: { code: "DB_ERROR", message: insertError.message } };
  }

  return { data: checkin };
};

/**
 * Get all check-ins for an event, most recent first.
 */
const getCheckinsByEvent = async (eventId) => {
  return supabase
    .from("event_checkins")
    .select("*")
    .eq("event_id", eventId)
    .order("checked_in_at", { ascending: false });
};

/**
 * Delete (undo) a single check-in entry.
 */
const deleteCheckin = async (checkinId) => {
  const { error } = await supabase
    .from("event_checkins")
    .delete()
    .eq("id", checkinId);
  return { error };
};

module.exports = {
  createEvent,
  getEventsByOrg,
  getEventById,
  updateEventStatus,
  deleteEvent,
  checkinWithCard,
  getCheckinsByEvent,
  deleteCheckin,
};
