import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RepoCard } from '@cockpit/shared';
import { RepoCardView } from '../RepoCardView.js';

const repo: RepoCard = {
  name: 'cv-builder',
  role: 'Resume builder',
  phase: 'P6',
  openCount: 3,
  lastActivity: null,
  liveness: 'dark',
};

function renderCard(props?: Partial<Parameters<typeof RepoCardView>[0]>) {
  const onSelect = vi.fn();
  render(
    <RepoCardView repo={repo} selected={false} onSelect={onSelect} relativeTime={() => 'now'} {...props} />,
  );
  return { onSelect };
}

describe('RepoCardView (F1) — interactive selector', () => {
  it('calls onSelect(name) when clicked', async () => {
    const { onSelect } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: /cv-builder/i }));
    expect(onSelect).toHaveBeenCalledWith('cv-builder');
  });

  it('is keyboard-reachable — Enter selects', async () => {
    const { onSelect } = renderCard();
    screen.getByRole('button', { name: /cv-builder/i }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('cv-builder');
  });

  it('reflects selection via aria-pressed + the highlight class', () => {
    renderCard({ selected: true });
    const card = screen.getByRole('button', { name: /cv-builder/i });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(card.className).toContain('repo-card--here');
  });
});
