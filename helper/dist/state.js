import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { StateSchema, defaultState } from './types.js';
export function loadState(path) {
    if (!existsSync(path)) {
        return defaultState();
    }
    const raw = readFileSync(path, 'utf8');
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
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
export function saveState(path, state) {
    StateSchema.parse(state); // throw on programmer error
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    renameSync(tmp, path);
}
const ROLLING_WINDOW_SIZE = 20;
export function recordAnswer(state, entry) {
    const next = [...state.rollingWindow, entry];
    const trimmed = next.length > ROLLING_WINDOW_SIZE
        ? next.slice(next.length - ROLLING_WINDOW_SIZE)
        : next;
    return { ...state, rollingWindow: trimmed };
}
const MIN_WINDOW_FOR_DRIFT = 10;
const PROMOTE_ACCURACY = 0.8;
const DEMOTE_WRONG_FRAC = 0.6;
const HARD_TYPE_MIN = 5;
const HARD_TYPES_FOR_LEVEL = {
    beginner: ['C', 'D'],
    intermediate: ['D'],
    expert: [],
};
const NEXT_LEVEL_UP = {
    beginner: 'intermediate',
    intermediate: 'expert',
    expert: null,
};
const NEXT_LEVEL_DOWN = {
    beginner: null,
    intermediate: 'beginner',
    expert: 'intermediate',
};
export function applySkillDrift(state) {
    const w = state.rollingWindow;
    if (w.length < MIN_WINDOW_FOR_DRIFT)
        return state;
    const score = w.reduce((acc, e) => {
        if (e.verdict === 'correct')
            return acc + 1;
        if (e.verdict === 'partial')
            return acc + 0.5;
        return acc;
    }, 0);
    const accuracy = score / w.length;
    if (accuracy >= PROMOTE_ACCURACY) {
        const hardTypes = HARD_TYPES_FOR_LEVEL[state.skillLevel];
        const hardCorrect = w.filter(e => hardTypes.includes(e.type) && e.verdict === 'correct').length;
        const next = NEXT_LEVEL_UP[state.skillLevel];
        if (next && hardCorrect >= HARD_TYPE_MIN) {
            return { ...state, skillLevel: next };
        }
    }
    const wrongCount = w.filter(e => e.verdict === 'wrong').length;
    if (wrongCount / w.length >= DEMOTE_WRONG_FRAC) {
        const next = NEXT_LEVEL_DOWN[state.skillLevel];
        if (next) {
            return { ...state, skillLevel: next };
        }
    }
    return state;
}
const WEAK_MODULE_WRONG_THRESHOLD = 2;
export function summarizeSession(state, since) {
    // If `since` (ISO timestamp) is provided, restrict to entries with timestamp >= since.
    // Otherwise, summarize the full rolling window.
    const entries = since
        ? state.rollingWindow.filter(e => e.timestamp >= since)
        : state.rollingWindow;
    const verdictCounts = { correct: 0, partial: 0, wrong: 0 };
    const byType = {
        A: { total: 0, correct: 0, partial: 0, wrong: 0 },
        B: { total: 0, correct: 0, partial: 0, wrong: 0 },
        C: { total: 0, correct: 0, partial: 0, wrong: 0 },
        D: { total: 0, correct: 0, partial: 0, wrong: 0 },
    };
    const moduleWrongCounts = new Map();
    for (const e of entries) {
        verdictCounts[e.verdict]++;
        byType[e.type].total++;
        byType[e.type][e.verdict]++;
        if (e.verdict === 'wrong') {
            moduleWrongCounts.set(e.module, (moduleWrongCounts.get(e.module) ?? 0) + 1);
        }
    }
    const score = verdictCounts.correct + 0.5 * verdictCounts.partial;
    const accuracy = entries.length > 0 ? score / entries.length : 0;
    const weakModules = [...moduleWrongCounts.entries()]
        .filter(([, n]) => n >= WEAK_MODULE_WRONG_THRESHOLD)
        .sort((a, b) => b[1] - a[1])
        .map(([m]) => m);
    return {
        totalAnswered: entries.length,
        verdictCounts,
        score,
        accuracy,
        byType,
        weakModules,
        skillLevel: state.skillLevel,
    };
}
function backupCorrupt(path) {
    const dir = dirname(path);
    const base = basename(path, '.json');
    const stamp = Date.now();
    const backup = join(dir, `${base}.bak.${stamp}.json`);
    try {
        copyFileSync(path, backup);
    }
    catch {
        // best-effort; failure to back up must not block recovery
    }
}
