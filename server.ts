import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT || 3001);
const apiKey = process.env.TAVUS_API_KEY;
const palId = process.env.TAVUS_PAL_ID;
const faceId = process.env.TAVUS_FACE_ID;
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',');
const createdConversationIds = new Set<string>();

app.use(cors({ origin(origin, done) { done(null, !origin || allowedOrigins.includes(origin)); } }));
app.use(express.json({ limit: '2kb' }));

function configurationError() {
  if (!apiKey) return 'Tavus is not configured. Add TAVUS_API_KEY to .env.';
  if (!palId && !faceId) return 'Tavus is not configured. Add TAVUS_PAL_ID (recommended) or TAVUS_FACE_ID to .env.';
  return null;
}

app.get('/api/tavus/config', (_req, res) => {
  const error = configurationError();
  res.status(error ? 503 : 200).json({ configured: !error, error: error || undefined });
});

const sensitiveMemoryKey = /(emotion|sentiment|score|diagnos|clinical|medical|health)/i;
function readableLabel(key: string) { return key.split('_').join(' ').replace(/\b\w/g, letter => letter.toUpperCase()); }
function safeFacts(profile: unknown, prefix = ''): string[] {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return [];
  return Object.entries(profile as Record<string, unknown>).flatMap(([key, value]) => {
    if (sensitiveMemoryKey.test(key)) return [];
    const label = prefix ? `${prefix} · ${readableLabel(key)}` : readableLabel(key);
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [`${label}: ${String(value)}`];
    return safeFacts(value, label);
  }).slice(0, 6);
}

app.get('/api/tavus/memory', async (req, res) => {
  const participantTag = typeof req.query.participantTag === 'string' ? req.query.participantTag.trim() : '';
  const error = configurationError();
  if (error) return res.status(503).json({ error });
  if (!palId || !/^[A-Za-z0-9_-]{1,120}$/.test(participantTag)) return res.status(400).json({ error: 'A valid participant identifier is required.' });
  try {
    const search = new URLSearchParams({ pal_id: palId, participant_tag: participantTag });
    const storesResponse = await fetch(`https://tavusapi.com/v2/memory-stores?${search}`, { headers: { 'x-api-key': apiKey! } });
    const stores = await storesResponse.json().catch(() => ({}));
    if (!storesResponse.ok) return res.status(storesResponse.status).json({ error: stores.error || stores.message || 'Could not read Tavus memory.' });
    const memoryStoreId = Array.isArray(stores.data) ? stores.data[0]?.memory_store_id : undefined;
    if (typeof memoryStoreId !== 'string') return res.json({ state: 'missing', facts: [] });
    const learnedResponse = await fetch(`https://tavusapi.com/v2/memory-stores/${encodeURIComponent(memoryStoreId)}/learned`, { headers: { 'x-api-key': apiKey! } });
    const learned = await learnedResponse.json().catch(() => ({}));
    if (!learnedResponse.ok) return res.status(learnedResponse.status).json({ error: learned.error || learned.message || 'Could not read learned Tavus memory.' });
    const recent = Array.isArray(learned.timeline?.recent_conversations) ? learned.timeline.recent_conversations : [];
    const lastSummary = typeof recent[0]?.summary === 'string' ? recent[0].summary.slice(0, 500) : undefined;
    const facts = safeFacts(learned.profile);
    return res.json({ state: facts.length || lastSummary ? 'ready' : 'processing', facts, ...(lastSummary ? { lastSummary } : {}) });
  } catch {
    return res.status(502).json({ error: 'Could not reach Tavus to read remembered details.' });
  }
});

app.post('/api/tavus/conversations', async (req, res) => {
  const error = configurationError();
  if (error) return res.status(503).json({ error });
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim().slice(0, 500) : '';
  const participantTag = typeof req.body?.participantTag === 'string' ? req.body.participantTag.trim() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(participantTag)) return res.status(400).json({ error: 'A valid local participant identifier is required to start a conversation.' });
  const context = [
    name ? `The visitor prefers to be called ${name}.` : '',
    topic ? `Before the call, the visitor said they might like to talk about: ${topic}` : '',
    'You are a warm AI companion. Keep responses concise and ask one question at a time. When the visitor clearly says they are leaving, going to an activity, or says goodbye, offer one brief warm farewell and then use the built-in end_call tool. Do not claim to provide therapy or to monitor the visitor.',
  ].filter(Boolean).join('\n');

  try {
    const tavusResponse = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey! },
      body: JSON.stringify({
        ...(palId ? { pal_id: palId } : {}),
        ...(faceId ? { face_id: faceId } : {}),
        conversation_name: 'Neighborly conversation',
        participant_tags: [participantTag],
        dynamic_greeting: true,
        conversational_context: context,
      }),
    });
    const data = await tavusResponse.json().catch(() => ({}));
    if (!tavusResponse.ok) return res.status(tavusResponse.status).json({ error: data.message || data.error || 'Tavus could not create the conversation.' });
    if (typeof data.conversation_id !== 'string' || typeof data.conversation_url !== 'string') return res.status(502).json({ error: 'Tavus returned an incomplete conversation response.' });
    createdConversationIds.add(data.conversation_id);
    return res.status(201).json({ conversationId: data.conversation_id, conversationUrl: data.conversation_url, status: data.status });
  } catch {
    return res.status(502).json({ error: 'Could not reach Tavus. Check your network and try again.' });
  }
});

app.post('/api/tavus/conversations/:conversationId/end', async (req, res) => {
  const { conversationId } = req.params;
  if (!createdConversationIds.has(conversationId)) return res.status(404).json({ error: 'This local server did not create that conversation.' });
  if (!apiKey) return res.status(503).json({ error: 'Tavus is not configured.' });
  try {
    const tavusResponse = await fetch(`https://tavusapi.com/v2/conversations/${encodeURIComponent(conversationId)}/end`, { method: 'POST', headers: { 'x-api-key': apiKey } });
    if (tavusResponse.status === 204 || tavusResponse.ok) { createdConversationIds.delete(conversationId); return res.status(204).send(); }
    const data = await tavusResponse.json().catch(() => ({}));
    return res.status(tavusResponse.status).json({ error: data.message || data.error || 'Tavus could not end the conversation.' });
  } catch {
    return res.status(502).json({ error: 'Could not reach Tavus to end the conversation. You left the browser room; retry to confirm Tavus cleanup.' });
  }
});

const server = app.listen(port, '127.0.0.1', (startupError?: Error) => {
  if (startupError) return;
  // Explicitly retain the listener. This matters when running under process managers
  // that otherwise allow an idle development server to exit after startup.
  server.ref();
  console.log(`Neighborly local Tavus API listening on http://127.0.0.1:${port}`);
});

server.on('error', (error) => {
  console.error('Neighborly local Tavus API could not start:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
