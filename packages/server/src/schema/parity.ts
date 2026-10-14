/**
 * SDL ↔ @cockpit/shared parity (ADR-0013 drift gate, part 3 of 3).
 *
 * The vendored read-model SDL (codegen'd into the facade) must not declare a field that has no
 * backing in the hand-authored `@cockpit/shared` view-models — that would be the silent drift
 * ADR-0011/0013 exist to kill. This checker is pure + falsifiable: a deliberate phantom SDL field
 * is reported as a mismatch, so the C2 gate provably bites.
 *
 * Forward-declared seams (SDL ahead of `@cockpit/shared` by design — F2/L1/L3) are enumerated and
 * excluded; when a downstream slice adds the shared backing, it removes the entry here.
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { buildSchema, isObjectType, type GraphQLObjectType } from 'graphql';

/** SDL object types that mirror a same-named `@cockpit/shared` interface. */
export const MIRRORED_TYPES = [
  'RepoCard', 'AgentLiveness', 'BriefingArtifact', 'BriefingBranch',
  'BriefingThread', 'BriefingSnapshot', 'WorkItem',
  'DoltBeadSourceRecord', 'HandoffDocumentSourceRecord', 'HandoffLiteralMetadata',
  'HandoffRecordSummary', 'HandoffRecordEvidence', 'ProductionInteraction',
  'RecordedDocumentProduction', 'LegacyUnknownDocumentProduction', 'UnavailableDocumentProduction',
  'MissingTargetDiagnostic', 'AmbiguousTargetDiagnostic', 'SuccessorOrderDiagnostic', 'RelationCycleDiagnostic',
  'EvidenceCoverage', 'RepositoryEvidenceCount', 'EvidenceSummary', 'EvidenceIndex', 'EvidenceRecord', 'EvidenceRefreshRequired', 'EvidenceRecordNotObserved',
] as const;

/**
 * SDL fields intentionally ahead of `@cockpit/shared` (forward-declared evolution seams).
 * F2 → BriefingSnapshot.repo; L1 → RepoCard.links; L3 → RepoCard.popover. Each is removed here
 * when its slice lands the shared backing.
 */
export const FORWARD_DECLARED = new Set<string>([
  'RepoCard.links',
  'RepoCard.popover',
  // BriefingSnapshot.repo — backed by @cockpit/shared as of F2; no longer forward-declared.
]);

export interface Mismatch {
  type: string;
  field: string;
  reason: string;
}

/** Extract `interface` name → property names from the given `@cockpit/shared` source files. */
export function sharedInterfaceFields(sourceFiles: string[]): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  const bases: Record<string, string[]> = {};
  const aliases: Record<string, string[]> = {};
  const members = (nodes: ts.NodeArray<ts.TypeElement>): Set<string> => new Set(nodes.flatMap(node => ts.isPropertySignature(node) && node.name && ts.isIdentifier(node.name) ? [node.name.text] : []));
  for (const file of sourceFiles) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    sf.forEachChild(node => {
      if (ts.isInterfaceDeclaration(node)) {
        out[node.name.text] = members(node.members);
        bases[node.name.text] = node.heritageClauses?.flatMap(clause => clause.types.map(type => type.expression.getText(sf))) ?? [];
      } else if (ts.isTypeAliasDeclaration(node) && ts.isUnionTypeNode(node.type)) {
        const objectVariants = node.type.types.filter(ts.isTypeLiteralNode);
        if (objectVariants.length) out[node.name.text] = new Set(objectVariants.flatMap(type => [...members(type.members)]));
        aliases[node.name.text] = node.type.types.filter(ts.isTypeReferenceNode).map(type => type.typeName.getText(sf));
      }
    });
  }
  for (const [name, parents] of Object.entries(bases)) for (const parent of parents) for (const field of out[parent] ?? []) out[name]?.add(field);
  for (const [name, variants] of Object.entries(aliases)) if (variants.length) out[name] = new Set(variants.flatMap(variant => [...(out[variant] ?? [])]));
  return out;
}

/** Extract SDL object-type name → field names (excludes introspection + the Query root). */
export function sdlObjectFields(sdl: string): Record<string, Set<string>> {
  const schema = buildSchema(sdl);
  const out: Record<string, Set<string>> = {};
  for (const [name, t] of Object.entries(schema.getTypeMap())) {
    if (isObjectType(t) && !name.startsWith('__') && name !== 'Query') {
      out[name] = new Set(Object.keys((t as GraphQLObjectType).getFields()));
    }
  }
  return out;
}

/** Report SDL fields on mirrored types that have no `@cockpit/shared` backing (forward-declared excluded). */
export function compareSdlToShared(
  sdl: string,
  shared: Record<string, Set<string>>,
): Mismatch[] {
  const sdlFields = sdlObjectFields(sdl);
  const mismatches: Mismatch[] = [];
  // Pre-existing rich REST WorkItem details are outside the accepted SDL core-field surface.
  // New source/evidence fields are not exempt. Adding another exception requires owner review.
  const restOnly = new Set(['WorkItem.chain', 'WorkItem.detail', 'WorkItem.provenance']);
  for (const type of MIRRORED_TYPES) {
    const sdlSet = sdlFields[type];
    if (!sdlSet) {
      mismatches.push({ type, field: '*', reason: 'mirrored type missing from the SDL' });
      continue;
    }
    const sharedSet = shared[type];
    if (!sharedSet) {
      mismatches.push({ type, field: '*', reason: 'mirrored type missing from @cockpit/shared' });
      continue;
    }
    for (const field of sharedSet) {
      if (!sdlSet.has(field) && !restOnly.has(`${type}.${field}`)) mismatches.push({ type, field, reason: 'shared field missing from SDL' });
    }
    for (const field of sdlSet) {
      if (FORWARD_DECLARED.has(`${type}.${field}`)) continue; // SDL ahead by design (F2/L1/L3)
      if (!sharedSet.has(field)) {
        mismatches.push({ type, field, reason: 'SDL field has no @cockpit/shared backing' });
      }
    }
  }
  return mismatches;
}
