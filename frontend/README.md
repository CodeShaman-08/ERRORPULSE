# ErrorPulse Dashboard

React + Vite frontend for [ErrorPulse](../README.md), a self-hosted error monitoring service.

## Development

```bash
npm install
npm run dev
```

The dashboard talks to the API at `http://localhost:2000` by default. Copy `.env.example` to
`.env` to point it somewhere else:

```env
VITE_API_URL=http://localhost:2000/api/v1
VITE_SOCKET_URL=http://localhost:2000
```

## Build

```bash
npm run build     # outputs to dist/
npm run preview
```

See the [root README](../README.md) for the full architecture, API reference, and setup guide.
