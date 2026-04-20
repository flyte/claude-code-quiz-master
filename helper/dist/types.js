import { z } from 'zod';
export const SkillLevelSchema = z.enum(['beginner', 'intermediate', 'expert']);
export const QuestionTypeSchema = z.enum(['A', 'B', 'C', 'D']);
export const VerdictSchema = z.enum(['correct', 'partial', 'wrong']);
export const AnswerEntrySchema = z.object({
    type: QuestionTypeSchema,
    module: z.string(),
    verdict: VerdictSchema,
    timestamp: z.string(),
});
export const SessionEntrySchema = z.object({
    startedAt: z.string(),
    endedAt: z.string(),
    questionCount: z.number().int().nonnegative(),
    correctCount: z.number().int().nonnegative(),
});
export const StateSchema = z.object({
    schemaVersion: z.literal(1),
    skillLevel: SkillLevelSchema,
    lastQuizSha: z.string().nullable(),
    rollingWindow: z.array(AnswerEntrySchema).max(20),
    sessionHistory: z.array(SessionEntrySchema),
});
export const ModuleSchema = z.object({
    path: z.string(),
    summary: z.string(),
    keySymbols: z.array(z.string()),
    entrypoints: z.array(z.string()),
});
export const GlobalSymbolSchema = z.object({
    name: z.string(),
    file: z.string(),
    kind: z.enum(['function', 'class', 'const', 'type', 'other']),
    summary: z.string(),
});
export const MapSchema = z.object({
    schemaVersion: z.literal(1),
    builtAtSha: z.string(),
    builtAt: z.string(),
    fileCount: z.number().int().nonnegative(),
    modules: z.array(ModuleSchema),
    globalSymbols: z.array(GlobalSymbolSchema),
    architectureNotes: z.string(),
});
export const CURRENT_STATE_SCHEMA_VERSION = 1;
export const CURRENT_MAP_SCHEMA_VERSION = 1;
export function defaultState() {
    return {
        schemaVersion: CURRENT_STATE_SCHEMA_VERSION,
        skillLevel: 'intermediate',
        lastQuizSha: null,
        rollingWindow: [],
        sessionHistory: [],
    };
}
