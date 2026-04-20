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

  // Try to extract `path:line` and snippet (separated by `|` or whitespace)
  const pathPart = u.split(/[|\s]/)[0] ?? '';
  const [rawPath, rawLine] = pathPart.split(':');
  const userPath = normalizePath(rawPath);
  const userLine = rawLine ? Number.parseInt(rawLine, 10) : undefined;

  const pathExact = userPath === expectedPathNorm;
  const filenameOnly = !pathExact && basename(userPath) === basename(expectedPathNorm);

  if (!pathExact && !filenameOnly) {
    return { verdict: 'wrong' };
  }

  let verdict: Verdict = pathExact ? 'correct' : 'partial';

  if (input.expectedLine !== undefined && userLine !== undefined) {
    const lineDelta = Math.abs(userLine - input.expectedLine);
    if (lineDelta > LINE_TOLERANCE) verdict = 'partial';
  }

  if (input.expectedSnippet) {
    const snippetMatches = u.toLowerCase().includes(input.expectedSnippet.toLowerCase());
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
