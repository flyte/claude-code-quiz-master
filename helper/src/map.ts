import { CodebaseMap, Module, AnswerEntry } from './types.js';

export interface StalenessInput {
  mapSchemaVersion: number;
  expectedSchemaVersion: number;
  mapSha: string;
  headSha: string;
  changedFileCount: number;
  mapAgeDays: number;
  forceRefresh: boolean;
}

export type RefreshReason = 'force' | 'schema' | 'age' | 'drift';

export interface StalenessResult {
  refresh: boolean;
  reason?: RefreshReason;
}

const DRIFT_FILE_THRESHOLD = 20;
const MAX_AGE_DAYS = 30;

export function shouldRefreshMap(input: StalenessInput): StalenessResult {
  if (input.forceRefresh) return { refresh: true, reason: 'force' };
  if (input.mapSchemaVersion < input.expectedSchemaVersion) {
    return { refresh: true, reason: 'schema' };
  }
  if (input.mapAgeDays > MAX_AGE_DAYS) return { refresh: true, reason: 'age' };
  if (input.mapSha !== input.headSha && input.changedFileCount >= DRIFT_FILE_THRESHOLD) {
    return { refresh: true, reason: 'drift' };
  }
  return { refresh: false };
}

export interface ScopeInput {
  map: CodebaseMap;
  focus: string | undefined;
  recentChangedFiles: string[];
  rollingWindow: AnswerEntry[];
}

export type ScopeSource = 'focus' | 'recent' | 'map';

export interface ScopeResult {
  modules: Module[];
  source: ScopeSource;
}

export function resolveScope(input: ScopeInput): ScopeResult {
  if (input.focus !== undefined) {
    const needle = input.focus.toLowerCase();
    const matches = input.map.modules.filter(m =>
      m.path.toLowerCase().includes(needle) || m.summary.toLowerCase().includes(needle)
    );
    return { modules: matches, source: 'focus' };
  }

  if (input.recentChangedFiles.length > 0) {
    const matches = input.map.modules.filter(m =>
      input.recentChangedFiles.some(f => f.startsWith(m.path + '/') || f === m.path)
    );
    if (matches.length > 0) return { modules: matches, source: 'recent' };
  }

  // Fall through: whole map, biased by recently-wrong modules
  const wrongModules = new Set(
    input.rollingWindow.filter(e => e.verdict === 'wrong').map(e => e.module)
  );
  const sorted = [...input.map.modules].sort((a, b) => {
    const aw = wrongModules.has(a.path) ? 1 : 0;
    const bw = wrongModules.has(b.path) ? 1 : 0;
    return bw - aw;
  });
  return { modules: sorted, source: 'map' };
}
