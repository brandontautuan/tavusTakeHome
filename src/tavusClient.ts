import type { TavusConversation, TavusMemorySnapshot } from './types';

// The only place the browser knows where the conversation API lives. Vite proxies /api to the local server.
const BASE = '/api/tavus/conversations';

async function errorFrom(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return new Error(typeof body.error === 'string' ? body.error : fallback);
}

export const tavusClient = {
  async start(topic: string, participantTag: string, name?: string): Promise<TavusConversation> {
    const response = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, participantTag, name }) }).catch(() => null);
    if (!response) throw new Error('The conversation service could not be reached. Check your connection, then try again.');
    if (!response.ok) throw await errorFrom(response, 'The conversation could not be started. Please try again.');
    return response.json();
  },
  async end(conversationId: string): Promise<void> {
    const response = await fetch(`${BASE}/${encodeURIComponent(conversationId)}/end`, { method: 'POST' });
    if (!response.ok) throw await errorFrom(response, 'The conversation could not be confirmed as ended.');
  },
  async memory(participantTag: string): Promise<TavusMemorySnapshot> {
    const response = await fetch(`/api/tavus/memory?participantTag=${encodeURIComponent(participantTag)}`).catch(() => null);
    if (!response) throw new Error('The remembered-details service could not be reached.');
    if (!response.ok) throw await errorFrom(response, 'Could not read remembered details.');
    return response.json();
  },
  // Best-effort end for exits that cannot wait on a response: tab close, Back button, navigation.
  endOnExit(conversationId: string) {
    const url = `${BASE}/${encodeURIComponent(conversationId)}/end`;
    if (!navigator.sendBeacon?.(url)) fetch(url, { method: 'POST', keepalive: true }).catch(() => undefined);
  },
};
