import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

/** Cloud Claude transport — explicit opt-in only (COCKPIT_SUMMARY_PROVIDER=claude). */
export async function claudeChat(system: string, user: string): Promise<{ text: string; model: string }> {
  const { apiKey, model } = config.summary.claude;
  if (!apiKey) throw new Error('claude provider: ANTHROPIC_API_KEY not set');

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model,
    max_tokens: config.summary.maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return { text, model };
}

/**
 * Full-PDF deep-dive transport — attaches the paper PDF (by URL) as a document content block so
 * Claude reads the actual paper (figures/methods/limitations), not just the abstract. Opt-in,
 * uses a stronger model than the cheap summary tier. Throws if no API key.
 */
export async function claudeDeepDive(
  pdfUrl: string,
  system: string,
  user: string,
  opts: { model: string; maxTokens: number; timeoutMs: number },
): Promise<{ text: string; model: string }> {
  const { apiKey } = config.summary.claude;
  if (!apiKey) throw new Error('claude deep-dive: ANTHROPIC_API_KEY not set');

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create(
    {
      model: opts.model,
      max_tokens: opts.maxTokens,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'url', url: pdfUrl } },
            { type: 'text', text: user },
          ],
        },
      ],
    },
    { timeout: opts.timeoutMs },
  );
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return { text, model: opts.model };
}
