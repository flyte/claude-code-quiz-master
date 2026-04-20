import { z } from 'zod';

export const SkillLevelSchema = z.enum(['beginner', 'intermediate', 'expert']);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const QuestionTypeSchema = z.enum(['A', 'B', 'C', 'D']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const VerdictSchema = z.enum(['correct', 'partial', 'wrong']);
export type Verdict = z.infer<typeof VerdictSchema>;

export const AnswerEntrySchema = z.object({
  type: QuestionTypeSchema,
  module: z.string(),
  verdict: VerdictSchema,
  timestamp: z.string(),
});
export type AnswerEntry = z.infer<typeof AnswerEntrySchema>;

export const SessionEntrySchema = z.object({
  startedAt: z.string(),
  endedAt: z.string(),
  questionCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
});
export type SessionEntry = z.infer<typeof SessionEntrySchema>;

export const StateSchema = z.object({
  schemaVersion: z.literal(1),
  skillLevel: SkillLevelSchema,
  lastQuizSha: z.string().nullable(),
  rollingWindow: z.array(AnswerEntrySchema).max(20),
  sessionHistory: z.array(SessionEntrySchema),
});
export type State = z.infer<typeof StateSchema>;

export const ModuleSchema = z.object({
  path: z.string(),
  summary: z.string(),
  keySymbols: z.array(z.string()),
  entrypoints: z.array(z.string()),
});
export type Module = z.infer<typeof ModuleSchema>;

export const GlobalSymbolSchema = z.object({
  name: z.string(),
  file: z.string(),
  kind: z.enum(['function', 'class', 'const', 'type', 'other']),
  summary: z.string(),
});
export type GlobalSymbol = z.infer<typeof GlobalSymbolSchema>;

export const MapSchema = z.object({
  schemaVersion: z.literal(1),
  builtAtSha: z.string(),
  builtAt: z.string(),
  fileCount: z.number().int().nonnegative(),
  modules: z.array(ModuleSchema),
  globalSymbols: z.array(GlobalSymbolSchema),
  architectureNotes: z.string(),
});
export type CodebaseMap = z.infer<typeof MapSchema>;

export const CURRENT_STATE_SCHEMA_VERSION = 1 as const;
export const CURRENT_MAP_SCHEMA_VERSION = 1 as const;

export function defaultState(): State {
  return {
    schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
    skillLevel: 'intermediate',
    lastQuizSha: null,
    rollingWindow: [],
    sessionHistory: [],
  };
}
