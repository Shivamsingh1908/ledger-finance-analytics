# Ledger Frontend

React, TypeScript, Fluent UI, TanStack Query, React Hook Form, Zod, and Chart.js. See the [project README](../README.md) for API startup, sample data, configuration, verification status, and deferred deployment work.

Run from this directory:

```powershell
npm ci
npm run dev
```

Open http://localhost:5173 with the API running on http://localhost:5080. Leave `VITE_API_BASE_URL` unset locally so API requests and refresh cookies use the Vite proxy.

```powershell
npm run lint
npm test
npm run build
```

Playwright verification is paused. The known mobile Transactions overflow remains unresolved; see the root README before resuming browser tests.
