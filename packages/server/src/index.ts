import express from 'express';
import cors from 'cors';
import { createYoga } from 'graphql-yoga';
import { config } from './config.js';
import { buildSnapshot } from './aggregate.js';
import { buildReadModelGraphSchema } from './schema/graph.js';
import { cockpitReadModelSource } from './schema/source.js';
import { summaryRouter } from './routes/summary.js';
import { readingRouter } from './routes/reading.js';
import { papersRouter } from './routes/papers.js';
import { chatRouter } from './routes/chat.js';
import { briefingRouter } from './routes/briefing.js';
import { fleetRouter } from './routes/fleet.js';
import { claimRouter } from './routes/claim.js';

// Read-model GraphQL facade (ADR-0011/0013) — query-only, beside REST. Yoga does its own body
// parsing, so it is mounted BEFORE express.json() (which would otherwise consume the request stream).
// GraphiQL explorer is dev-only.
const yoga = createYoga({
  schema: buildReadModelGraphSchema(cockpitReadModelSource),
  graphqlEndpoint: '/graphql',
  graphiql: process.env.NODE_ENV !== 'production',
});

const app = express();
app.use(cors());
app.use(yoga.graphqlEndpoint, yoga);
app.use(express.json());
app.use(summaryRouter);
app.use(readingRouter);
app.use(papersRouter);
app.use(chatRouter);
app.use(briefingRouter);
app.use(fleetRouter);
app.use(claimRouter);

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
