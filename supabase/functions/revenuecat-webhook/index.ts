// supabase/functions/revenuecat-webhook/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REVENUECAT_WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Events that grant premium
const PREMIUM_GRANT_EVENTS = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "PRODUCT_CHANGE",
];

// Events that revoke premium
const PREMIUM_REVOKE_EVENTS = [
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
];

// Verify Authorization header
function verifyAuthorization(authHeader: string | null): boolean {
  if (!authHeader || !REVENUECAT_WEBHOOK_SECRET) {
    console.error("Missing authorization header or secret");
    return false;
  }

  // RevenueCat sends: "Bearer your_secret_value"
  const expectedHeader = `Bearer ${REVENUECAT_WEBHOOK_SECRET}`;
  return authHeader === expectedHeader;
}

serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify authorization
  const authHeader = req.headers.get("Authorization");
  if (!verifyAuthorization(authHeader)) {
    console.error("Invalid authorization header");
    return new Response("Unauthorized", { status: 401 });
  }

  let event;
  try {
    event = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = event.event?.type;
  const appUserId = event.event?.app_user_id;

  console.log(`[RevenueCat Webhook] Event: ${eventType}, User: ${appUserId}`);

  if (!appUserId) {
    console.error("No app_user_id in event");
    return new Response("Missing app_user_id", { status: 400 });
  }

  // Skip anonymous IDs (start with $RCAnonymousID)
  if (appUserId.startsWith("$RCAnonymousID")) {
    console.log("Skipping anonymous user event");
    return new Response("OK", { status: 200 });
  }

  // Initialize Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Determine premium status based on event type
  let isPremium: boolean | null = null;

  if (PREMIUM_GRANT_EVENTS.includes(eventType)) {
    isPremium = true;
  } else if (PREMIUM_REVOKE_EVENTS.includes(eventType)) {
    isPremium = false;
  } else if (eventType === "TRANSFER") {
    // Handle transfer: revoke from old user, grant to new
    const transferredFrom = event.event?.transferred_from?.[0];
    const transferredTo = event.event?.transferred_to?.[0];

    if (transferredFrom) {
      await supabase
        .from("pregnancy_profiles")
        .update({
          is_premium: false,
          premium_updated_at: new Date().toISOString(),
          premium_source: "revenuecat_transfer_out",
        })
        .eq("user_id", transferredFrom);
      console.log(`[RevenueCat] Revoked premium from ${transferredFrom} (transfer)`);
    }

    if (transferredTo) {
      await supabase
        .from("pregnancy_profiles")
        .update({
          is_premium: true,
          premium_updated_at: new Date().toISOString(),
          premium_source: "revenuecat_transfer_in",
        })
        .eq("user_id", transferredTo);
      console.log(`[RevenueCat] Granted premium to ${transferredTo} (transfer)`);
    }

    return new Response("OK", { status: 200 });
  }

  // Update user's premium status
  if (isPremium !== null) {
    const { error } = await supabase
      .from("pregnancy_profiles")
      .update({
        is_premium: isPremium,
        premium_updated_at: new Date().toISOString(),
        premium_source: `revenuecat_${eventType.toLowerCase()}`,
      })
      .eq("user_id", appUserId);

    if (error) {
      console.error("Failed to update premium status:", error);
      return new Response("Database error", { status: 500 });
    }

    console.log(`[RevenueCat] Updated user ${appUserId} premium=${isPremium}`);
  } else {
    console.log(`[RevenueCat] Unhandled event type: ${eventType}`);
  }

  return new Response("OK", { status: 200 });
});