-- @cockpit/watch ledger (ADR-0016).
--
-- A superset of the schema specified in the Stage-1 handoff: seen_items keeps every
-- specified column, including `score` as the composite, so the contract is additive.
--
-- Lives at packages/watch/.data/watch.sqlite — .data/ is already gitignored, matching
-- packages/server/.data/. Regenerable: delete it and the next run refills from the feeds,
-- losing only "have I seen this" history.

CREATE TABLE IF NOT EXISTS seen_items (
  -- Canonical dedup key: canonicalized URL, or arxiv:<id> / gh:<sha> / hn:<objectID>.
  id               TEXT PRIMARY KEY,
  source           TEXT NOT NULL,
  url              TEXT NOT NULL,
  title            TEXT NOT NULL,
  published_at     TEXT,
  first_seen       TEXT NOT NULL,
  -- Composite score. In practice never NULL: a row is written only for items that were
  -- actually scored, because ledger.record() is called inside the candidate loop.
  --
  -- That is deliberate, and it is the difference between "seen" and "surfaced". An item the
  -- prefilter cut was never read and never briefed, so recording it would permanently bury
  -- it — on a budget-limited backfill the ledger would silently swallow items that merely
  -- lost a scheduling race. Leaving it unrecorded lets it compete again next run, and it
  -- ages out naturally with the --since window.
  --
  -- The cost: `runs.items_new` does not decay for an item that keeps losing, and a rubric
  -- re-tune (see scores.rubric_version) will NOT re-surface an item already scored below
  -- threshold. Both are accepted for Stage 1.
  score            REAL,
  staged_to_notion INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_seen_items_published ON seen_items (published_at);
CREATE INDEX IF NOT EXISTS idx_seen_items_source ON seen_items (source);

-- Per-dimension scores. Kept in a separate table because the handoff's seen_items contract
-- is fixed, and because "what did the rubric think" is the thing we most need to audit when
-- the brief surfaces something wrong.
CREATE TABLE IF NOT EXISTS scores (
  item_id        TEXT PRIMARY KEY REFERENCES seen_items (id),
  relevance      REAL,
  actionability  REAL,
  novelty        REAL,
  authority      REAL,
  composite      REAL,
  -- Bump on any rubric change so a re-tune is detectable rather than silent.
  rubric_version TEXT,
  provider       TEXT,
  scored_at      TEXT,
  -- One line, grounded in fetched text. Never written from the title alone.
  why            TEXT,
  -- 'full' | 'thin' — whether the score saw real article prose or only feed metadata.
  text_quality   TEXT
);

-- Run ledger. Exists because of .handoff/20260618-brief-launchd-processes-panel.md:
-- a scheduled job can be loaded, exit 0, and do nothing. A run that fetched zero feeds must
-- be distinguishable from a run that found nothing new.
CREATE TABLE IF NOT EXISTS runs (
  started_at   TEXT PRIMARY KEY,
  finished_at  TEXT,
  status       TEXT,
  feeds_ok     INTEGER,
  feeds_failed INTEGER,
  items_new    INTEGER,
  items_staged INTEGER
);
