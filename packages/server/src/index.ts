import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { buildSnapshot } from './aggregate.js';
import { summaryRouter } from './routes/summary.js';
import { readingRouter } from './routes/reading.js';
import { papersRouter } from './routes/papers.js';
import { chatRouter } from './routes/chat.js';
import { briefingRouter } from './routes/briefing.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(summaryRouter);
app.use(readingRouter);
app.use(papersRouter);
app.use(chatRouter);
app.use(briefingRouter);

// Read-only cockpit snapshot: three lanes + per-adapter health.
app.get('/api/cockpit', async (_req, res) => {
  try {
    const snapshot = await buildSnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Health alone (cheap to poll, surfaces adapter status).
app.get('/api/health', async (_req, res) => {
  try {
    const snapshot = await buildSnapshot();
    res.json({ generatedAt: snapshot.generatedAt, health: snapshot.health });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(config.port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`morning-cockpit read-model on http://127.0.0.1:${config.port}`);
});
