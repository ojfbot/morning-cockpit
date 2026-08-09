# fleet-navigator prototype (2026-08-08/09)

- `fleet-navigator.html` — the built, self-contained artifact. Open from disk; the only network
  call is the popover's "Ask Leo" → POST http://localhost:3040/api/chat (cockpit server).
- `fleet-navigator.template.html` — source before diagram inlining (`<!--SVG:dN-->` placeholders).
- `d1..d4-*.mmd` — Mermaid sources (canon copies live in ~/selfco/diagrams/fleet-map.md as D5–D8).
- Build: render each .mmd with `pnpm dlx @mermaid-js/mermaid-cli -i dN.mmd -o dN.svg -c <config
  with securityLevel:strict, htmlLabels:false>`, then replace each placeholder with the SVG text.

Data is a hand-compiled 2026-08-08 snapshot of core's northstar/roadmap registry, wayfinder maps,
and ~/selfco wiki counts — see fleet-navigator-rfi-response.md (A9/C14–C20) for every reader.
