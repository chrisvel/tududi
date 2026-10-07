import { ListSharesResponseRow } from './sharesService';

// Project cards look up who a project is shared with once and keep the answer
// for the session. Anything that changes a project's shares clears its entry so
// the next render asks again.
export const projectShareCache = new Map<string, ListSharesResponseRow[]>();
export const failedShareCache = new Set<string>();

export function clearProjectShareCache(projectUid: string): void {
    projectShareCache.delete(projectUid);
    failedShareCache.delete(projectUid);
}
