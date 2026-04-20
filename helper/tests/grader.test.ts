import { describe, it, expect } from 'vitest';
import { gradeMcq } from '../src/grader.js';

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
