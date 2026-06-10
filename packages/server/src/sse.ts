import type { Response } from 'express';

/**
 * Minimal server-sent-events helpers for the chat stream. Standard SSE framing so the
 * endpoint stays inspectable with `curl -N`.
 */

/** Pure frame encoder (unit-tested): `event:` + JSON `data:` + blank-line terminator. */
export function encodeSseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function sseInit(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

export function sseSend(res: Response, event: string, data: unknown): void {
  res.write(encodeSseFrame(event, data));
}

export function sseEnd(res: Response): void {
  res.end();
}
