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
