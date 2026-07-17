import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { WorkItem } from '@cockpit/shared';
import { WorkItemCard } from '../WorkItemCard.js';

function item(over: Partial<WorkItem>): WorkItem {
  return {
    id: 'handoff-bead:x',
    nativeId: 'x',
    source: 'handoff-bead',
    kind: 'brief',
    status: 'open',
    lane: 'pickup',
    title: 'A brief',
    activityAt: '2026-07-17T22:00:00Z',
    detail: { kind: 'brief', openHook: true },
    provenance: {},
    ...over,
  };
}

describe('WorkItemCard — decided-in-flight chain (S8)', () => {
  it('renders the folded predecessor under a decided → in flight marker', () => {
    render(
      <WorkItemCard
        item={item({
          title: "Pick up: Evolve morning-cockpit's northstar",
          chain: [
            {
              nativeId: '20260628-2015-brief-northstar-control-surface',
              title: 'Evolve the northstar',
              url: 'file:///tmp/predecessor.md',
              state: 'decided-in-flight',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('decided → in flight')).toBeDefined();
    const pred = screen.getByText('Evolve the northstar');
    expect(pred.getAttribute('href')).toBe('file:///tmp/predecessor.md');
  });

  it('renders no chain block for a normal item', () => {
    render(<WorkItemCard item={item({ title: 'Plain brief' })} />);
    expect(screen.queryByText('decided → in flight')).toBeNull();
  });
});
