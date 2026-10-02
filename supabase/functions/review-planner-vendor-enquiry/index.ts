import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createCorsHeaders } from "../_shared/cors.ts";
import { assertActiveAuthSession, isAuthSessionError } from "../_shared/sessionGuard.ts";
import { deliverVendorEnquiryWithResend } from "../_shared/vendorEnquiryDelivery.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const json = (status: number, payload: Record<string, unknown>) => new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Supabase auth configuration is missing" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Unauthorized" });
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return json(401, { error: "Unauthorized" });

  try {
    await assertActiveAuthSession(serviceClient, authHeader, authData.user.id);
    const body = await req.json().catch(() => ({}));
    const requestId = typeof body?.requestId === "string" ? body.requestId : "";
    if (!UUID.test(requestId)) return json(400, { error: "A valid approval request is required." });

    const { data: requestRow, error: requestError } = await authClient.from("planner_change_requests")
      .select("id,client_id,couple_user_id,planner_user_id,target_table,change_type,status,proposed_payload,gateway_idempotency_key")
      .eq("id", requestId).maybeSingle();
    if (requestError || !requestRow) return json(404, { error: "Vendor enquiry approval request not found." });
    if (requestRow.couple_user_id !== authData.user.id || requestRow.target_table !== "vendor_enquiries" || requestRow.change_type !== "create") {
      return json(403, { error: "This approval request is not available to this account." });
    }
    if (requestRow.status === "approved") {
      const { data: existing } = await authClient.from("vendor_enquiries")
        .select("id,delivery_status,provider_message_id,sent_at,response_token").eq("planner_change_request_id", requestId).maybeSingle();
      return json(200, { success: true, replay: true, enquiry: existing ?? null });
    }
    if (requestRow.status !== "pending") return json(409, { error: "This enquiry request is no longer pending." });

    const payload = requestRow.proposed_payload && typeof requestRow.proposed_payload === "object"
      ? requestRow.proposed_payload as Record<string, unknown> : {};
    const clientId = String(payload.planner_client_id ?? "");
    const weddingId = String(payload.wedding_id ?? "");
    const vendorId = String(payload.vendor_id ?? "");
    const idempotencyKey = String(payload.gateway_idempotency_key ?? "");
    const recipientEmail = String(payload.recipient_email ?? "").trim().toLowerCase();
    const recipientName = String(payload.recipient_name ?? "").trim();
    const senderName = String(payload.sender_name ?? "").trim();
    const subject = String(payload.subject ?? "").trim();
    const message = String(payload.message ?? "").trim();
    if (!UUID.test(clientId) || !UUID.test(weddingId) || !UUID.test(vendorId) || !UUID.test(idempotencyKey)
      || idempotencyKey !== requestRow.gateway_idempotency_key || !EMAIL.test(recipientEmail)
      || !recipientName || recipientName.length > 160 || !senderName || senderName.length > 160
      || !subject || subject.length > 160 || !message || message.length > 3000) {
      return json(409, { error: "The stored enquiry details are incomplete or changed. Ask the planner to prepare it again." });
    }

    const [{ data: client }, { data: vendor }] = await Promise.all([
      serviceClient.from("planner_clients").select("id,wedding_id,planner_user_id,linked_user_id,is_archived")
        .eq("id", clientId).maybeSingle(),
      serviceClient.from("vendors").select("id,wedding_id,client_id,name,vendor_listing_id")
        .eq("id", vendorId).maybeSingle(),
    ]);
    if (!client || client.is_archived || client.wedding_id !== weddingId
      || client.planner_user_id !== requestRow.planner_user_id || client.linked_user_id !== authData.user.id
      || payload.owner_user_id !== requestRow.planner_user_id
      || !vendor || vendor.wedding_id !== weddingId || vendor.client_id !== clientId
      || (payload.vendor_listing_id ?? null) !== (vendor.vendor_listing_id ?? null)) {
      return json(409, { error: "Client or vendor access changed after this enquiry was prepared. Ask the planner to prepare it again." });
    }

    const { data: enquiry, error: insertError } = await serviceClient.from("vendor_enquiries").upsert({
      ...payload,
      owner_user_id: requestRow.planner_user_id,
      vendor_listing_id: vendor.vendor_listing_id,
      planner_change_request_id: requestId,
      initiated_by_user_id: requestRow.planner_user_id,
      approved_by_user_id: authData.user.id,
      approved_at: new Date().toISOString(),
      channel: "email",
      delivery_provider: "resend",
      delivery_status: "sending",
    }, { onConflict: "gateway_idempotency_key" }).select("id,delivery_status,provider_message_id,sent_at,response_token").single();
    if (insertError || !enquiry) return json(503, { error: "Could not record the approved enquiry before delivery. No email was sent." });

    let completed = enquiry;
    if (enquiry.delivery_status !== "sent" && enquiry.delivery_status !== "failed") {
      const delivery = await deliverVendorEnquiryWithResend({
        enquiryId: enquiry.id,
        idempotencyKey,
        responseToken: enquiry.response_token,
        recipientName,
        recipientEmail,
        senderName,
        subject,
        message,
      });
      const { data: updated, error: updateError } = await serviceClient.from("vendor_enquiries").update({
        delivery_status: delivery.ok ? "sent" : "failed",
        provider_message_id: delivery.providerMessageId,
        sent_at: delivery.ok ? new Date().toISOString() : null,
        failed_at: delivery.ok ? null : new Date().toISOString(),
        failure_message: delivery.ok ? null : delivery.error,
      }).eq("id", enquiry.id).select("id,delivery_status,provider_message_id,sent_at").single();
      if (updateError || !updated) return json(503, { error: "The provider handled the enquiry, but Zania could not save the delivery receipt. Do not approve it again; contact support." });
      completed = updated;
    }

    const { error: approvalError } = await serviceClient.from("planner_change_requests").update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: authData.user.id,
    }).eq("id", requestId).eq("status", "pending");
    if (approvalError) return json(503, { error: "The enquiry attempt was recorded, but the approval status could not be finalized. Contact support before retrying." });

    return json(200, {
      success: true,
      enquiry: completed,
      message: completed.delivery_status === "sent"
        ? "The approved vendor enquiry was sent. No booking or quote was created."
        : "The enquiry was approved, but email delivery failed. It will not retry automatically.",
    });
  } catch (error) {
    if (isAuthSessionError(error)) return json(error.status, { error: error.message });
    console.error("review-planner-vendor-enquiry error", error);
    return json(500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
});
