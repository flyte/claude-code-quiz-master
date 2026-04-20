#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { loadState, saveState, recordAnswer, applySkillDrift, summarizeSession } from './state.js';
import { gradeMcq, gradeShowMe } from './grader.js';
import { shouldRefreshMap, resolveScope } from './map.js';
import { isGitRepo, getHeadSha, changedFilesSince } from './git.js';
import { defaultState, AnswerEntry, QuestionType, Verdict, SkillLevel, MapSchema } from './types.js';

const program = new Command();
program.name('quiz-helper').description('Deterministic helpers for quiz-master plugin');

const state = program.command('state');

state.command('init')
  .requiredOption('--path <path>')
  .action((opts) => {
    saveState(opts.path, defaultState());
  });

state.command('get')
  .alias('load')
  .requiredOption('--path <path>')
  .action((opts) => {
    process.stdout.write(JSON.stringify(loadState(opts.path)));
  });

state.command('record-answer')
  .requiredOption('--path <path>')
  .requiredOption('--type <type>')
  .requiredOption('--module <module>')
  .requiredOption('--verdict <verdict>')
  .action((opts) => {
    const entry: AnswerEntry = {
      type: opts.type as QuestionType,
      module: opts.module,
      verdict: opts.verdict as Verdict,
      timestamp: new Date().toISOString(),
    };
    let s = loadState(opts.path);
    s = recordAnswer(s, entry);
    s = applySkillDrift(s);
    saveState(opts.path, s);
    process.stdout.write(JSON.stringify({ skillLevel: s.skillLevel }));
  });

state.command('set-level')
  .requiredOption('--path <path>')
  .requiredOption('--level <level>')
  .action((opts) => {
    const s = loadState(opts.path);
    saveState(opts.path, { ...s, skillLevel: opts.level as SkillLevel });
  });

state.command('set-last-sha')
  .requiredOption('--path <path>')
  .requiredOption('--sha <sha>')
  .action((opts) => {
    const s = loadState(opts.path);
    saveState(opts.path, { ...s, lastQuizSha: opts.sha });
  });

state.command('session-summary')
  .requiredOption('--path <path>')
  .option('--since <iso>')
  .action((opts) => {
    const s = loadState(opts.path);
    process.stdout.write(JSON.stringify(summarizeSession(s, opts.since)));
  });

const grade = program.command('grade');

grade.command('mcq')
  .requiredOption('--user-input <input>')
  .requiredOption('--correct-letter <letter>')
  .option('--type-your-own-letter <letter>')
  .action((opts) => {
    process.stdout.write(JSON.stringify(gradeMcq({
      userInput: opts.userInput,
      correctLetter: opts.correctLetter,
      typeYourOwnLetter: opts.typeYourOwnLetter,
    })));
  });

grade.command('show-me')
  .requiredOption('--user-input <input>')
  .requiredOption('--expected-path <path>')
  .option('--expected-line <line>', '', (v) => parseInt(v, 10))
  .option('--expected-snippet <snippet>')
  .action((opts) => {
    process.stdout.write(JSON.stringify(gradeShowMe({
      userInput: opts.userInput,
      expectedPath: opts.expectedPath,
      expectedLine: opts.expectedLine,
      expectedSnippet: opts.expectedSnippet,
    })));
  });

const map = program.command('map');

map.command('check-staleness')
  .option('--map-path <path>', 'convenience: read map file for its own sha/version/age')
  .requiredOption('--expected-schema-version <n>', '', (v) => parseInt(v, 10))
  .requiredOption('--head-sha <sha>')
  .requiredOption('--changed-file-count <n>', '', (v) => parseInt(v, 10))
  .option('--map-schema-version <n>', '', (v) => parseInt(v, 10))
  .option('--map-sha <sha>')
  .option('--map-age-days <n>', '', (v) => parseInt(v, 10))
  .option('--force')
  .action((opts) => {
    let mapSchemaVersion: number | undefined = opts.mapSchemaVersion;
    let mapSha: string | undefined = opts.mapSha;
    let mapAgeDays: number | undefined = opts.mapAgeDays;

    if (opts.mapPath) {
      if (!existsSync(opts.mapPath)) {
        process.stdout.write(JSON.stringify({ refresh: true, reason: 'missing' }));
        return;
      }
      try {
        const raw = readFileSync(opts.mapPath, 'utf8');
        const parsed = MapSchema.parse(JSON.parse(raw));
        mapSchemaVersion = parsed.schemaVersion;
        mapSha = parsed.builtAtSha;
        const ms = statSync(opts.mapPath).mtimeMs;
        mapAgeDays = (Date.now() - ms) / (1000 * 60 * 60 * 24);
      } catch {
        process.stdout.write(JSON.stringify({ refresh: true, reason: 'corrupt' }));
        return;
      }
    }

    if (mapSchemaVersion === undefined || mapSha === undefined || mapAgeDays === undefined) {
      process.stderr.write('quiz-helper: must provide --map-path or all of --map-schema-version/--map-sha/--map-age-days\n');
      process.exit(1);
    }

    process.stdout.write(JSON.stringify(shouldRefreshMap({
      mapSchemaVersion,
      expectedSchemaVersion: opts.expectedSchemaVersion,
      mapSha,
      headSha: opts.headSha,
      changedFileCount: opts.changedFileCount,
      mapAgeDays,
      forceRefresh: !!opts.force,
    })));
  });

map.command('save')
  .requiredOption('--path <path>')
  .action((opts) => {
    const raw = readFileSync(0, 'utf8'); // stdin
    const parsed = MapSchema.parse(JSON.parse(raw));
    writeFileSync(opts.path, JSON.stringify(parsed, null, 2));
  });

map.command('resolve-scope')
  .requiredOption('--map-path <path>')
  .requiredOption('--state-path <path>')
  .option('--focus <focus>')
  .option('--recent <files>', 'comma-separated')
  .action((opts) => {
    const parsedMap = MapSchema.parse(JSON.parse(readFileSync(opts.mapPath, 'utf8')));
    const stateData = loadState(opts.statePath);
    process.stdout.write(JSON.stringify(resolveScope({
      map: parsedMap,
      focus: opts.focus,
      recentChangedFiles: opts.recent ? opts.recent.split(',').filter(Boolean) : [],
      rollingWindow: stateData.rollingWindow,
    })));
  });

const git = program.command('git');

git.command('head-sha')
  .requiredOption('--cwd <cwd>')
  .action((opts) => {
    if (!isGitRepo(opts.cwd)) {
      process.stdout.write(JSON.stringify({ headSha: null, isGitRepo: false }));
      return;
    }
    process.stdout.write(JSON.stringify({ headSha: getHeadSha(opts.cwd), isGitRepo: true }));
  });

git.command('changed-since')
  .requiredOption('--cwd <cwd>')
  .option('--since <sha>')
  .action((opts) => {
    if (!isGitRepo(opts.cwd)) {
      process.stdout.write(JSON.stringify({ files: [], isGitRepo: false }));
      return;
    }
    process.stdout.write(JSON.stringify({
      files: changedFilesSince(opts.cwd, opts.since ?? null),
      isGitRepo: true,
    }));
  });

program.parseAsync().catch((err) => {
  process.stderr.write(`quiz-helper: ${err.message}\n`);
  process.exit(1);
});
