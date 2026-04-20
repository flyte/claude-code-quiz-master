import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFilesSince, getHeadSha, isGitRepo } from '../src/git.js';

let dir: string;

function git(args: string): string {
  return execSync(`git -C ${dir} ${args}`, { encoding: 'utf8' });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qm-git-'));
  git('init -q -b main');
  git('config user.email t@t');
  git('config user.name t');
  writeFileSync(join(dir, 'a.txt'), 'a');
  git('add .');
  git('commit -q -m initial');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('isGitRepo', () => {
  it('returns true inside a git repo', () => {
    expect(isGitRepo(dir)).toBe(true);
  });

  it('returns false outside a git repo', () => {
    const nonGit = mkdtempSync(join(tmpdir(), 'qm-nongit-'));
    try {
      expect(isGitRepo(nonGit)).toBe(false);
    } finally {
      rmSync(nonGit, { recursive: true, force: true });
    }
  });
});

describe('getHeadSha', () => {
  it('returns the current HEAD sha', () => {
    const sha = getHeadSha(dir);
    expect(sha).toMatch(/^[a-f0-9]{40}$/);
  });
});

describe('changedFilesSince', () => {
  it('returns empty when nothing changed since the given sha', () => {
    const sha = getHeadSha(dir);
    expect(changedFilesSince(dir, sha)).toEqual([]);
  });

  it('returns committed file changes since the sha', () => {
    const sha = getHeadSha(dir);
    writeFileSync(join(dir, 'b.txt'), 'b');
    git('add .');
    git('commit -q -m second');
    expect(changedFilesSince(dir, sha)).toEqual(['b.txt']);
  });

  it('includes uncommitted (working tree) changes', () => {
    const sha = getHeadSha(dir);
    writeFileSync(join(dir, 'c.txt'), 'c');
    expect(changedFilesSince(dir, sha)).toContain('c.txt');
  });

  it('returns all files when sha is null', () => {
    const files = changedFilesSince(dir, null);
    expect(files).toContain('a.txt');
  });
});
