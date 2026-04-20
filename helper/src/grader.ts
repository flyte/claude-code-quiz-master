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
