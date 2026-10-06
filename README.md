# Neighborly demo

A local React prototype for an AI video companion experience for older adults. The Tavus CVI integration is intentionally limited to starting, joining, participating in, and ending one live conversation.

## Run locally

```bash
npm install
cp .env.example .env
# Add your Tavus API key and configured PAL ID to .env.
npm run dev:all
```

Create a production build with:

```bash
npm run build
```

The browser opens on Vite's local URL (normally `http://localhost:5173`) and the local API listens only on `http://127.0.0.1:3001`.

## Tavus configuration

`TAVUS_API_KEY` and companion identifiers stay server-side in `.env`; they are not bundled into the browser or logged. Configure:

- `TAVUS_API_KEY`: API key created in Tavus PAL Maker.
- `TAVUS_PAL_ID`: a PAL with a default Face is recommended. Configure it as a clearly identified AI companion: warm, concise, one question at a time, comfortable with pauses, and without therapy claims.
- `TAVUS_FACE_ID`: only needed when the selected PAL has no default Face; a Face ID alone is also supported for basic testing.

To test the live path, select microphone/camera preferences, choose **Join the conversation**, approve browser permissions, then use the in-call controls. **End call** leaves the browser room and asks the local server to call Tavus’s normal conversation-end endpoint. If Tavus cleanup cannot be confirmed, the UI says so and offers a retry rather than claiming the call ended.

The custom Daily UI does not yet consume Tavus closed-caption events. Captions remain clearly marked unavailable in this local UI; Tavus’s hosted room supports them.

## Demo flow

The existing gardening/memory/recap screens remain fictional prototype material and are not generated from a live Tavus call. Saved fictional memories persist in browser storage until **Reset demo** is used.

No database, real memory persistence, live recap generation, authentication, webhooks, or external messaging is included in this milestone.
