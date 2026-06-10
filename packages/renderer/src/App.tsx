import { useEffect, useState } from 'react';
import type { CockpitSnapshot } from '@cockpit/shared';
import { fetchCockpit } from './api.js';
import { Lane } from './components/Lane.js';
import { Section } from './components/Section.js';
import { ReadingSection } from './components/ReadingSection.js';
import { PapersSection } from './components/PapersSection.js';
import { ThemeToggle } from './components/ThemeToggle.js';
import { HealthBar } from './components/HealthBar.js';
import { ChatSidebar } from './components/chat/ChatSidebar.js';

const POLL_MS = 60_000;

export function App() {
  const [snapshot, setSnapshot] = useState<CockpitSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const controller = new AbortController();
      try {
        const snap = await fetchCockpit(controller.signal);
        if (active) {
          setSnapshot(snap);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      }
      return () => controller.abort();
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const overnightSince = snapshot ? new Date(snapshot.overnightSince) : null;

  return (
    <div className="cockpit">
      <header className="cockpit-header">
        <h1 className="cockpit-title">Morning Cockpit</h1>
        <div className="cockpit-header-right">
          <span className="cockpit-meta">
            {error ? (
              <span className="accent">read-model unreachable — {error}</span>
            ) : snapshot ? (
              <>
                {snapshot.meta.totalItems} items · overnight since{' '}
                <span className="accent">
                  {overnightSince?.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            ) : (
              'loading…'
            )}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className="cockpit-body">
        <main className="sections">
          <Section title="Beads" subtitle="across all projects — overnight · pickup · available">
            <div className="lanes">
              <Lane lane="overnight" items={snapshot?.lanes.overnight ?? []} summary={snapshot?.summaries.overnight} />
              <Lane lane="pickup" items={snapshot?.lanes.pickup ?? []} summary={snapshot?.summaries.pickup} />
              <Lane lane="available" items={snapshot?.lanes.available ?? []} summary={snapshot?.summaries.available} />
            </div>
          </Section>
          <ReadingSection />
          <PapersSection />
          {/* Add more cockpit sections here as <Section title="…">…</Section> */}
        </main>
        <ChatSidebar />
      </div>

      {snapshot && <HealthBar health={snapshot.health} />}
    </div>
  );
}
