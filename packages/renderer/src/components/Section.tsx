import type { ReactNode } from 'react';

/**
 * A numbered cockpit department. Editorial section-header pattern: a mono red kicker
 * (`04 — WORK`) above a big headline, a two-line mono caption on the right, and a 3px
 * ink bottom rule. The cockpit is a vertical stack of these.
 */
export function Section({
  index,
  kicker,
  title,
  subtitle,
  caption,
  actions,
  children,
}: {
  /** Department number, e.g. "04". */
  index?: string;
  /** Mono kicker label, e.g. "WORK". Falls back to the upper-cased title. */
  kicker?: string;
  title: string;
  /** Single-line caption (legacy callers). Ignored when `caption` is given. */
  subtitle?: string;
  /** Rich right-hand caption (two mono lines). */
  caption?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const kick = kicker ?? title.toUpperCase();
  return (
    <section className="section">
      <header className="section-header">
        <div className="section-head-left">
          <span className="section-kicker">
            {index ? `${index} — ${kick}` : kick}
          </span>
          <h2 className="section-headline">{title}</h2>
        </div>
        <div className="section-head-right">
          {caption ?? (subtitle && <span className="section-caption">{subtitle}</span>)}
          {actions}
        </div>
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}
