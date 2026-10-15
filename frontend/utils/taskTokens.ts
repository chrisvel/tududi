import { analyzeInboxText } from './inboxService';

export interface TokenResolved {
    name: string;
    tags: string[];
    projectId: number | null;
    areaId: number | null;
    dueDate: string | null;
}

interface NamedRef {
    id?: number;
    uid?: string;
    name?: string;
}

// Reads the #tags, +project, ~area and date typed into a task name the way
// quick capture does. Returns null when the text cannot be analyzed, so the
// caller keeps the name as typed.
export const resolveTaskTokens = async (
    text: string,
    projects: NamedRef[],
    areas: NamedRef[],
    currentTags: string[] = []
): Promise<TokenResolved | null> => {
    let analysis;
    try {
        analysis = await analyzeInboxText(text, { parseDates: true });
    } catch {
        return null;
    }
    if (!analysis) return null;

    const known = new Set(currentTags.map((name) => name.toLowerCase()));
    const tags = [
        ...currentTags,
        ...(analysis.parsed_tags ?? []).filter((name) => {
            const key = name.toLowerCase();
            if (known.has(key)) return false;
            known.add(key);
            return true;
        }),
    ];
    const projectName = analysis.parsed_projects?.[0]?.toLowerCase();
    const project = projectName
        ? projects.find((p) => p.name?.toLowerCase() === projectName)
        : undefined;
    const areaUid = analysis.parsed_area?.uid;
    const area = areaUid ? areas.find((a) => a.uid === areaUid) : undefined;

    return {
        name: analysis.cleaned_content?.trim() || text,
        tags,
        projectId: project?.id ?? null,
        areaId: area?.id ?? null,
        dueDate: analysis.parsed_due_date
            ? String(analysis.parsed_due_date).split('T')[0]
            : null,
    };
};

// The PATCH body for a name that held tokens: the cleaned name plus whatever
// the tokens set. Tags are sent only when the tokens added some.
export const tokenChanges = (
    title: string,
    resolved: TokenResolved | null,
    currentTags: string[]
): { changes: Record<string, unknown>; newTags: string[] } => {
    const changes: Record<string, unknown> = {
        name: resolved?.name ?? title,
    };
    let newTags: string[] = [];
    if (resolved) {
        if (resolved.tags.length !== currentTags.length) {
            changes.tags = resolved.tags.map((name) => ({ name }));
            newTags = resolved.tags.filter(
                (name) => !currentTags.includes(name)
            );
        }
        if (resolved.projectId !== null)
            changes.project_id = resolved.projectId;
        if (resolved.areaId !== null) changes.area_id = resolved.areaId;
        if (resolved.dueDate) changes.due_date = resolved.dueDate;
    }
    return { changes, newTags };
};
