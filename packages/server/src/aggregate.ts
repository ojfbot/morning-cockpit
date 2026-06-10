import {
  finalizeItems,
  overnightWindowStart,
  splitLanes,
  summarizeLane,
  type AdapterHealth,
  type CockpitSnapshot,
  type LaneContext,
  type WorkItem,
} from '@cockpit/shared';
import { config } from './config.js';
import { TtlCache } from './cache.js';
import { fetchDolt } from './adapters/dolt.js';
import { fetchHandoff } from './adapters/handoff.js';

type AdapterResult = { items: WorkItem[]; health: AdapterHealth };
type Adapter = { key: keyof typeof config.ttl; run: (ctx: LaneContext) => Promise<AdapterResult> };

const adapters: Adapter[] = [
  { key: 'dolt', run: fetchDolt },
  { key: 'handoff', run: fetchHandoff },
];

const cache = new TtlCache<AdapterResult>();

/** Run one adapter through the cache; never throws (failure → down health + empty items). */
async function runAdapter(a: Adapter, ctx: LaneContext, now: number): Promise<AdapterResult> {
  const cached = cache.get(a.key, now);
  if (cached) return cached;
  let result: AdapterResult;
  try {
    result = await a.run(ctx);
  } catch (err) {
    result = {
      items: [],
      health: {
        name: a.key === 'dolt' ? 'dolt-bead' : 'handoff-bead',
        status: 'down',
        itemCount: 0,
        lastError: err instanceof Error ? err.message : String(err),
      },
    };
  }
  cache.set(a.key, result, config.ttl[a.key], now);
  return result;
}

export async function buildSnapshot(nowDate = new Date()): Promise<CockpitSnapshot> {
  const now = nowDate.getTime();
  const overnightSince = overnightWindowStart(nowDate, config.overnightBoundaryHour).toISOString();
  const ctx: LaneContext = { now: nowDate, overnightSince, staleThresholdDays: config.staleThresholdDays };

  const settled = await Promise.allSettled(adapters.map((a) => runAdapter(a, ctx, now)));

  const allItems: WorkItem[] = [];
  const health: AdapterHealth[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i]!;
    if (s.status === 'fulfilled') {
      allItems.push(...s.value.items);
      health.push(s.value.health);
    } else {
      health.push({ name: 'dolt-bead', status: 'down', itemCount: 0, lastError: String(s.reason) });
    }
  }

  const finalized = finalizeItems(allItems, ctx);
  const lanes = splitLanes(finalized);

  return {
    generatedAt: nowDate.toISOString(),
    overnightSince,
    lanes,
    health,
    summaries: {
      overnight: summarizeLane('overnight', lanes.overnight),
      pickup: summarizeLane('pickup', lanes.pickup),
      available: summarizeLane('available', lanes.available),
    },
    meta: {
      totalItems: finalized.length,
      skipped: 0,
    },
  };
}
