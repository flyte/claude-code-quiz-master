import { execFileSync } from 'node:child_process';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

export function isGitRepo(cwd: string): boolean {
  try {
    git(cwd, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

export function getHeadSha(cwd: string): string {
  return git(cwd, ['rev-parse', 'HEAD']);
}

export function changedFilesSince(cwd: string, sinceSha: string | null): string[] {
  if (sinceSha === null) {
    const tracked = git(cwd, ['ls-files']).split('\n').filter(Boolean);
    return tracked;
  }
  const committed = git(cwd, ['diff', '--name-only', `${sinceSha}..HEAD`]).split('\n').filter(Boolean);
  const unstaged = git(cwd, ['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean);
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  return Array.from(new Set([...committed, ...unstaged, ...untracked]));
}
