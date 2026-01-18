# Bloom — Project Handoff

**Version:** v1-handoff  
**Date:** January 18, 2026  
**Repository:** https://github.com/NobodyYett/Bloom  
**Owner:** Zelkz LLC  

---

## 1. Project Overview

Bloom is a pregnancy companion mobile application built with Expo + Capacitor, backed by Supabase, and featuring Ivy, an AI-powered assistant for educational and emotional support.

The app supports:

- Daily pregnancy check-ins
- Private journaling with images
- Weekly summaries
- Partner mode with strict privacy boundaries
- Postpartum support (client-side inferred)
- Subscriptions via RevenueCat

---

## 2. Architecture

### Frontend

- React + Vite
- Expo Router
- Capacitor (iOS + Android)
- Tailwind / Radix UI
- RevenueCat (subscriptions)

### Backend

- Supabase
- Postgres with Row Level Security (RLS)
- Storage (journal images)
- RPCs (security-scoped aggregation)

### Auth

- Email/password
- Apple Sign-In
- Google Sign-In

---

## 3. Security & Privacy Model (Critical)

### 3.1 Row Level Security (RLS)

All user data tables are protected by owner-only RLS policies:

- pregnancy_checkins
- pregnancy_journal_entries
- feeding_logs
- nap_logs
- pregnancy_profiles
- pregnancy_logs
- shared_tasks
- partner_access

Policy pattern (example):

- `user_id = auth.uid()`

**Guarantees**
- ✅ No partner SELECT access
- ✅ No cross-user leakage
- ✅ No permissive joins

---

### 3.2 Partner Access Model

Partners never have direct access to:

- Journal entries
- Notes
- Images
- Raw check-in records

Partners only receive aggregated insights via controlled RPCs.

**Partner RPCs**
- `get_partner_weekly_insights`
- `get_partner_weekly_insights_with_trends`

**Security characteristics**
- `SECURITY DEFINER`
- Validates partner relationship via `partner_access`
- Enforces date-range limits
- Returns aggregated JSON only
- No raw rows exposed

---

### 3.3 Storage Security (Images)

**Bucket:** `journal-images`

**Rules**
- Folder structure: `{auth.uid()}/...`
- Read/write/delete restricted to owner
- Partner access blocked

---

## 4. Data Boundaries Summary

| Feature | Mom | Partner |
|---|---:|---:|
| Journal entries | ✅ Full CRUD | ❌ None |
| Journal images | ✅ Full access | ❌ None |
| Daily check-ins | ✅ Full CRUD | ❌ None |
| Weekly insights | ✅ Full detail | ✅ Aggregated only |
| Symptoms | ✅ Full detail | ✅ Count-based only |

---

## 5. Recent Functional Updates

### Journal
- Mood-colored cards (green / yellow / red)
- Image thumbnails (only render if loaded)
- Lightbox for full image
- Deep linking via `?entry=<id>`
- Integrated check-in + journal entries

### Home / Daily Check-In
- Clicking past entries routes to Journal page
- Recent journal preview (mom-only)

### Partner View
- Uses RPC aggregation only
- No raw data exposure
- Suggestion engine with severity weighting

### Postpartum Mode
- Client-side inferred via birth date
- Separate suggestion pools
- No DB changes required

---

## 6. Excluded Files & Security Notes ⚠️

The following are intentionally excluded from this handoff archive:

### Excluded
- `node_modules/`
- `.env`, `.env.*`, `.env.example`

Build artifacts:
- `dist/`
- `ios/App/Pods/`
- `ios/App/build/`
- `android/.gradle/`
- `android/app/build/`
- `.git/`

### Rationale

**node_modules/**  
Generated locally to ensure platform compatibility.

**Environment files (.env)**  
Contain secrets (Supabase keys, RevenueCat keys, OAuth credentials).  
Never shipped or committed.

This follows standard security best practices and App Store guidelines.

---

## 7. Environment Setup (Local)

```bash
npm ci
cp .env.example .env   # populate secrets locally
npm run dev            # web
npx cap sync           # mobile
