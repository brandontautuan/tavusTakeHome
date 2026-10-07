# Neighborly demo

A local React prototype for an AI video companion experience for older adults. It starts and ends real Tavus CVI calls, and uses a browser-local visitor ID to give one PAL continuity across future calls.

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

On a first visit, optionally enter the name the companion should use and choose microphone/camera preferences. The app remembers those local choices, so later presses of **Start a conversation** go straight to the live call; use **Change how you join** on Home when needed. The app creates and persists a browser-local stable participant ID, then sends it as Tavus `participant_tags` on every later conversation with the same PAL. Tavus can build learned continuity for that relationship after completed calls. The topic and a concise companion behavior instruction are sent as `conversational_context` for that conversation. When the camera is on, a mirrored self-view shows what the companion sees.

**End call** leaves the browser room and asks the local server to call Tavus’s normal conversation-end endpoint. If Tavus cleanup cannot be confirmed, the UI says so and offers a retry rather than claiming the call ended. Leaving any other way (browser Back, closing the tab) sends a best-effort end request so the Tavus session is not left running. The PAL is also instructed to give a brief farewell and invoke Tavus’s built-in `end_call` when the visitor clearly says they are leaving.

The custom Daily UI does not yet consume Tavus closed-caption events, and the call screen says captions are not available; Tavus’s hosted room supports them.

## Continuity and limits

When a live call ends, the app returns home instead of showing the old fictional gardening recap. Home reads the current participant’s Tavus learned profile and most recent conversation summary through the server-only API, omitting clinical, emotional, and score-like fields. Tavus learned memory is asynchronous; use **Refresh remembered details** after a completed call if processing has not finished yet.

No database, custom memory-approval tool, live recap generation, authentication, webhooks, or external messaging is included in this milestone.

## Structure

- `src/main.tsx`: app shell, hash-based screens (`#setup`, `#call`, `#recap`, `#memories`), and the home, setup, recap, and remembered-details screens.
- `src/LiveCall.tsx`: the Daily call surface, loaded only when a call starts.
- `src/tavusClient.ts`: the integration boundary for starting and ending conversations.
- `src/store.ts`: the browser-local visitor profile and persistence boundary.
- `src/styles.css`: design tokens and all styles. The UI is light-theme only.
- `server.ts`: local Express server that holds the Tavus credentials.
