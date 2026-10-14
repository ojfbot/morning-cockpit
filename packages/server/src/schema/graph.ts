import { parse, type GraphQLSchema } from 'graphql';
import { createSchema } from 'graphql-yoga';
import { readVendoredSdl } from './contract-check.js';
import { makeResolvers } from './resolvers.js';
import type { ReadModelSource } from './source.js';

/**
 * Build the read-model GraphQL schema: the vendored core SDL (G0) + the resolver map, bound to a
 * {@link ReadModelSource}. The schema is a plain `GraphQLSchema` — transport-agnostic, so the
 * eventual standalone lean graph service hosts the SAME schema with no rewrite (ADR-0011 trajectory).
 */
export function buildReadModelGraphSchema(
  source: ReadModelSource,
): GraphQLSchema {
  const sdl = readVendoredSdl();
  const enums = Object.fromEntries(
    parse(sdl).definitions.flatMap((definition) =>
      definition.kind === 'EnumTypeDefinition'
        ? [
            [
              definition.name.value,
              Object.fromEntries(
                (definition.values ?? []).map((value) => [
                  value.name.value,
                  value.name.value.replaceAll('_', '-'),
                ]),
              ),
            ],
          ]
        : [],
    ),
  );
  // Existing relation enums use underscores literally.
  delete enums.ReferenceRelation;
  delete enums.ClosingRelation;
  return createSchema({
    typeDefs: sdl,
    resolvers: {
      ...enums,
      Absent: {
        serialize: () => {
          throw new Error('Absent must be null');
        },
        parseValue: () => {
          throw new Error('Absent must be null');
        },
        parseLiteral: () => {
          throw new Error('Absent must be null');
        },
      },
      ...makeResolvers(source),
    },
  });
}
