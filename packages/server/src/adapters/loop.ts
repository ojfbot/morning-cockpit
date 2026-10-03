import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  buildCaptureHealth,
  buildOdometerFreshness,
  buildPopulationFunnels,
  buildSkillBreakdown,
  countDispositions,
  parseDispositionLines,
  parseMovementLines,
  computeStaleDays,
  type AdapterHealth,
  type DispositionEvent,
  type LoopSnapshot,
  type HygieneStatus,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readHygiene(): HygieneStatus {
  const script = path.join(config.delivery.coreRoot, 'scripts', 'codex-automation-status.mjs');
  if (!existsSync(script)) return { kind: 'unavailable', reason: 'core Codex automation reader is not installed' };
  try {
    const raw: unknown = JSON.parse(execFileSync('node', [script], {
      encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'],
    }));
    if (!isRecord(raw)) return { kind: 'unavailable', reason: 'Codex automation reader returned invalid data' };
    if (raw.configured === 'disabled') {
      return { kind: 'disabled', reason: typeof raw.reason === 'string' ? raw.reason : 'Codex automation paused' };
    }
    if (raw.configured !== 'configured') {
      return { kind: 'unavailable', reason: typeof raw.reason === 'string' ? raw.reason : 'Codex configuration unavailable' };
    }
    const schedule = raw.schedule;
    if (!isRecord(schedule) || typeof schedule.targetThreadId !== 'string') {
      return { kind: 'unavailable', reason: 'Codex schedule details unavailable' };
    }
    const nextRunAt = typeof schedule.nextRunAt === 'string' ? schedule.nextRunAt : undefined;
    const receipt = isRecord(raw.receipt) ? raw.receipt : undefined;
    let firing: HygieneStatus & { kind: 'configured' };
    // The union is built only after boundary validation. No Selfco file mtime can mark it fired.
    if ((raw.firing === 'succeeded' || raw.firing === 'failed') &&
        receipt && typeof receipt.threadId === 'string' &&
        typeof receipt.observedAt === 'string' && typeof receipt.status === 'string') {
      firing = { kind: 'configured', scheduler: 'Codex', targetThreadId: schedule.targetThreadId,
        nextRunAt, firing: { kind: raw.firing, runId: receipt.threadId,
          observedAt: receipt.observedAt, status: receipt.status }, output: 'unverified' };
    } else if (raw.firing === 'missed' && nextRunAt) {
      firing = { kind: 'configured', scheduler: 'Codex', targetThreadId: schedule.targetThreadId,
        nextRunAt, firing: { kind: 'missed', nextRunAt }, output: 'unverified' };
    } else if (raw.firing === 'never-fired') {
      firing = { kind: 'configured', scheduler: 'Codex', targetThreadId: schedule.targetThreadId,
        nextRunAt, firing: { kind: 'never-fired', nextRunAt }, output: 'unverified' };
    } else {
      firing = { kind: 'configured', scheduler: 'Codex', targetThreadId: schedule.targetThreadId,
        nextRunAt, firing: { kind: 'unknown' }, output: 'unverified' };
    }
    return firing;
  } catch {
    return { kind: 'unavailable', reason: 'Codex automation reader or local database inaccessible' };
  }
}

export function buildLoopSnapshot(now = new Date()): LoopSnapshot {
  const { events, health: dispositionsHealth } = readDispositions();
  const { movements, health: odometerHealth } = readOdometer();
  const audit = probeAudit(now);

  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);
  return {
    generatedAt: now.toISOString(),
    hygiene: readHygiene(),
    capture: buildCaptureHealth(events, now, config.loop.staleDays),
    funnel: {
      allTime: countDispositions(events),
      last14d: countDispositions(events, fourteenDaysAgo),
    },
    populations: buildPopulationFunnels(events, now),
    // ADR-0095 honesty contract at the read-model: rates stay suppressed until the
    // S6 capture-quality artifact exists on disk. Counts are always shown.
    rateVerified: existsSync(config.loop.captureQualityFile),
    skills: buildSkillBreakdown(events, config.loop.topSkills),
    odometer: buildOdometerFreshness(movements, now),
    audit: { mtime: audit.mtime, daysSince: audit.daysSince },
    health: { dispositions: dispositionsHealth, odometer: odometerHealth, audit: audit.health },
  };
}
