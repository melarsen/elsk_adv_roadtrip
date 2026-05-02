# App

Deployed at: https://elsk-adv-roadtrip.vercel.app/

A roadtrip planner that helps you plan your route with tips on on-the-route attractions or must-see places and tips for hotel accomodation nearby the final destination for each day.

It can also save each generated trip as a PDF, upload the PDF to Supabase Storage, and show trip history (user history + admin all-users history).

---

## How it works
Currently ssing Gemini API with limited tokens (free key). 

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure environment variables in [.env.local](.env.local):
   `VITE_GEMINI_API_KEY`
   `VITE_SUPABASE_URL`
   `VITE_SUPABASE_ANON_KEY`
   `VITE_SUPABASE_PDF_BUCKET` (optional, default: `roadtrip-pdfs`)
   `VITE_ADMIN_PASSWORD`
3. Run the app:
   `npm run dev`

## Supabase Setup

1. Create a bucket (default name: `roadtrip-pdfs`) in Supabase Storage.
2. Make the bucket public if you want direct reopen links to work without signed URLs.
3. Create the shared trip history table:

```sql
create table if not exists public.roadtrip_history (
  id uuid primary key,
  created_at timestamptz not null default now(),
  user_id text not null,
  start text not null,
  destination text not null,
  summary text not null,
  google_maps_link text,
  pdf_url text not null
);
```

4. Add RLS policies that fit your security model. The current app reads all rows in Admin view using the anon key, so your policies must explicitly allow that if you want browser-only admin.

Important: The in-app admin password gate is client-side only. For real secure admin access, enforce authorization on a backend or Edge Function with service-role credentials.
