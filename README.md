# Current Supply

Reseller inventory app for deals, photos, profit metrics, and listing stamps.

## Production

Canonical deploy (Vercel project `current-supply` under **mc's projects**):

**https://current-supply-sigma.vercel.app**

Local CLI is linked to that project (`.vercel/`). Required env vars must be set for Production, Preview, and Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Setup

1. Copy `.env.example` → `.env.local` and fill in Supabase credentials for project `onjguvlozsqxkurgqgbl`.
2. In the [Supabase SQL Editor](https://supabase.com/dashboard/project/onjguvlozsqxkurgqgbl/sql/new), run `supabase/migrations/001_init.sql` (tables + `deal-photos` storage bucket). Or let the app bootstrap tables on first request when `DATABASE_URL` is set.
3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://onjguvlozsqxkurgqgbl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server uploads/DB helpers |
| `DATABASE_URL` | Optional Postgres URI (Settings → Database → Connection string, pooler) |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Optional — spreadsheet ID for Deals tab sync |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Optional — service account `client_email` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Optional — service account `private_key` |

Set the same vars in Vercel → Project → Settings → Environment Variables (all environments), then redeploy.

### Google Sheets (optional)

Auto-sync uses a **service account**, not an OAuth Web client. Create a service account JSON key, share a sheet (tab name `Deals`) with that email as Editor, set the three `GOOGLE_*` vars above on Vercel, redeploy, then use **Finance → Sync Google Sheets**. New deals sync automatically once configured. See Finance page banner and `.env.example` for full steps.

## Features

- Deal CRUD with cost, price, size, condition, categories, owner (Mizzy/Mac/Other), purchase/sale dates
- Cover photo on Add/Edit deal forms; multi-photo manager on deal detail
- Photos in Supabase Storage (`deal-photos`); metadata in Postgres
- Dashboard metrics (inventory cost, projected/realized profit, ROI, days held)
- Search, filters, and sorting
- Listing stamp tool that overlays size + price on photos
