import type { AdapterHealth } from '@cockpit/shared';

export function HealthBar({ health }: { health: AdapterHealth[] }) {
  return (
    <footer className="health">
      {health.map((h) => (
        <span className="health-item" key={h.name} title={h.lastError ?? h.note ?? ''}>
          <span className={`health-dot ${h.status}`} />
          {h.name}: {h.status}
          {h.note ? ` — ${h.note}` : ''}
        </span>
      ))}
    </footer>
  );
}
