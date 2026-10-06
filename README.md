# Neighborly demo

A frontend-only, fictional prototype for an AI video companion experience for older adults.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Demo flow

Start a conversation, use the labeled demo controls to introduce the gardening story, then approve or edit the proposed memory. End the call to review the recap and optional next step. Saved fictional memories persist in browser storage until **Reset demo** is used.

The application intentionally has no real video, Tavus, authentication, backend, or messaging integration. Those belong at the typed session/event/persistence boundaries in `src/main.tsx`.
