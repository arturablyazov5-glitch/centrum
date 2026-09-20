import { CENTRUM_CONFIG } from './centrum-config.js';

export async function submitPreorder(payload) {
  const { endpoint, method } = CENTRUM_CONFIG.preorder;
  if (!endpoint) {
    localStorage.setItem('centrum-preorder-draft', JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
    return { ok: true, draft: true };
  }
  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { ok: true, draft: false };
}
