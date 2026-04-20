export function gradeMcq(input) {
    const u = input.userInput.trim().toUpperCase();
    if (input.typeYourOwnLetter && u === input.typeYourOwnLetter.toUpperCase()) {
        return { verdict: null, routedToFreeForm: true };
    }
    if (u === input.correctLetter.toUpperCase()) {
        return { verdict: 'correct', routedToFreeForm: false };
    }
    return { verdict: 'wrong', routedToFreeForm: false };
}
const LINE_TOLERANCE = 2;
export function gradeShowMe(input) {
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
    let verdict = pathExact ? 'correct' : 'partial';
    if (input.expectedLine !== undefined) {
        if (userLine === undefined) {
            verdict = 'partial';
        }
        else if (Math.abs(userLine - input.expectedLine) > LINE_TOLERANCE) {
            verdict = 'partial';
        }
    }
    if (input.expectedSnippet) {
        const snippetIdx = u.indexOf('|');
        const userSnippet = snippetIdx !== -1 ? u.slice(snippetIdx + 1).trim() : '';
        const snippetMatches = userSnippet.toLowerCase().includes(input.expectedSnippet.toLowerCase());
        if (!snippetMatches)
            verdict = 'partial';
    }
    return { verdict };
}
function normalizePath(p) {
    return p.replace(/^\.\//, '').replace(/\\/g, '/');
}
function basename(p) {
    const parts = p.split('/');
    return parts[parts.length - 1] ?? p;
}
