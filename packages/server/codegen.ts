import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Codegen the read-model facade types FROM the vendored core SDL (ADR-0013). The generated file is
 * committed; CI re-runs this and fails on any diff (regenerate-diff gate), so the types can never
 * drift from the contract. Schema input is the vendored copy (kept byte-identical to core by the
 * vendored-parity gate). No GraphQL server is wired here — that is G1.
 */
const config: CodegenConfig = {
  schema: 'src/schema/read-model.graphql',
  generates: {
    'src/schema/__generated__/read-model.ts': {
      plugins: ['typescript'],
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
        skipTypename: true,
        scalars: { ID: 'string' },
      },
    },
  },
};

export default config;
