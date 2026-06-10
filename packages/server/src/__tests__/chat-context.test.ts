import { describe, it, expect } from 'vitest';
import { isPathInside } from '../chat-context.js';

describe('isPathInside (attachment path guard)', () => {
  const root = '/Users/me/ojfbot';

  it('accepts paths inside the repo root', () => {
    expect(isPathInside(root, '/Users/me/ojfbot/core/.handoff/brief.md')).toBe(true);
  });

  it('rejects the root itself, siblings, and .. escapes', () => {
    expect(isPathInside(root, '/Users/me/ojfbot')).toBe(false);
    expect(isPathInside(root, '/Users/me/other/secret.md')).toBe(false);
    expect(isPathInside(root, '/Users/me/ojfbot/../.ssh/id_rsa')).toBe(false);
    expect(isPathInside(root, '/Users/me/ojfbot/core/../../.ssh/id_rsa')).toBe(false);
  });

  it('rejects prefix-collision siblings (ojfbot-evil)', () => {
    expect(isPathInside(root, '/Users/me/ojfbot-evil/x.md')).toBe(false);
  });
});
