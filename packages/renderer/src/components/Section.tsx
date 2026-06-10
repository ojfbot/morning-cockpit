import type { ReactNode } from 'react';

/**
 * A cockpit "bubble" — a titled container that groups related content. The cockpit is a
 * vertical stack of these; add a new section by rendering another <Section> in App.
 */
export function Section({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {subtitle && <span className="panel-sub">{subtitle}</span>}
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
