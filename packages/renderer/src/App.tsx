import { useCallback, useEffect, useState } from 'react';
import type { CockpitSnapshot } from '@cockpit/shared';
import { fetchCockpit } from './api.js';
import { Lane } from './components/Lane.js';
import { Section } from './components/Section.js';
import { ReadingSection } from './components/ReadingSection.js';
import { PapersSection } from './components/PapersSection.js';
import { Masthead } from './components/Masthead.js';
import { HealthBar } from './components/HealthBar.js';
import { Briefing } from './components/briefing/Briefing.js';
import { FleetSection } from './components/FleetSection.js';
import { CriticalPathSection } from './components/CriticalPathSection.js';
import { DeliverySection } from './components/DeliverySection.js';
import { ChatSidebar } from './components/chat/ChatSidebar.js';
import { applyRootAttributes, loadState, saveState, type CockpitUiState } from './cockpitState.js';

const POLL_MS = 60_000;

export function App() {
  const [snapshot, setSnapshot] = useState<CockpitSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState<CockpitUiState>(loadState);

  // Reflect the presentation axes onto <html> and persist the whole UI state.
  useEffect(() => {
    applyRootAttributes(ui);
    saveState(ui);
  }, [ui]);

  const toggleTheme = useCallback(
    () => setUi((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })),
    [],
  );
  const toggleDensity = useCallback(
    () => setUi((s) => ({ ...s, density: s.density === 'compact' ? 'comfortable' : 'compact' })),
    [],
  );

  // Refetch the snapshot — used by the 60s poll AND as the onClaimed callback so a claim
  // reflects immediately rather than waiting for the next tick (no mutation→refetch path existed).
  const reload = useCallback(async () => {
    try {
      const snap = await fetchCockpit();
      setSnapshot(snap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  return (
    <div className="cockpit">
      <Masthead
        snapshot={snapshot}
        theme={ui.theme}
        onToggleTheme={toggleTheme}
        density={ui.density}
        onToggleDensity={toggleDensity}
        error={error}
      />

      <div className="cockpit-body">
        <main className="sections">
          <Briefing ui={ui} setUi={setUi} />
          <FleetSection
            selectedRepo={ui.selectedRepo}
            onSelectRepo={(name) => setUi((s) => ({ ...s, selectedRepo: name }))}
          />
          <CriticalPathSection setUi={setUi} />
          <DeliverySection />
          <Section
            index="04"
            kicker="WORK"
            title="Beads"
            caption={
              <span className="section-caption">
                across all projects
                <br />
                overnight · pickup · available
              </span>
            }
          >
            <div className="lanes">
              <Lane lane="overnight" items={snapshot?.lanes.overnight ?? []} summary={snapshot?.summaries.overnight} />
              <Lane lane="pickup" items={snapshot?.lanes.pickup ?? []} summary={snapshot?.summaries.pickup} />
              <Lane lane="available" items={snapshot?.lanes.available ?? []} summary={snapshot?.summaries.available} onClaimed={reload} />
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
