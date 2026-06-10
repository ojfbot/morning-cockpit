import { describe, it, expect } from 'vitest';
import { encodeSseFrame } from '../sse.js';

describe('encodeSseFrame', () => {
  it('emits event line, JSON data line, and a blank-line terminator', () => {
    const frame = encodeSseFrame('token', { text: 'hello' });
    expect(frame).toBe('event: token\ndata: {"text":"hello"}\n\n');
  });

  it('JSON-encoding keeps newlines inside one data line (no frame split)', () => {
    const frame = encodeSseFrame('token', { text: 'line1\nline2' });
    const lines = frame.split('\n');
    expect(lines).toHaveLength(4); // event, data, '', '' (trailing)
    expect(lines[1]).toContain('line1\\nline2');
  });

  it('round-trips structured done/fallback payloads', () => {
    const frame = encodeSseFrame('done', { finish: 'fallback' });
    const data = frame.split('\n')[1]!.replace(/^data: /, '');
    expect(JSON.parse(data)).toEqual({ finish: 'fallback' });
  });
});
