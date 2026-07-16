import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  buildCaptureHealth,
  buildOdometerFreshness,
  buildSkillBreakdown,
  countDispositions,
  parseDispositionLines,
  parseMovementLines,
  computeStaleDays,
  type AdapterHealth,
  type DispositionEvent,
  type LoopSnapshot,
  type Movement,
} from '@cockpit/shared';
import { config } from '../config.js';

/**
 * Loop adapter (read-only) — assembles the self-improvement telemetry loop from three
 * independent sources, each degrading gracefully into its own health entry:
 *
 *   dispositions  ~/selfco/tracking/skill-dispositions.jsonl — core's shadow-mode OPAV
 *                 hooks; absent file → empty capture, truthfully labeled
 *   odometer      core/decisions/northstar/status.jsonl — read independently of the
 *                 delivery adapter so the two panes degrade separately
 *   audit         weekly skill-architecture-audit output — mtime probe only, no exec
 *
 * NEVER writes. The pane's job is to make the funnel's zeros visible, not improve them.
 */

function readDispositions(): { events: DispositionEvent[]; health: AdapterHealth } {
  const health: AdapterHealth = { name: 'loop-dispositions', status: 'up', itemCount: 0 };
  const file = path.join(config.loop.trackingRoot, 'skill-dispositions.jsonl');
  try {
    if (!existsSync(file)) {
      health.note = 'skill-dispositions.jsonl does not exist yet — no capture recorded';
      return { events: [], health };
    }
    const { events, skipped } = parseDispositionLines(readFileSync(file, 'utf8'));
    health.itemCount = events.length;
    health.note = skipped
      ? `${events.length} events · ${skipped} malformed line(s) skipped`
      : `${events.length} events`;
    if (skipped) health.status = 'degraded';
    return { events, health };
  } catch (err) {
    health.status = 'down';
    health.lastError = err instanceof Error ? err.message : String(err);
    return { events: [], health };
  }
}

function readOdometer(): { movements: Movement[]; health: AdapterHealth } {
  const health: AdapterHealth = { name: 'loop-odometer', status: 'up', itemCount: 0 };
  const file = path.join(config.delivery.coreRoot, 'decisions', 'northstar', 'status.jsonl');
  try {
    if (!existsSync(file)) {
      health.note = 'status.jsonl does not exist yet — no movement recorded';
      return { movements: [], health };
    }
    const { movements, skipped } = parseMovementLines(readFileSync(file, 'utf8'));
    health.itemCount = movements.length;
    health.note = skipped
      ? `${movements.length} movements · ${skipped} malformed line(s) skipped`
      : `${movements.length} movements`;
    if (skipped) health.status = 'degraded';
    return { movements, health };
  } catch (err) {
    health.status = 'down';
    health.lastError = err instanceof Error ? err.message : String(err);
    return { movements: [], health };
  }
}

function probeAudit(now: Date): { mtime?: string; daysSince?: number; health: AdapterHealth } {
  const health: AdapterHealth = { name: 'loop-audit', status: 'up', itemCount: 0 };
  try {
    if (!existsSync(config.loop.auditFile)) {
      health.note = 'no audit output yet';
      return { health };
    }
    const mtime = statSync(config.loop.auditFile).mtime.toISOString();
    health.itemCount = 1;
    health.note = `audit output present · mtime ${mtime}`;
    return { mtime, daysSince: computeStaleDays(mtime, now), health };
  } catch (err) {
    health.status = 'down';
    health.lastError = err instanceof Error ? err.message : String(err);
    return { health };
  }
}

export function buildLoopSnapshot(now = new Date()): LoopSnapshot {
  const { events, health: dispositionsHealth } = readDispositions();
  const { movements, health: odometerHealth } = readOdometer();
  const audit = probeAudit(now);

  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);
  return {
    generatedAt: now.toISOString(),
    capture: buildCaptureHealth(events, now, config.loop.staleDays),
    funnel: {
      allTime: countDispositions(events),
      last14d: countDispositions(events, fourteenDaysAgo),
    },
    skills: buildSkillBreakdown(events, config.loop.topSkills),
    odometer: buildOdometerFreshness(movements, now),
    audit: { mtime: audit.mtime, daysSince: audit.daysSince },
    health: { dispositions: dispositionsHealth, odometer: odometerHealth, audit: audit.health },
  };
}
