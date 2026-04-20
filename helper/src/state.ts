import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { State, StateSchema, defaultState } from './types.js';

export function loadState(path: string): State {
  if (!existsSync(path)) {
    return defaultState();
  }
  const raw = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorrupt(path);
    return defaultState();
  }
  const result = StateSchema.safeParse(parsed);
  if (!result.success) {
    backupCorrupt(path);
    return defaultState();
  }
  return result.data;
}

export function saveState(path: string, state: State): void {
  StateSchema.parse(state); // throw on programmer error
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, path);
}

function backupCorrupt(path: string): void {
  const dir = dirname(path);
  const base = basename(path, '.json');
  const stamp = Date.now();
  const backup = join(dir, `${base}.bak.${stamp}.json`);
  try {
    copyFileSync(path, backup);
  } catch {
    // best-effort; failure to back up must not block recovery
  }
}
