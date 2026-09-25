# NexOrder — Cloudflare split (frontend + backend)

## Structure

```
frontend/   React + Vite UI (Cloudflare Pages)
backend/    Hono API on Cloudflare Workers + D1
legacy/     Old Express + JSON file version (reference only)
```

## Local development

```bash
# 1) Install
npm install

# 2) Create local D1 tables (includes auth + tenant migrations)
npm run db:local

# 3) Start API (port 8787)
npm run dev:api

# 4) Start UI (port 3000) — proxies /api → 8787
npm run dev:web
```

Open http://localhost:3000

Demo logins (password `demo` for all):
- `super@admin.com` · `admin@demo.com` · `pro@demo.com` · `free@demo.com` · `staff@rifa.com`

New signups require a password of at least 8 characters.

## Security notes

- Almost all `/api/*` routes require a Bearer JWT from `POST /api/auth/login` or `/api/auth/signup`.
- Orders, inventory, and config are scoped per shop (`tenant_id`).
- Backups redact API keys by default; restore only wipes the current tenant.
- Steadfast webhooks require header `X-Webhook-Secret` matching `STEADFAST_WEBHOOK_SECRET` (in production).
- Set `CORS_ORIGIN` to your frontend origin(s). In production, unset CORS defaults to deny.

## Deploy to Cloudflare

### Backend (Workers + D1)

```bash
cd backend
npx wrangler login
npx wrangler d1 create order-management
# put the returned database_id into wrangler.toml
npm run db:remote
npx wrangler secret put AUTH_SECRET
npx wrangler secret put STEADFAST_WEBHOOK_SECRET
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put STEADFAST_API_KEY
npx wrangler secret put STEADFAST_SECRET_KEY
# Set ENVIRONMENT=production and CORS_ORIGIN=https://your-pages-domain in wrangler.toml [vars]
# Remove ALLOW_SIMULATE_WEBHOOK / ALLOW_INSECURE_WEBHOOK for production
npm run deploy
```

API URL example: `https://order-management-api.<account>.workers.dev`

### Frontend (Pages)

```bash
cd frontend
# set production API URL
echo "VITE_API_BASE_URL=https://order-management-api.<account>.workers.dev" > .env.production
npm run build
npx wrangler pages deploy dist --project-name order-management
```

Steadfast webhook (send secret in `X-Webhook-Secret`):
`https://order-management-api.<account>.workers.dev/api/steadfast/webhook`

## Backup & Restore

Settings → **Backup** tab:
- **Download Full Backup** → JSON with orders + inventory + redacted config
- **Restore from Backup File** → replaces **this tenant’s** DB data only

API (auth required):
- `GET /api/backup`
- `POST /api/backup/restore`

## Auth API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| POST | `/api/auth/signup` | Creates Free plan shop owner |
| GET | `/api/auth/me` | Current user (Bearer token) |

| Method | Path |
|--------|------|
| GET | `/api/health` |
| GET/POST/DELETE | `/api/orders` … |
| POST | `/api/ai/process-order` |
| POST | `/api/steadfast/send` |
| POST | `/api/steadfast/webhook` |
| GET | `/api/steadfast/status/:parcelId` |
| GET/POST | `/api/config/*` |
| GET/POST | `/api/inventory` … |
| GET/POST | `/api/couriers/*` |
| GET | `/api/customers` |
| GET | `/api/customers/export?format=csv\|xlsx` |
| GET/POST | `/api/customers/categories` |
| GET | `/api/customers/:phoneKey` |

Frontend calls these via `frontend/src/api.ts` (`apiFetch` + Bearer token + optional `VITE_API_BASE_URL`).

### Customers

Every order creates/updates a customer profile matched by **normalized phone** (`+8801818984883` / `01818984883` → `1818984883`). Two orders with the same phone = one customer with 2 orders. Shop owners can edit categories (New, Regular, Loyal, VIP, High Spender) by min order count and/or paid amount, then export filtered lists as CSV or Excel.
