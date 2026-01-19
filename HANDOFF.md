Bloom — Full Project Handoff (Authoritative)
Pinned repo state (SOURCE OF TRUTH)

Repo: https://github.com/NobodyYett/Bloom

Branch: main

Commit: c105b42

⚠️ This handoff assumes the repo is checked out at exactly this commit.
If behavior differs, verify the commit hash before debugging anything else.

What Bloom is (product-level context)

Bloom is a pregnancy → newborn companion app built for two roles:

Mom (primary account holder)

Partner (secondary, dependent account)

The app intentionally enforces asymmetric power:

Mom controls premium

Partner inherits access

Partner cannot independently monetize

Bloom is designed to scale from:

Pregnancy (weekly growth, guidance)

Birth

Early infancy (feeding, logs, support)

Supported platforms

Bloom is one codebase deployed across:

Web (development + testing)

Vite + React

iOS

Capacitor shell

Android

Capacitor shell

There is no separate mobile frontend.
Everything flows from the client/ app.

High-level system architecture
Client (React / Capacitor)
  |
  |  Auth, Reads, Writes (allowed fields only)
  v
Supabase
  ├─ Auth
  ├─ Postgres (RLS enforced)
  ├─ Realtime (optional)
  └─ Edge Functions
        ├─ revenuecat-webhook  <-- PREMIUM SOURCE OF TRUTH
        └─ ask-ivy (AI helper)
  ^
  |
RevenueCat
  └─ Purchases, renewals, cancellations

Source of truth for project structure (IMPORTANT)

When handing this project to a new AI:

❌ Do NOT send:

ZIP file listings

Finder trees

ls -R output

✅ Always send:

git ls-files > project_tree.txt


Why:

Only git-tracked files matter

Generated assets are intentionally excluded

Prevents AI from hallucinating files that don’t exist

Core architectural rules (DO NOT BREAK)
Rule 1 — Premium is server-authoritative

The client must NEVER set premium directly. Ever.

Forbidden:

update pregnancy_profiles set is_premium = true from client

Trusting RevenueCat SDK state alone

Client-side fallbacks

Correct flow:

Client → RevenueCat purchase
RevenueCat → Webhook
Webhook → Supabase Edge Function (service role)
Edge Function → DB update
Client → reads updated premium state


If you break this, the entire paywall becomes insecure.

Rule 2 — Partner cannot buy premium

Partners:

Do not see purchase buttons

Do not call RevenueCat purchase APIs

Cannot “upgrade themselves in”

Partners inherit access only if the mom is premium.

This is enforced both:

In UI

In data model assumptions

RevenueCat implementation (critical section)
Canonical file
supabase/functions/revenuecat-webhook/index.ts


This file is the only place premium status is written.

Webhook verification

Uses Authorization header

Expected format:

Bearer <REVENUECAT_WEBHOOK_SECRET>


Requests without this are rejected.

Event handling logic

Premium GRANT events

INITIAL_PURCHASE

RENEWAL

UNCANCELLATION

NON_RENEWING_PURCHASE

SUBSCRIPTION_EXTENDED

PRODUCT_CHANGE

→ Sets:

is_premium = true


Premium REVOKE events

CANCELLATION

EXPIRATION

BILLING_ISSUE

→ Sets:

is_premium = false


TRANSFER events
Handled explicitly:

Revoke old user

Grant new user

Anonymous user protection

Events with:

$RCAnonymousID...


are ignored.

This prevents ghost upgrades.

Client-side premium behavior
Client responsibilities

Trigger purchases via RevenueCat SDK

Never write is_premium

Treat Supabase as truth

React to premium state changes

Key files

client/src/lib/purchases.ts

client/src/contexts/PremiumContext.tsx

client/src/components/premium-lock.tsx

Partner logic (important)

Partner access is:

Derived, not stored independently

Based on mom’s is_premium

Partner UI:

May show “Partner paywall” info screen

Must NOT show purchase CTA

Relevant files:

client/src/pages/partner-paywall.tsx

client/src/contexts/PartnerContext.tsx

Supabase: what is included vs NOT included
Included in repo

Edge Functions:

supabase/functions/revenuecat-webhook

supabase/functions/ask-ivy

Any tracked schema files under:

supabase/schema/

NOT included / must be verified manually

These are intentionally not in code:

RLS policies

DB triggers

SQL functions / RPCs

Production environment variables

These live in:

Supabase dashboard

Supabase migrations (if added later)

⚠️ Do not assume RLS exists unless you verify it.

Required environment variables (names only)
Client (web + mobile)

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

VITE_REVENUECAT_API_KEY

Supabase Edge Function

REVENUECAT_WEBHOOK_SECRET

SUPABASE_URL

SUPABASE_SERVICE_ROLE_KEY

What was intentionally excluded from the handoff artifact

Any ZIP / handoff copy excludes:

Security

.env

.env.*

Reinstallable

node_modules/

Generated

dist/

build/

Gradle builds

Pods

DerivedData

Large generated mobile bundles

ios/App/App/public/

android/app/src/main/assets/public/

These are regenerated via:

npm ci
npm run dev
npx cap sync

Where to start reading code (in order)

RevenueCat truth

supabase/functions/revenuecat-webhook/index.ts

Client purchase abstraction

client/src/lib/purchases.ts

Premium state plumbing

client/src/contexts/PremiumContext.tsx

UI gating

client/src/components/premium-lock.tsx

Paywall UX

client/src/pages/subscribe.tsx

client/src/pages/partner-paywall.tsx

App entry

client/src/App.tsx

Dev commands
npm ci
npm run dev


Capacitor:

npx cap sync ios
npx cap open ios

npx cap sync android
npx cap open android

Pre-ship verification checklist

 RevenueCat webhook URL is deployed + correct

 Webhook secret matches Supabase env

 Client cannot write is_premium

 Partner cannot trigger purchase

 Premium UI updates after webhook events

 No fallback client-side premium logic exists

Why this handoff exists

This document exists to ensure:

No logic is reimplemented unnecessarily

Premium security is not weakened

Partner model is preserved

New contributors (human or AI) understand intent, not just code

If something seems “missing,” assume it was intentional and check this document before rebuilding it.