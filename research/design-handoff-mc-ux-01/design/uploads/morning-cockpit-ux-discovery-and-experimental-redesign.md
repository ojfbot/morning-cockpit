# Morning Cockpit — UX Discovery and Experimental Redesign

**Project:** Morning Cockpit / OJF Botfleet  
**Recipient:** Claude Design  
**Engagement:** Product discovery, UX audit, information architecture, and experimental prototyping  
**Status:** Exploration authorized; production redesign not yet authorized

## 1. Mission

Morning Cockpit has evolved into an information-dense interface spanning projects, agents, conversations, pending actions, and operational activity across the OJF Botfleet.

Its current presentation is dominated by long stretches of text, technical terminology, and information structures that may reflect the underlying implementation more than the way a human actually thinks, plans, and works.

Your assignment is **not to make the existing interface prettier.**

Your assignment is to discover what Morning Cockpit could become if designed around:

- Human attention, comprehension, and decision-making.
- Meaningful relationships across projects, agents, conversations, and actions.
- Daily routines and sustainable working habits.
- Progressive disclosure rather than overwhelming information density.
- Turning accumulated information into useful decisions and actions.
- A reinforcing cycle of reviewing, deciding, acting, learning, and improving.

Treat the existing application as a working prototype containing valuable real-world data, not as an authoritative product specification.

**Challenge its assumptions.**

## 2. Begin With the Actual Application and Its Data

Before proposing designs, inspect the Morning Cockpit codebase and the populated data available to it.

Examine the actual interfaces, data models, state management, APIs, agent integrations, and navigation.

Where practical, run the application and interact with it.

Do not restrict your audit to component structure or screenshots.

### Discover the underlying information landscape

Identify and classify the information currently surfaced by Morning Cockpit, including:

- Projects and repositories across the OJF Botfleet.
- Agents and their responsibilities.
- Conversations across different chat interfaces.
- Leo, the personal assistant, and its relationship to other agents.
- Pending actions, decisions, and follow-ups.
- Recent activity and historical context.
- Research, discoveries, and generated artifacts.
- Blockers, dependencies, and unresolved questions.
- Recurring responsibilities and emerging routines.

These are starting hypotheses, not a prescribed taxonomy.

**Derive the actual taxonomy from the populated data.**

Look for recurring patterns, relationships, duplication, inconsistencies, and opportunities to consolidate information.

Distinguish what the application knows from what it merely displays.

### Required output

Produce an evidence-based inventory of the application's information types, their relationships, and their relevance to daily use.

Identify which information is actionable, contextual, historical, or primarily diagnostic.

For each significant design conclusion, reference examples from the actual application.

Do not invent sample projects or generic placeholder content when genuine examples are available.

## 3. Discover Meaningful Clusters Across the Botfleet

One of the most important opportunities is to move beyond the current boundaries between repositories, agents, and conversations.

A single initiative may involve multiple agents, GitHub repositories, conversations, documents, and pending decisions.

The interface should help the user understand that initiative as a coherent body of work.

Explore clustering by:

**Initiative:** Everything contributing to a shared objective, regardless of originating system.

**Attention:** Items requiring a decision, intervention, review, or follow-up.

**Continuity:** Work that was recently active, interrupted, or awaiting resumption.

**Dependency:** Activities blocked by another person, agent, decision, or artifact.

**Opportunity:** Emerging connections between previously separate projects or research threads.

**Practice:** Recurring activities that could become deliberate habits.

These are candidate organizing principles. Discover additional ones from the data.

Critically, avoid confusing information proximity with meaningful relationships.

A useful cluster should answer a human question or support a decision.

Explore how clusters could be created automatically, corrected by the user, and refined over time.

## 4. Eliminate Unnecessary Jargon

The current application exposes too much language inherited from its technical architecture.

This must change.

Conduct a terminology audit of the interface.

Identify technical terms, abbreviations, internal classifications, agent terminology, and implementation details that unnecessarily increase cognitive load.

Translate them into language that communicates meaning to a human operator.

For example:

| Technical presentation | Human-centered alternative |
|---|---|
| Pending agent handoffs | Waiting for another agent |
| Unresolved dependencies | What's holding things up |
| Repository activity | What changed |
| Context synchronization | Bring me up to date |
| Execution telemetry | What happened |
| Artifact provenance | Where this came from |
| Stale work items | Things that may need attention |

These are illustrative, not mandatory replacements.

**Preserve technical precision without forcing technical complexity into the primary interface.**

Detailed provenance, telemetry, identifiers, and system metadata must remain accessible when needed.

Explore layered presentation: plain-language summaries first, supporting technical detail on demand.

The goal is not to hide complexity. It is to make complexity navigable.

## 5. Design Around Daily Habits and Practices

Morning Cockpit should become more than a dashboard visited occasionally.

It should support a sustainable daily operating practice.

Investigate how the product can create a reinforcing cycle:

**Orient → Prioritize → Act → Capture → Reflect → Improve → Repeat**

Consider several daily moments.

### Starting the day

Help the user quickly understand what has changed, what matters, what requires attention, and where to focus.

The experience should provide orientation without requiring the user to read everything.

### Entering a work session

Help the user select an initiative, recover relevant context, understand outstanding decisions, and resume meaningful work.

### Moving between projects

Support context switching without forcing the user to reconstruct the state of each initiative manually.

### Ending a session

Make it easy to capture outcomes, unresolved questions, follow-ups, and next actions.

### Reviewing progress

Help the user recognize patterns over days and weeks.

What keeps getting postponed? Which initiatives are advancing? Where is attention fragmented? Which activities produce meaningful progress?

### Developing better habits

Explore lightweight mechanisms for encouraging consistent practices.

Avoid superficial gamification, arbitrary streaks, or productivity scores without meaningful justification.

The desired flywheel is:

**Better capture produces better context. Better context produces better decisions. Better decisions produce more effective action. Effective action produces useful feedback. That feedback improves the next cycle.**

Design for this feedback loop explicitly.

## 6. Explore Multiple Radically Different UX Concepts

Do not converge immediately on a single design.

Develop **at least four genuinely distinct interaction models**, grounded in your findings.

Potential directions include:

### A. The Daily Briefing

An editorial, highly curated experience.

The system synthesizes the most important developments into a concise daily narrative, with clear opportunities to drill into details or act.

### B. Mission Control

A spatial operating environment organized around active initiatives, attention requirements, dependencies, and agent activity.

Emphasize situational awareness and intervention.

### C. The Work Graph

A relationship-driven interface connecting projects, conversations, decisions, artifacts, agents, and pending actions.

Explore whether visualizing relationships reveals useful connections obscured by existing navigation.

### D. The Adaptive Workspace

An interface that changes according to the user's current activity.

Morning orientation, focused project work, research exploration, agent coordination, and end-of-day reflection may require fundamentally different presentations.

### E. A Concept Discovered From the Data

Propose at least one additional direction that emerges from your actual audit rather than these suggestions.

These concepts must differ in information architecture and interaction philosophy, not merely visual styling.

A grid of cards, a different sidebar, and a new color palette do not constitute distinct concepts.

## 7. Build Experiments, Not Just Mockups

Create working experimental experiences that can be evaluated using the application's real information.

Prefer isolated prototype routes or clearly separated implementations.

Do not replace the existing production experience during this exploration.

Each prototype should demonstrate:

- How the user arrives and becomes oriented.
- How information is grouped and prioritized.
- How the user discovers what needs attention.
- How the user moves into meaningful action.
- How context is preserved between activities.
- How the interface supports daily practices.

Where live integration is impractical, use representative snapshots derived from actual application data.

Label any simulated functionality clearly.

Do not present fabricated interactions as working integrations.

## 8. Investigate Leo's Role

Leo, the personal assistant, should receive particular attention.

Investigate whether Leo should function primarily as a chat interface, a coordinating layer, a briefing agent, a conversational navigation mechanism, or something else.

Explore the relationship between conversational interaction and structured visual interfaces.

For example, a user might ask Leo what needs attention today, then move directly into a structured view of the relevant initiative.

Alternatively, the user might discover an issue visually and ask Leo to investigate it.

**Do not assume that chat should dominate the experience simply because agents and language models are involved.**

Investigate when conversation is genuinely useful and when direct manipulation, visual grouping, or conventional navigation is superior.

## 9. Evaluate Against Real Human Tasks

Evaluate each experimental direction using realistic scenarios discovered during the audit.

At minimum, assess whether the user can:

1. Understand the most important developments in under two minutes.
2. Identify the three most consequential actions requiring attention.
3. Resume an interrupted project without reconstructing its context manually.
4. Discover a relationship between activities in different parts of the Botfleet.
5. Understand what an agent has accomplished and what remains unresolved.
6. Complete a short daily review without excessive administrative work.
7. Find supporting technical evidence when a summary is insufficient.

Evaluate comprehension, cognitive load, navigation effort, information trustworthiness, and actionability.

Do not optimize solely for visual elegance or information density.

## 10. Deliverables

Produce the following:

**A. Current-state audit**

An evidence-based assessment of the existing experience, including major usability problems, information architecture weaknesses, jargon, and missed opportunities.

**B. Data-derived information model**

A proposed human-centered taxonomy, relationships between information types, and meaningful clustering opportunities.

**C. UX concept portfolio**

At least four distinct design directions, plus a data-derived alternative, with explanations of their underlying philosophies and trade-offs.

**D. Interactive prototypes**

Working experimental implementations that allow comparison using real application information.

**E. Habit and daily-practice model**

A proposed daily and weekly operating rhythm, including how Morning Cockpit supports the reinforcing feedback loop.

**F. Evaluation and recommendation**

A comparative assessment identifying the strongest elements of each concept.

Do not prematurely declare a single winner. Consider whether the best eventual product combines elements from several directions.

**G. Implementation roadmap**

A phased proposal for evolving the existing application without discarding valuable functionality or disrupting current workflows.

## 11. Operating Constraints

Preserve existing functionality and data integrity.

Do not perform destructive migrations or overwrite production interfaces.

Do not introduce unnecessary new infrastructure merely to support a prototype.

Respect existing architectural conventions where appropriate, but do not let implementation constraints prevent exploration of better interaction models.

Distinguish findings supported by real data from design hypotheses requiring validation.

When proposing automated classification or AI-generated summaries, consider uncertainty, source traceability, correction mechanisms, and user control.

Keep prototypes isolated and reversible.

## 12. Critical Design Principle

**Do not simply reorganize the wall of text.**

The fundamental question is not:

"How can we display all this information more attractively?"

It is:

**"Given everything this system knows about my projects, agents, conversations, commitments, and working patterns, what should it help me understand, decide, and accomplish today—and how can the experience become more useful through repeated daily use?"**

Approach Morning Cockpit as an emerging personal operating environment.

Discover its underlying product model before committing to its interface.

Experiment ambitiously.

Use the real data.

Challenge the existing structure.

Design for sustained human use, not just technical completeness.
