# Current Supply

Reseller inventory app for deals, photos, profit metrics, and listing stamps.

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
| `DATABASE_URL` | Postgres URI (Settings → Database → Connection string, pooler) |

Set the same vars in Vercel for production.

## Features

- Deal CRUD with cost, price, size, condition, categories, owner (Mizzy/Mac/Other), purchase/sale dates
- Cover photo on Add/Edit deal forms; multi-photo manager on deal detail
- Photos in Supabase Storage (`deal-photos`); metadata in Postgres
- Dashboard metrics (inventory cost, projected/realized profit, ROI, days held)
- Search, filters, and sorting
- Listing stamp tool that overlays size + price on photos
