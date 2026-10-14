import { isSafeRepoName } from './handoff-brief.js';
import type {
  SourceRecordRef,
  TaskDocumentResolution,
  TaskDocumentTarget,
} from './source-record.js';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function documentPath(value: unknown): value is string {
  return (
    nonempty(value) &&
    value.startsWith('.handoff/') &&
    value.endsWith('.md') &&
    !value.includes('\\') &&
    !value.split('/').some((part) => part === '..' || part === '.' || !part)
  );
}

/** Proposed metadata seam; the containing resource supplies origin and direction. */
export function parseSourceLinks(
  referrer: SourceRecordRef,
  raw: unknown,
  fieldPath: string,
  nativeType: string,
): TaskDocumentResolution[] {
  if (raw === undefined) return [];
  const invalid = (path: string, reason: string): TaskDocumentResolution => ({
    status: 'invalid-declaration',
    referrer,
    fieldPath: path,
    reason,
  });
  if (referrer.source === 'dolt-bead') {
    if (typeof raw !== 'string')
      return [invalid(fieldPath, 'Dolt source_links must be a JSON string')];
    try {
      const decoded: unknown = JSON.parse(raw);
      raw = decoded;
    } catch {
      return [
        invalid(
          fieldPath,
          'Dolt source_links must encode a v1 declaration array',
        ),
      ];
    }
  }
  if (!Array.isArray(raw))
    return [invalid(fieldPath, 'source_links must be a v1 declaration array')];
  return raw.map((value: unknown, index) => {
    const path = `${fieldPath}[${index}]`;
    if (
      !object(value) ||
      value.schemaVersion !== 1 ||
      value.relation !== 'task-document' ||
      Object.keys(value).some(
        (key) => !['schemaVersion', 'relation', 'target'].includes(key),
      ) ||
      !object(value.target)
    )
      return invalid(path, 'Invalid v1 task-document declaration');
    const target = value.target;
    let parsed: TaskDocumentTarget;
    if (
      referrer.source === 'handoff-bead' &&
      target.source === 'dolt-bead' &&
      nonempty(target.nativeId) &&
      Object.keys(target).every((key) => ['source', 'nativeId'].includes(key))
    ) {
      parsed = { source: 'dolt-bead', nativeId: target.nativeId };
    } else if (
      referrer.source === 'dolt-bead' &&
      nativeType === 'task' &&
      target.source === 'handoff-bead' &&
      typeof target.repository === 'string' &&
      isSafeRepoName(target.repository) &&
      documentPath(target.sourcePath) &&
      Object.keys(target).every((key) =>
        ['source', 'repository', 'sourcePath'].includes(key),
      )
    ) {
      parsed = {
        source: 'handoff-bead',
        repository: target.repository,
        sourcePath: target.sourcePath,
      };
    } else
      return invalid(
        path,
        'Declaration direction or target coordinates are invalid',
      );
    return {
      status: 'target-not-observed-in-scope',
      referrer,
      fieldPath: path,
      target: parsed,
    };
  });
}
