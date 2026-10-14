import { readFileSync } from 'node:fs';
import type { CodegenConfig } from '@graphql-codegen/cli';
import {
  buildSchema,
  getNamedType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  printType,
  type GraphQLNamedType,
} from 'graphql';

// Filter the existing generator's input to the governed inspector closure. No Query,
// operation, args, resolver or unrelated facade type enters the neutral model target.
const sdl = readFileSync('src/schema/read-model.graphql', 'utf8');
const schema = buildSchema(sdl);
const closure = new Map<string, GraphQLNamedType>();
function include(type: GraphQLNamedType): void {
  if (
    closure.has(type.name) ||
    ['String', 'Int', 'Float', 'Boolean', 'ID'].includes(type.name)
  )
    return;
  closure.set(type.name, type);
  if (isObjectType(type) || isInterfaceType(type))
    for (const field of Object.values(type.getFields()))
      include(getNamedType(field.type));
  if (isUnionType(type))
    for (const variant of type.getTypes()) include(variant);
}
for (const name of ['evidenceSummary', 'evidenceIndex', 'evidenceRecord']) {
  const field = schema.getQueryType()?.getFields()[name];
  if (!field) throw new Error(`Missing inspector query ${name}`);
  include(getNamedType(field.type));
}
const inspection = schema.getType('InspectionTarget');
if (!inspection) throw new Error('Missing inspection target');
include(inspection);
const inspectorSdl = [...closure.values()]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(printType)
  .join('\n');
const config: CodegenConfig = {
  generates: {
    '../shared/src/internal/inspector-model.ts': {
      schema: inspectorSdl,
      plugins: ['typescript'],
      config: {
        enumsAsTypes: true,
        nonOptionalTypename: true,
        avoidOptionals: true,
        useTypeImports: true,
        scalars: { ID: 'string', Absent: { input: 'never', output: 'never' } },
        enumValues: {
          ResolvedTaskDocumentLinkStatus: { resolved: 'resolved' },
          UnavailableTaskDocumentLinkStatus: {
            target_source_unavailable: 'target-source-unavailable',
          },
          AbsentTaskDocumentLinkStatus: {
            target_not_observed_in_scope: 'target-not-observed-in-scope',
          },
          AmbiguousTaskDocumentLinkStatus: {
            target_ambiguous: 'target-ambiguous',
          },
          IncompatibleTaskDocumentLinkStatus: {
            target_kind_incompatible: 'target-kind-incompatible',
          },
          InvalidTaskDocumentLinkStatus: {
            invalid_declaration: 'invalid-declaration',
          },
          DoltRecordKind: { dolt_bead_v1: 'dolt-bead-v1' },
          HandoffRecordKind: { handoff_document_v1: 'handoff-document-v1' },
          DoltSource: { dolt_bead: 'dolt-bead' },
          HandoffSource: { handoff_bead: 'handoff-bead' },
          EvidenceSource: {
            dolt_bead: 'dolt-bead',
            handoff_bead: 'handoff-bead',
          },
          ModelGenerationKind: { model_generation: 'model-generation' },
          HumanInteractionKind: {
            human_edit: 'human-edit',
            human_approval: 'human-approval',
          },
          LegacyUnknownStatus: { legacy_unknown: 'legacy-unknown' },
          RefreshStatus: { refresh_required: 'refresh-required' },
          MissingStatus: { record_not_observed: 'record-not-observed' },
          InvalidReferenceStatus: { invalid_reference: 'invalid-reference' },
          SourceUnavailableStatus: { source_unavailable: 'source-unavailable' },
          MissingTargetDiagnosticReason: {
            target_not_observed: 'target-not-observed',
          },
          AmbiguousTargetDiagnosticReason: {
            target_matches_multiple_records: 'target-matches-multiple-records',
          },
          SuccessorOrderDiagnosticReason: {
            successor_order_unresolved: 'successor-order-unresolved',
          },
          RelationCycleDiagnosticReason: { relation_cycle: 'relation-cycle' },
        },
      },
    },
    'src/schema/__generated__/read-model.ts': {
      schema: 'src/schema/read-model.graphql',
      plugins: ['typescript'],
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
        skipTypename: true,
        scalars: { ID: 'string', Absent: { input: 'never', output: 'never' } },
      },
    },
  },
};
export default config;
