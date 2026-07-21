# Reselling

Local browser app for logging reseller deals: inventory, photos, profit metrics, and listing photo stamps.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Data is stored in `data/reselling.db`. Photos live in `public/uploads/`.

## Scripts

- `npm run dev` — start local server
- `npm run build` — production build
- `npm run lint` — lint

## Features

- Deal CRUD with cost, price, size, condition, categories, purchase/sale dates
- Photo upload with cover image and reorder
- Dashboard metrics (inventory cost, projected/realized profit, ROI, days held)
- Search, filters, and sorting
- Listing stamp tool that overlays size + price on photos
