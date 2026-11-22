# Entry: frontend

Angular 22 PWA for the entrance residents app: feed, chat, polls, residents, notifications and admin.
The backend lives in `../entry` (Spring Boot). Page designs come from `docs/pages/entrance-app-html-templates.txt`.

## Run

### Everything in Docker (recommended)
From the backend folder:
```bash
cd ../entry
docker compose up -d --build     # postgres + backend + this frontend
./scripts/seed-demo.sh           # optional: demo accounts and sample content
```
Open **http://localhost:4200**. This is the production build served by nginx, with the service worker and offline support.

### Dev server (hot reload)
```bash
cd ../entry && docker compose up -d postgres backend   # API on :8080
cd "../entry FE"
npm install
npm start                        # http://localhost:4200, proxies /api and /ws to :8080
```
The service worker (offline mode, push) is disabled in the dev server. Use the Docker build to test PWA features.

## Demo accounts (after `seed-demo.sh`)
| Email | Password | Role |
|---|---|---|
| ana@entry.local | password123 | Entrance admin |
| marko@entry.local | password123 | Resident |
| jelena@entry.local | password123 | Resident |
| petar@entry.local | password123 | Pending approval (approve him as Ana) |

## How it works
- **Auth:** the access token is kept in memory, and the refresh token is an httpOnly cookie. On load, the app restores
  the session with `/api/auth/refresh`. `core/auth.interceptor.ts` adds the bearer token, and on a 401 it refreshes
  once and retries the request.
- **Routing:** `memberGuard` (approved members), `pendingGuard` (the "waiting for approval" page), `adminGuard`.
  Pages are lazy loaded.
- **Real time:** `core/realtime.service.ts` keeps one STOMP connection (`@stomp/rx-stomp`) at `/ws`, authenticated
  on CONNECT. Pages subscribe to their entrance topics (feed, chat, polls, presence), and notifications arrive on
  `/user/queue/notifications`.
- **Same origin:** `/api` and `/ws` are proxied (`proxy.conf.json` in dev, `nginx.conf` in Docker), so the refresh
  cookie and the signed image URLs work without CORS.
- **PWA:** `ngsw-config.json` caches the app shell, recent API responses (freshness) and images (performance).
  An offline screen appears when the connection drops. Web Push uses `SwPush`; enable it on **My profile**
  (the backend needs VAPID keys).
- **Subscriptions:** `core/billing.service.ts` and `subscriptionGuard`. While the entrance is paused (trial over,
  no subscription), admins only see **Subscription** (`/billing`: Stripe Checkout and Billing Portal) and residents
  see `/locked`. Admins get a banner in the last week of the trial.
- **State:** signals everywhere (zoneless Angular), standalone components, the new control flow.

## Structure
```
src/app/
  core/       api.service, auth (service, interceptor, guards), realtime, presence, notifications, push, models
  shared/     avatar, post-card, lightbox, toasts, offline overlay, time-ago pipe
  layout/     shell (top bar, sidebar, bottom nav)
  pages/      auth (login, register, pending), feed (feed, post sheet, create post), chat, polls,
              residents (list, profile), profile, notifications, admin, billing (subscription, locked), misc (404)
```

## Differences from the HTML templates
To match the API:
- Floor and Apartment are separate fields.
- Creating an entrance asks for a name **and** an address.
- The poll "Duration" dropdown is turned into an expiry timestamp, and "No end date" is also offered.
- A post can have up to 10 photos (the template said 6).
