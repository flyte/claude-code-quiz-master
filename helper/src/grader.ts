import { Verdict } from './types.js';

export interface McqGradeInput {
  userInput: string;
  correctLetter: string;
  typeYourOwnLetter?: string;
}

export interface McqGradeResult {
  verdict: Verdict | null;
  routedToFreeForm: boolean;
}

export function gradeMcq(input: McqGradeInput): McqGradeResult {
  const u = input.userInput.trim().toUpperCase();
  if (input.typeYourOwnLetter && u === input.typeYourOwnLetter.toUpperCase()) {
    return { verdict: null, routedToFreeForm: true };
  }
  if (u === input.correctLetter.toUpperCase()) {
    return { verdict: 'correct', routedToFreeForm: false };
  }
  return { verdict: 'wrong', routedToFreeForm: false };
}

export interface ShowMeGradeInput {
  userInput: string;
  expectedPath: string;
  expectedLine?: number;
  expectedSnippet?: string;
}

export interface ShowMeGradeResult {
  verdict: Verdict;
}

const LINE_TOLERANCE = 2;

export function gradeShowMe(input: ShowMeGradeInput): ShowMeGradeResult {
  const u = input.userInput.trim();
  const expectedPathNorm = normalizePath(input.expectedPath);
  const expectedBase = basename(expectedPathNorm);

  // Candidate tokens: split on whitespace and pipes; keep tokens that look like paths
  // (contain a slash, OR have a file extension).
  const candidates = u
    .split(/[|\s,;]+/)
    .map(t => t.replace(/[.,;:)]+$/, '')) // strip trailing punctuation
    .filter(Boolean);

  let bestMatch: { path: string; line?: number; exact: boolean } | null = null;

  for (const tok of candidates) {
    const [rawPath, rawLine] = tok.split(':');
    const norm = normalizePath(rawPath);
    const line = rawLine && /^\d+$/.test(rawLine) ? Number.parseInt(rawLine, 10) : undefined;

    if (!norm.includes('/') && !/\.[a-zA-Z0-9]+$/.test(norm)) continue; // not path-like

    // Absolute paths: treat as exact if they end with '/' + expectedPathNorm.
    // Bounding on the leading slash prevents `lib/src/foo.ts` from matching `src/foo.ts`.
    const absoluteMatch = norm.startsWith('/') && norm.endsWith('/' + expectedPathNorm);
    const exact = norm === expectedPathNorm || absoluteMatch;
    const filenameMatch = !exact && basename(norm) === expectedBase;

    if (exact) {
      bestMatch = { path: norm, line, exact: true };
      break; // exact wins; stop searching
    }
    if (filenameMatch && !bestMatch) {
      bestMatch = { path: norm, line, exact: false };
    }
  }

  if (!bestMatch) return { verdict: 'wrong' };

  let verdict: Verdict = bestMatch.exact ? 'correct' : 'partial';

  if (input.expectedLine !== undefined) {
    if (bestMatch.line === undefined) {
      verdict = 'partial';
    } else if (Math.abs(bestMatch.line - input.expectedLine) > LINE_TOLERANCE) {
      verdict = 'partial';
    }
  }

  if (input.expectedSnippet) {
    // Strip all path-looking tokens from the input before matching the snippet.
    const withoutPaths = u
      .split(/\s+/)
      .filter(t => !/\//.test(t) && !/\.[a-zA-Z0-9]+$/.test(t.replace(/[.,;:)]+$/, '')))
      .join(' ');
    const snippetMatches = withoutPaths.toLowerCase().includes(input.expectedSnippet.toLowerCase());
    if (!snippetMatches) verdict = 'partial';
  }

  return { verdict };
}

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '').replace(/\\/g, '/');
}

function basename(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}
