import express, { type Express } from 'express';
import cors from 'cors';
import { createYoga } from 'graphql-yoga';
import type { CockpitSnapshot } from '@cockpit/shared';
import { buildSnapshot } from './aggregate.js';
import { buildReadModelGraphSchema } from './schema/graph.js';
import { cockpitReadModelSource } from './schema/source.js';
import { summaryRouter } from './routes/summary.js';
import { readingRouter } from './routes/reading.js';
import { papersRouter } from './routes/papers.js';
import { chatRouter } from './routes/chat.js';
import { briefingRouter } from './routes/briefing.js';
import { fleetRouter } from './routes/fleet.js';
import { deliveryRouter } from './routes/delivery.js';
import { fleetStructureRouter } from './routes/fleet-structure.js';
import { loopRouter } from './routes/loop.js';
import { claimRouter } from './routes/claim.js';

export type SnapshotBuilder = () => Promise<CockpitSnapshot>;

/** Construct the HTTP app without listening; the optional seam is test-only and adds no route. */
export function createApp(snapshot: SnapshotBuilder = buildSnapshot): Express {
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
  app.use(deliveryRouter);
  app.use(fleetStructureRouter);
  app.use(loopRouter);
  app.use(claimRouter);

  app.get('/api/cockpit', async (_req, res) => {
    try {
      res.json(await snapshot());
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.get('/api/health', async (_req, res) => {
    try {
      const result = await snapshot();
      res.json({ generatedAt: result.generatedAt, health: result.health });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  return app;
}
