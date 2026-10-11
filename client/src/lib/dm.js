import { api } from './api.js';

export async function openConversation(navigate, userId, prefill) {
  const { conversation } = await api('/conversations', { method: 'POST', body: { userId } });
  navigate(`/messages/${conversation.id}`, { state: prefill ? { prefill } : undefined });
}
