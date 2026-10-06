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

app.post('/api/tavus/conversations', async (req, res) => {
  const error = configurationError();
  if (error) return res.status(503).json({ error });
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim().slice(0, 500) : '';

  try {
    const tavusResponse = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey! },
      body: JSON.stringify({
        ...(palId ? { pal_id: palId } : {}),
        ...(faceId ? { face_id: faceId } : {}),
        conversation_name: topic ? 'Neighborly conversation' : 'Neighborly local conversation',
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

app.listen(port, '127.0.0.1', () => console.log(`Neighborly local Tavus API listening on http://127.0.0.1:${port}`));
