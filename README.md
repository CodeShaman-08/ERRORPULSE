# ErrorPulse

**Self-hosted error monitoring and crash analytics for Node.js / Express applications.**

ErrorPulse captures exceptions from your backend, groups identical crashes into a single
issue using a fingerprint hash, stores every individual occurrence, and streams updates to a
real-time React dashboard where developers can triage issues as `UNRESOLVED`, `IN_PROGRESS`,
or `RESOLVED`.

Think of it as a lightweight, self-hosted alternative to Sentry for small teams.

---

## Table of contents

- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [SDK integration](#sdk-integration)
- [API reference](#api-reference)
- [How error grouping works](#how-error-grouping-works)
- [Real-time events](#real-time-events)
- [Data model](#data-model)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [License](#license)

---

## How it works

```
  Your Express app                     ErrorPulse backend                     Dashboard
 ┌──────────────────┐   POST /ingest   ┌────────────────────┐   Socket.IO   ┌───────────────┐
 │  ErrorPulse SDK  │ ───────────────► │  Ingest Controller │ ────────────► │  React + Vite │
 │  (SDK/index.js)  │   x-api-key      │        │           │  live events  │   (frontend)  │
 └──────────────────┘                  │        ▼           │               └───────────────┘
                                       │  fingerprint hash  │                       ▲
                                       │        │           │                       │
                                       │        ▼           │      REST polling     │
                                       │  ┌───────────┐     │ ──────────────────────┘
                                       │  │  MongoDB  │     │
                                       │  │ issues +  │     │
                                       │  │  events   │     │
                                       │  └───────────┘     │
                                       └────────────────────┘
```

1. **Capture** – the SDK installs `uncaughtException` / `unhandledRejection` handlers and
   exposes an Express error middleware. It filters noisy errors locally (e.g. `401`, `404`,
   "jwt expired") so nothing is sent over the network.
2. **Ingest** – `POST /api/v1/ingest` validates the project API key, computes a fingerprint,
   and performs one atomic MongoDB upsert that increments the issue counter and refreshes its
   metadata, then writes a detailed `ErrorEvent` record.
3. **Notify** – the ingest controller emits `new_error_event` / `issue_updated` to the
   `developers-room` Socket.IO room.
4. **Triage** – the dashboard lists issues, shows full stack traces and the last 50
   occurrences, and lets you change status; status changes are broadcast to every connected
   developer in real time.

---

## Features

- **Automatic exception capture** via SDK global handlers and Express middleware
- **Smart local filtering** – ignore by HTTP status code, message pattern (string/regex), or a
  custom `beforeSend` callback; ignored errors never hit the network
- **Fingerprint-based grouping** – identical crashes collapse into one issue with a counter,
  first-seen and last-seen timestamps
- **Per-occurrence event log** – route, HTTP method, request headers, and user context for each
  crash (last 50 shown in the UI)
- **Project / branch API keys** – each app (branch) gets its own `ep_…` key
- **Real-time dashboard** – Socket.IO pushes new errors and status changes instantly
- **Analytics** – totals by status, total crash events, and top 5 failing routes
- **Search, status filters, and pagination** on the issue list
- **Graceful dashboard UX** – loading skeletons, empty states, error banners, keyboard `Esc`
  to close the issue drawer, copy stack trace

---

## Tech stack

| Layer     | Technology                                                     |
| --------- | -------------------------------------------------------------- |
| Backend   | Node.js, Express 5, Mongoose 9, Socket.IO 4                    |
| Database  | MongoDB (Atlas or local)                                       |
| SDK       | Node.js, Axios                                                 |
| Frontend  | React 19, Vite 8, Axios, Socket.IO client, lucide-react, CSS   |

---

## Project structure

```
errorpulse/
├── server.js                     # HTTP + Socket.IO server entry point
├── src/
│   ├── app.js                    # Express app, route mounting, health check
│   ├── config/db.js              # MongoDB connection
│   ├── controllers/
│   │   ├── ingestController.js   # Error ingestion + grouping
│   │   ├── issueController.js    # List / detail / status updates
│   │   ├── branchController.js   # Project registration + API keys
│   │   └── analyticsController.js# Dashboard stats + top routes
│   ├── models/
│   │   ├── issue.model.js        # Grouped issue
│   │   ├── errorevent.model.js   # Single occurrence
│   │   └── branch.model.js       # App/project + API key
│   ├── routes/                   # Express routers
│   └── utils/fingerprint.js      # MD5 fingerprint generator
├── SDK/index.js                  # Client SDK for Node/Express apps
└── frontend/                     # React dashboard (Vite)
```

---

## Getting started

### Prerequisites

- Node.js 18+ (tested on Node 22)
- A MongoDB instance (local or MongoDB Atlas)

### 1. Backend

```bash
# from the project root
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

Edit `.env`:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/errorpulse
PORT=2000
```

Then start the API:

```bash
npm run dev     # nodemon, auto-restarts
# or
npm start
```

Check it is alive: <http://localhost:2000/health> → `{"status":"OK"}`

> If you use MongoDB Atlas, add your current IP under **Network Access** in the Atlas console,
> otherwise the connection will time out and the process exits.

### 2. Register your first project (branch)

```bash
curl -X POST http://localhost:2000/api/v1/branches \
  -H "Content-Type: application/json" \
  -d '{"branchName":"my-api","environment":"production"}'
```

The response contains the generated `apiKey` (`ep_…`). Use it in the SDK.

### 3. Frontend dashboard

```bash
cd frontend
npm install
npm run dev
```

Open the printed URL (usually <http://localhost:5173>). The dashboard expects the API on
`http://localhost:2000`; override with `VITE_API_URL` / `VITE_SOCKET_URL` in
`frontend/.env` if needed.

---

## SDK integration

```js
import express from 'express';
import ErrorPulse from './SDK/index.js';

const app = express();

const pulse = ErrorPulse.init({
  apiKey: 'ep_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  serverUrl: 'http://localhost:2000',
  environment: 'production',

  // Optional: noise filtering (defaults shown)
  ignoreStatus: [400, 401, 403, 404],
  ignoreErrors: [/jwt expired/i, /invalid credentials/i, /unauthorized/i],

  // Optional: mutate or drop payloads before sending
  beforeSend: (payload, error) => {
    if (payload.route === '/health') return null; // null = do not send
    return payload;
  },
});

// Report errors from Express route handlers
app.use(pulse.expressErrorHandler());

app.get('/boom', (req, res) => {
  throw new Error('Something exploded');
});

app.listen(3001);
```

`uncaughtException` and `unhandledRejection` are captured automatically once an API key is
provided. You can also report manually:

```js
await pulse.captureException(new Error('Manual report'), {
  route: '/checkout',
  httpMethod: 'POST',
  userContext: { id: 'user_123' },
});
```

---

## API reference

Base URL: `http://localhost:2000/api/v1`

| Method  | Endpoint                  | Description                                              |
| ------- | ------------------------- | -------------------------------------------------------- |
| `POST`  | `/ingest`                 | Ingest an error. Requires `x-api-key` header.            |
| `GET`   | `/issues`                 | List issues. Query: `status`, `page`, `limit` (default 20). |
| `GET`   | `/issues/:id`             | Issue detail + 50 most recent events.                    |
| `PATCH` | `/issues/:id/status`      | Body `{ "status": "UNRESOLVED" \| "IN_PROGRESS" \| "RESOLVED" }` |
| `GET`   | `/branches`               | List registered apps (includes API keys).                |
| `POST`  | `/branches`               | Body `{ "branchName", "environment" }` → creates API key. |
| `GET`   | `/analytics/stats`        | Total / unresolved / in-progress / resolved / events.    |
| `GET`   | `/analytics/top-routes`   | Top 5 routes by crash count.                             |
| `GET`   | `/health`                 | Liveness probe (outside `/api/v1`).                      |

### Ingest payload

```json
{
  "message": "Cannot read properties of undefined (reading 'id')",
  "stack": "TypeError: ...\n    at handler (/app/routes/user.js:12:5)",
  "environment": "production",
  "route": "/api/users/42",
  "httpMethod": "GET",
  "headers": { "user-agent": "..." },
  "userContext": { "id": "user_123" },
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

---

## How error grouping works

`src/utils/fingerprint.js` builds an MD5 hash from:

1. the lower-cased, trimmed error message, and
2. the **first stack frame** with line/column numbers stripped.

This means the same bug keeps the same fingerprint even if code shifts a few lines, while
different messages or different call sites stay separate. The fingerprint is `unique` in the
`issue` collection, so the ingest upsert is atomic and race-safe.

---

## Real-time events

The server joins every socket to the `developers-room` room.

| Event                  | Emitted when                       | Payload                                            |
| ---------------------- | ---------------------------------- | -------------------------------------------------- |
| `new_error_event`      | First occurrence of an issue       | `{ issueId, title, count, status, lastSeen, … }`   |
| `issue_updated`        | A repeat occurrence                | Same shape                                         |
| `issue_status_changed` | Status updated (REST or socket)    | `{ issueId, status }`                              |

The dashboard listens to all three and refetches the issue list.

---

## Data model

**branch** – `branchName`, `apiKey` (unique), `environment` (`development` / `staging` / `production`)

**issue** – `fingerprint` (unique), `title`, `stackTrace`, `count`, `status`, `firstSeen`,
`lastSeen`, timestamps

**errorevent** – `issueId`, `branchId`, `route`, `httpMethod`, `headers`, `userContext`,
timestamps

---

## Security notes

- **Never commit `.env`.** This repository ships `.env.example` only; `.env` is git-ignored.
- `POST /branches` and all dashboard endpoints are **unauthenticated** – they are meant for a
  trusted internal network or a private deployment. Add auth before exposing them publicly.
- `GET /branches` returns API keys; treat that endpoint as sensitive.
- CORS is currently open (`cors()` / `origin: '*'`). Restrict it for production.
- The ingest endpoint accepts client-supplied headers and user context. Redact secrets in the
  SDK's `beforeSend` before sending.
- If a database password was ever shared or committed, rotate it in MongoDB Atlas.

### Production checklist

- [ ] Rotate the MongoDB password and store `MONGO_URI` in a secret manager
- [ ] Restrict CORS to your dashboard origin
- [ ] Put the API behind HTTPS and add authentication / rate limiting
- [ ] Set `NODE_ENV=production` and use `npm start`
- [ ] Build the dashboard with `npm run build` and serve `frontend/dist`

---

## Known limitations

- No authentication or multi-tenancy yet; one deployment = one team.
- Issue list page size is fixed by the `limit` query parameter (default 20, not hard-capped).
- No retention policy: `errorevent` documents grow forever, so add a TTL index for production.
- `issue.status` is reset to `UNRESOLVED` whenever a new occurrence arrives, so a resolved
  issue reopens automatically if it happens again.
- The dashboard has no test suite; `npm test` is a placeholder.

---

## License

ISC
