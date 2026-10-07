import type { DemoStore, Memory } from './types';

const KEY = 'neighborly-fictional-demo-v1';

export const emptyStore = (): DemoStore => ({ memories: [], hasVisited: false });

export const newParticipantTag = () => `neighborly_${crypto.randomUUID().split('-').join('')}`;

// Replaceable persistence boundary: a real API would implement the same load/save pair.
export const repository = {
  load(): DemoStore {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '');
      if (!data || !Array.isArray(data.memories)) return emptyStore();
      // A save interrupted by a reload never finished, so offer it again rather than leave it spinning.
      const memories = data.memories.map((m: Memory) => (m.saving === 'saving' ? { ...m, saving: 'failed' } : m));
      const participantTag = typeof data.profile?.participantTag === 'string' ? data.profile.participantTag : newParticipantTag();
      const name = typeof data.profile?.name === 'string' ? data.profile.name.slice(0, 80) : undefined;
      return { ...data, memories, hasVisited: Boolean(data.hasVisited), profile: { participantTag, ...(name ? { name } : {}) } };
    } catch {
      return emptyStore();
    }
  },
  save(data: DemoStore): boolean {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },
};

export const SAMPLE_CONVERSATION_ID = 'demo-garden-01';

export const sampleSuggestion = (): Memory => ({
  id: 'garden-' + Date.now(),
  text: 'Enjoys gardening and growing tomatoes.',
  category: 'Interests',
  conversationId: SAMPLE_CONVERSATION_ID,
  approval: 'pending',
  saving: 'idle',
  createdAt: new Date().toISOString(),
});
