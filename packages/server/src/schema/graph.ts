import type { GraphQLSchema } from 'graphql';
import { createSchema } from 'graphql-yoga';
import { readVendoredSdl } from './contract-check.js';
import { makeResolvers } from './resolvers.js';
import type { ReadModelSource } from './source.js';

/**
 * Build the read-model GraphQL schema: the vendored core SDL (G0) + the resolver map, bound to a
 * {@link ReadModelSource}. The schema is a plain `GraphQLSchema` — transport-agnostic, so the
 * eventual standalone lean graph service hosts the SAME schema with no rewrite (ADR-0011 trajectory).
 */
export function buildReadModelGraphSchema(source: ReadModelSource): GraphQLSchema {
  return createSchema({
    typeDefs: readVendoredSdl(),
    resolvers: makeResolvers(source),
  });
}
