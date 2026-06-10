import { config } from '../config.js';

/**
 * Self-hosted Ollama transport (local-first default). /api/chat with format:'json' to
 * constrain output. Returns raw model text + model id. Throws on any failure.
 */
export async function ollamaChat(system: string, user: string): Promise<{ text: string; model: string }> {
  const { url, model } = config.summary.ollama;
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      options: { temperature: 0.3, num_predict: config.summary.maxTokens },
    }),
    signal: AbortSignal.timeout(config.summary.timeoutMs),
  });
  if (!res.ok) throw new Error(`ollama ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content ?? '';
  if (!text) throw new Error('ollama returned empty content');
  return { text, model };
}

/**
 * Streaming variant for Cockpit Chat: /api/chat with stream:true (free-form text, NOT
 * format:'json'), NDJSON lines relayed token-by-token via onToken. Throws on any failure —
 * the route maps a throw to one honest `fallback` SSE event (no retry, no cloud cascade).
 */
export async function ollamaChatStream(
  messages: Array<{ role: string; content: string }>,
  onToken: (text: string) => void,
): Promise<{ model: string; finish: 'stop' | 'length' }> {
  const { url, model } = config.summary.ollama;
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages,
      options: { temperature: 0.4, num_predict: config.summary.maxTokens },
    }),
    signal: AbortSignal.timeout(config.summary.timeoutMs),
  });
  if (!res.ok || !res.body) throw new Error(`ollama ${res.status} ${res.statusText}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finish: 'stop' | 'length' = 'stop';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const data = JSON.parse(line) as { message?: { content?: string }; done?: boolean; done_reason?: string };
      const t = data.message?.content;
      if (t) onToken(t);
      if (data.done && data.done_reason === 'length') finish = 'length';
    }
  }
  return { model, finish };
}
