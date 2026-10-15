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
