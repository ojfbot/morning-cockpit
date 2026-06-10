/**
 * Tiny SSE frame parser over a fetch() body. EventSource can't POST a body, so the chat
 * streams through fetch + ReadableStream and we parse the standard SSE frames ourselves.
 */

export interface SseEvent {
  event: string;
  data: unknown;
}

function parseFrame(frame: string): SseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}

export async function* streamSse(res: Response): AsyncGenerator<SseEvent> {
  if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const evt = parseFrame(buf.slice(0, sep));
      buf = buf.slice(sep + 2);
      if (evt) yield evt;
    }
  }
}
