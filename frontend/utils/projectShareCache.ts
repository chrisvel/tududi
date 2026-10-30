import { ListSharesResponseRow } from './sharesService';
import { Project } from '../entities/Project';
import { getCurrentUser } from './userUtils';

// Project cards look up who a project is shared with once and keep the answer
// for the session. Anything that changes a project's shares clears its entry so
// the next render asks again.
export const projectShareCache = new Map<string, ListSharesResponseRow[]>();
export const failedShareCache = new Set<string>();

export function clearProjectShareCache(projectUid: string): void {
    projectShareCache.delete(projectUid);
    failedShareCache.delete(projectUid);
}

// Only the owner or an admin may list a project's shares; anyone else gets a
// 403, so don't ask. The server says so in can_share; payloads without it
// fall back to comparing the owner with the signed-in user.
export function canManageProjectShares(project: Project): boolean {
    if (typeof project.can_share === 'boolean') return project.can_share;
    const user = getCurrentUser();
    if (!user) return false;
    if (user.is_admin) return true;
    const owner = project as Project & { user_uid?: string };
    return Boolean(owner.user_uid) && owner.user_uid === user.uid;
}
