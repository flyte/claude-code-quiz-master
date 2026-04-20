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
