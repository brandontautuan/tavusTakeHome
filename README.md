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

The browser opens on Vite's local URL (normally `http://localhost:5173`) and the local API listens only on `http://127.0.0.1:3001`. Vite proxies `/api` to that server (see `vite.config.ts`), so the browser only ever calls its own origin. `npm run check` type-checks the app, the server, and the Vite config.

## Tavus configuration

`TAVUS_API_KEY` and companion identifiers stay server-side in `.env`; they are not bundled into the browser or logged. Configure:

- `TAVUS_API_KEY`: API key created in Tavus PAL Maker.
- `TAVUS_PAL_ID`: a PAL with a default Face is recommended. Configure it as a clearly identified AI companion: warm, concise, one question at a time, comfortable with pauses, and without therapy claims.
- `TAVUS_FACE_ID`: only needed when the selected PAL has no default Face; a Face ID alone is also supported for basic testing.

To test the live path, select microphone/camera preferences, optionally type a topic, choose **Join the conversation**, approve browser permissions, then use the in-call controls. The topic is sent to Tavus as `conversational_context` for that conversation. When the camera is on, a mirrored self-view shows what the companion sees.

**End call** leaves the browser room and asks the local server to call Tavus’s normal conversation-end endpoint. If Tavus cleanup cannot be confirmed, the UI says so and offers a retry rather than claiming the call ended. Leaving any other way (browser Back, closing the tab) sends a best-effort end request so the Tavus session is not left running.

The custom Daily UI does not yet consume Tavus closed-caption events, and the call screen says captions are not available; Tavus’s hosted room supports them.

## Demo flow

Ending a call opens a **sample recap**: fictional gardening details, labelled as a sample, that show how reviewing, editing, saving, and forgetting remembered details works. None of it is generated from the live Tavus call. Choices persist in browser storage until **Reset demo** (in the page footer, with a confirmation) is used.

No database, real memory persistence, live recap generation, authentication, webhooks, or external messaging is included in this milestone.

## Structure

- `src/main.tsx`: app shell, hash-based screens (`#setup`, `#call`, `#recap`, `#memories`), and the home, setup, recap, and remembered-details screens.
- `src/LiveCall.tsx`: the Daily call surface, loaded only when a call starts.
- `src/tavusClient.ts`: the integration boundary for starting and ending conversations.
- `src/store.ts`: the persistence boundary (browser storage) and the fictional sample data.
- `src/styles.css`: design tokens and all styles. The UI is light-theme only.
- `server.ts`: local Express server that holds the Tavus credentials.
