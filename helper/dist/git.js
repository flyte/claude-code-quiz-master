import { execFileSync } from 'node:child_process';
function git(cwd, args) {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}
export function isGitRepo(cwd) {
    try {
        git(cwd, ['rev-parse', '--git-dir']);
        return true;
    }
    catch {
        return false;
    }
}
export function getHeadSha(cwd) {
    return git(cwd, ['rev-parse', 'HEAD']);
}
export function changedFilesSince(cwd, sinceSha) {
    if (sinceSha === null) {
        const tracked = git(cwd, ['ls-files']).split('\n').filter(Boolean);
        return tracked;
    }
    const committed = git(cwd, ['diff', '--name-only', `${sinceSha}..HEAD`]).split('\n').filter(Boolean);
    const unstaged = git(cwd, ['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean);
    const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
    return Array.from(new Set([...committed, ...unstaged, ...untracked]));
}
