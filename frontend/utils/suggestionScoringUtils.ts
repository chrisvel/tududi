import { Task } from '../entities/Task';
import { Project } from '../entities/Project';

export type SuggestionReason =
    | 'due'
    | 'fits_now'
    | 'revive'
    | 'high'
    | 'aging_review'
    | 'next_step'
    | 'area_balance';

export interface SuggestionMeta {
    score: number;
    reason: SuggestionReason;
    reasonLabel: string;
    reasonColor: string;
}

export interface SuggestionOpts {
    balanceMode?: boolean;
    contextFilter?: string;
}

interface AreaStats {
    name: string;
    color: string;
    total: number;
    share: number;
}

const FALLBACK_COLOR = '#6b7280';

function getPriorityScore(priority: Task['priority']): number {
    if (priority === 'high' || priority === 2) return 100;
    if (priority === 'medium' || priority === 1) return 60;
    if (priority === 'low' || priority === 0) return 30;
    return 0;
}

function isPendingStatus(status: Task['status']): boolean {
    return (
        status === 'not_started' ||
        status === 'waiting' ||
        status === (0 as any) ||
        status === (1 as any)
    );
}

function isActiveProject(project: Project): boolean {
    return project.status !== 'done' && project.status !== 'cancelled';
}

function isSomedayTask(task: Task): boolean {
    return (task.tags ?? []).some(
        (tag) => tag.name?.toLowerCase() === 'someday'
    );
}

export function computeAreaStats(projects: Project[]): AreaStats[] {
    const map = new Map<
        string,
        { color: string; total: number }
    >();

    projects.forEach((p) => {
        const areaObj = (p as any).Area ?? p.area;
        const name = areaObj?.name ?? 'No Area';
        const color: string = areaObj?.color ?? FALLBACK_COLOR;
        const total = p.task_status?.total ?? 0;
        const existing = map.get(name);
        if (existing) {
            existing.total += total;
        } else {
            map.set(name, { color, total });
        }
    });

    const totalAll = Array.from(map.values()).reduce((s, a) => s + a.total, 0);

    return Array.from(map.entries()).map(([name, data]) => ({
        name,
        color: data.color,
        total: data.total,
        share: totalAll > 0 ? (data.total / totalAll) * 100 : 0,
    }));
}

// Build one-per-project candidate pool: one next action per active project + all orphan tasks.
// Uses the task's own embedded Project.status (from getTaskIncludeConfigLight) so we don't
// depend on ID-matching against localProjects, which can silently fail.
export function buildCandidatePool(
    tasks: Task[],
    projects: Project[]
): Task[] {
    const pendingTasks = tasks.filter(
        (t) => isPendingStatus(t.status) && !isSomedayTask(t)
    );

    // Group pending tasks by project_id, reading status from the embedded Project object
    const byProject = new Map<
        number,
        { tasks: Task[]; projectStatus: string | undefined }
    >();
    const orphans: Task[] = [];

    pendingTasks.forEach((task) => {
        const projectId = task.project_id ?? (task.Project as any)?.id ?? null;
        if (projectId) {
            const existing = byProject.get(projectId);
            if (existing) {
                existing.tasks.push(task);
            } else {
                const projectStatus =
                    (task.Project as any)?.status ??
                    projects.find((p) => p.id === projectId)?.status;
                byProject.set(projectId, {
                    tasks: [task],
                    projectStatus,
                });
            }
        } else {
            orphans.push(task);
        }
    });

    const candidates: Task[] = [];

    // One next action per active project
    byProject.forEach(({ tasks: projTasks, projectStatus }) => {
        if (!isActiveProject({ status: projectStatus } as Project)) return;

        const sorted = [...projTasks].sort((a, b) => {
            const pa = getPriorityScore(a.priority);
            const pb = getPriorityScore(b.priority);
            if (pb !== pa) return pb - pa;
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
        });
        candidates.push(sorted[0]);
    });

    candidates.push(...orphans);
    return candidates;
}

export function scoreCandidate(
    task: Task,
    projects: Project[],
    areaStats: AreaStats[],
    opts: SuggestionOpts = {}
): SuggestionMeta {
    const project = projects.find((p) => p.id === task.project_id);
    const areaObj = project ? ((project as any).Area ?? project.area) : null;
    const areaName: string = areaObj?.name ?? 'No Area';
    const areaColor: string = areaObj?.color ?? FALLBACK_COLOR;
    const areaStat = areaStats.find((a) => a.name === areaName);

    let score = getPriorityScore(task.priority);
    let reason: SuggestionReason = 'next_step';

    // Orphan boost: tasks without a project get a slight nudge
    if (!task.project_id) {
        score += 5;
    }

    // Due today / overdue nudge (highest priority nudge)
    const today = new Date().toISOString().split('T')[0];
    if (task.due_date) {
        const dueStr = task.due_date.split('T')[0];
        if (dueStr <= today) {
            score += 15;
            reason = 'due';
        }
    }

    // Context filter nudge
    if (opts.contextFilter && reason === 'next_step') {
        const hasContextTag = (task.tags ?? []).some(
            (tag) =>
                tag.name?.toLowerCase() ===
                opts.contextFilter?.toLowerCase()
        );
        if (hasContextTag) {
            score += 10;
            reason = 'fits_now';
        }
    }

    // Stalled project nudge
    if (project?.is_stalled && reason === 'next_step') {
        score += 8;
        reason = 'revive';
    }

    // Balance mode nudge (opt-in only)
    if (opts.balanceMode && areaStat && reason === 'next_step') {
        const numAreas = areaStats.filter((a) => a.total > 0).length;
        const equalShare = numAreas > 0 ? 100 / numAreas : 100;
        if (areaStat.share < equalShare * 0.6) {
            score += 30;
            reason = 'area_balance';
        } else if (areaStat.share < equalShare * 0.85) {
            score += 15;
            reason = 'area_balance';
        }
    }

    // High priority chip (no score change — score already captured in priority_score)
    if (
        reason === 'next_step' &&
        (task.priority === 'high' || task.priority === 2)
    ) {
        reason = 'high';
    }

    // Aging review chip — only for orphan tasks (no project), informational only, no score change.
    // Project next-actions keep 'next_step' regardless of age: an old project task is a real
    // next action, not a deletion candidate.
    const refDate = task.updated_at ?? task.created_at;
    let agingDays = 0;
    if (refDate) {
        agingDays = Math.round(
            (Date.now() - new Date(refDate).getTime()) / 86_400_000
        );
    }
    if (reason === 'next_step' && agingDays >= 60 && !task.project_id) {
        reason = 'aging_review';
    }

    // Build chip label and color
    const projectName = project?.name ?? '';

    let reasonLabel: string;
    let reasonColor: string;

    switch (reason) {
        case 'due': {
            const isOverdue = task.due_date
                ? task.due_date.split('T')[0] < today
                : false;
            reasonLabel = isOverdue
                ? 'This task is overdue'
                : 'This task is due today';
            reasonColor = isOverdue ? '#f97316' : '#ef4444';
            break;
        }
        case 'fits_now':
            reasonLabel = 'Matches your current context';
            reasonColor = areaColor;
            break;
        case 'revive':
            reasonLabel = projectName
                ? `Completing this moves ${projectName} forward`
                : 'Completing this revives stalled work';
            reasonColor = FALLBACK_COLOR;
            break;
        case 'high':
            reasonLabel = 'High priority — worth tackling now';
            reasonColor = '#ef4444';
            break;
        case 'aging_review':
            reasonLabel = `Hasn't been touched in ${agingDays} days — still relevant?`;
            reasonColor = FALLBACK_COLOR;
            break;
        case 'area_balance':
            reasonLabel = `Helps balance your ${areaName} area`;
            reasonColor = areaStat?.color ?? FALLBACK_COLOR;
            break;
        case 'next_step':
        default:
            reasonLabel = projectName
                ? `The next open step in ${projectName}`
                : 'A good action to tackle next';
            reasonColor = areaColor;
            reason = 'next_step';
            break;
    }

    return { score, reason, reasonLabel, reasonColor };
}

export function scoreAndSortSuggestedTasks(
    tasks: Task[],
    projects: Project[],
    opts: SuggestionOpts = {}
): Array<Task & { _suggestionMeta: SuggestionMeta }> {
    const areaStats = computeAreaStats(projects);
    const candidates = buildCandidatePool(tasks, projects);


    const scored = candidates.map((task) => ({
        ...task,
        _suggestionMeta: scoreCandidate(task, projects, areaStats, opts),
    }));

    scored.sort((a, b) => b._suggestionMeta.score - a._suggestionMeta.score);

    // Safety net: enforce max 1 task per project after scoring
    const seenProjects = new Set<number>();
    const deduped = scored.filter((task) => {
        if (task.project_id == null) return true;
        if (seenProjects.has(task.project_id)) return false;
        seenProjects.add(task.project_id);
        return true;
    });

    // Stale tasks are informational nudges, not priorities.
    // Cap at 1 and push to the end so project next-actions lead.
    const nonStale = deduped.filter((t) => t._suggestionMeta.reason !== 'aging_review');
    const stale = deduped.filter((t) => t._suggestionMeta.reason === 'aging_review');
    return [...nonStale, ...stale.slice(0, 1)];
}
