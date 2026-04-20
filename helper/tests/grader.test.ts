import { describe, it, expect } from 'vitest';
import { gradeMcq, gradeShowMe } from '../src/grader.js';

describe('gradeMcq', () => {
  it('returns correct on matching letter (case-insensitive)', () => {
    expect(gradeMcq({ userInput: 'a', correctLetter: 'A' })).toEqual({
      verdict: 'correct',
      routedToFreeForm: false,
    });
    expect(gradeMcq({ userInput: 'B', correctLetter: 'B' })).toEqual({
      verdict: 'correct',
      routedToFreeForm: false,
    });
  });

  it('returns wrong on mismatching letter', () => {
    expect(gradeMcq({ userInput: 'b', correctLetter: 'A' })).toEqual({
      verdict: 'wrong',
      routedToFreeForm: false,
    });
  });

  it('routes to free-form when user picks the "type your own" option', () => {
    expect(
      gradeMcq({ userInput: 'D', correctLetter: 'A', typeYourOwnLetter: 'D' })
    ).toEqual({ verdict: null, routedToFreeForm: true });
  });

  it('treats empty input as wrong', () => {
    expect(gradeMcq({ userInput: '', correctLetter: 'A' })).toEqual({
      verdict: 'wrong',
      routedToFreeForm: false,
    });
  });
});

describe('gradeShowMe', () => {
  it('returns correct on exact path match', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts',
      expectedPath: 'src/auth/login.ts',
    })).toEqual({ verdict: 'correct' });
  });

  it('returns wrong on path mismatch', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/logout.ts',
      expectedPath: 'src/auth/login.ts',
    })).toEqual({ verdict: 'wrong' });
  });

  it('treats leading ./ as equivalent', () => {
    expect(gradeShowMe({
      userInput: './src/auth/login.ts',
      expectedPath: 'src/auth/login.ts',
    })).toEqual({ verdict: 'correct' });
  });

  it('returns partial when only filename matches (not full path)', () => {
    expect(gradeShowMe({
      userInput: 'login.ts',
      expectedPath: 'src/auth/login.ts',
    })).toEqual({ verdict: 'partial' });
  });

  it('matches line number within ±2', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts:42',
      expectedPath: 'src/auth/login.ts',
      expectedLine: 40,
    })).toEqual({ verdict: 'correct' });
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts:46',
      expectedPath: 'src/auth/login.ts',
      expectedLine: 40,
    })).toEqual({ verdict: 'partial' });
  });

  it('matches snippet by case-insensitive substring', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts | function VerifyToken',
      expectedPath: 'src/auth/login.ts',
      expectedSnippet: 'function verifyToken',
    })).toEqual({ verdict: 'correct' });
  });

  it('returns partial if path correct but snippet completely missing', () => {
    expect(gradeShowMe({
      userInput: 'src/auth/login.ts | doSomethingElse',
      expectedPath: 'src/auth/login.ts',
      expectedSnippet: 'function verifyToken',
    })).toEqual({ verdict: 'partial' });
  });
});
