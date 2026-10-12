import { useStore } from '../store/useStore';
import { updateUiSettings } from './profileService';
import type { Area } from '../entities/Area';
import type { Project } from '../entities/Project';
import type { Tag } from '../entities/Tag';

// A Focus narrows the app to one area, optionally one project inside it,
// and a set of tags. Lists send it as query params on every request and
// the capture box uses it to fill in a project and tags the text does not
// name. It is saved per user in ui_settings.focus.
export interface Focus {
    area_uid?: string | null;
    project_uid?: string | null;
    tags?: string[];
}

export interface FocusScopeParams {
    area_uid?: string;
    project_uid?: string;
    tags?: string;
}

const cleanTags = (tags: unknown): string[] =>
    Array.isArray(tags)
        ? [
              ...new Set(
                  tags
                      .filter(
                          (name): name is string => typeof name === 'string'
                      )
                      .map((name) => name.trim())
                      .filter(Boolean)
              ),
          ]
        : [];

// Drops anything that is not a usable focus, so a stale or hand-edited
// setting never reaches the lists.
export const sanitizeFocus = (raw: unknown): Focus | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const value = raw as Record<string, unknown>;
    const focus: Focus = {};
    if (typeof value.area_uid === 'string' && value.area_uid.trim()) {
        focus.area_uid = value.area_uid.trim();
    }
    if (typeof value.project_uid === 'string' && value.project_uid.trim()) {
        focus.project_uid = value.project_uid.trim();
    }
    const tags = cleanTags(value.tags);
    if (tags.length > 0) focus.tags = tags;
    return focus.area_uid || focus.project_uid || focus.tags ? focus : null;
};

export const focusScopeParams = (
    focus: Focus | null | undefined
): FocusScopeParams => {
    if (!focus) return {};
    const params: FocusScopeParams = {};
    if (focus.area_uid) params.area_uid = focus.area_uid;
    if (focus.project_uid) params.project_uid = focus.project_uid;
    if (focus.tags && focus.tags.length > 0) params.tags = focus.tags.join(',');
    return params;
};

export const appendFocusParams = (
    params: URLSearchParams,
    focus: Focus | null | undefined
): URLSearchParams => {
    Object.entries(focusScopeParams(focus)).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, value);
    });
    return params;
};

// A stable string for effect dependencies: the same focus always gives the
// same key, no focus gives an empty string.
export const focusKey = (focus: Focus | null | undefined): string => {
    const params = focusScopeParams(focus);
    return [params.area_uid ?? '', params.project_uid ?? '', params.tags ?? '']
        .join('|')
        .replace(/\|+$/, '');
};

// A focus that names an area or project the user no longer has (deleted,
// or a project moved out of the area) is dropped rather than left pointing
// at nothing.
export const isFocusDangling = (
    focus: Focus | null,
    areas: Area[],
    projects: Project[]
): boolean => {
    if (!focus) return false;
    if (focus.area_uid && !areas.some((area) => area.uid === focus.area_uid)) {
        return true;
    }
    if (focus.project_uid) {
        const project = projects.find((p) => p.uid === focus.project_uid);
        if (!project) return true;
        if (focus.area_uid) {
            const projectAreaUid = project.area?.uid ?? project.area_uid;
            if (projectAreaUid !== focus.area_uid) return true;
        }
    }
    return false;
};

const lowerSet = (names: string[]) =>
    new Set(names.map((name) => name.toLowerCase()));

const tagNamesOf = (tags: Tag[] | undefined): string[] =>
    (tags ?? []).map((tag) => tag.name);

// Client-side checks for lists that are already loaded in full (the
// Projects and Notes pages filter in memory).
export const projectMatchesFocus = (
    project: Project,
    focus: Focus | null
): boolean => {
    if (!focus) return true;
    if (focus.project_uid && project.uid !== focus.project_uid) return false;
    if (focus.area_uid) {
        const areaUid = project.area?.uid ?? project.area_uid;
        if (areaUid !== focus.area_uid) return false;
    }
    if (focus.tags && focus.tags.length > 0) {
        const own = lowerSet(tagNamesOf(project.tags));
        if (!focus.tags.every((name) => own.has(name.toLowerCase()))) {
            return false;
        }
    }
    return true;
};

export const noteMatchesFocus = (
    note: {
        project_uid?: string;
        project?: { uid?: string } | null;
        tags?: Tag[];
        Tags?: Tag[];
    },
    focus: Focus | null,
    projects: Project[]
): boolean => {
    if (!focus) return true;
    const projectUid = note.project?.uid ?? note.project_uid;
    if (focus.project_uid && projectUid !== focus.project_uid) return false;
    if (focus.area_uid) {
        const project = projectUid
            ? projects.find((p) => p.uid === projectUid)
            : undefined;
        const areaUid = project?.area?.uid ?? project?.area_uid;
        if (areaUid !== focus.area_uid) return false;
    }
    if (focus.tags && focus.tags.length > 0) {
        const own = lowerSet(tagNamesOf(note.tags ?? note.Tags));
        if (!focus.tags.every((name) => own.has(name.toLowerCase()))) {
            return false;
        }
    }
    return true;
};

// Tags the capture box adds to a new task: the focus tags that the text
// did not already carry.
export const mergeFocusTags = (
    names: string[],
    focus: Focus | null
): string[] => {
    if (!focus?.tags?.length) return names;
    const own = lowerSet(names);
    return [
        ...names,
        ...focus.tags.filter((name) => !own.has(name.toLowerCase())),
    ];
};

// The area a new task gets from the Focus. A task with a project is in the
// project's area, so only a task without one carries the area itself;
// otherwise it would fall outside the Focus it was created in.
export const focusAreaIdForTask = (
    focus: Focus | null,
    projectUid: string | null | undefined,
    areas: Area[]
): number | undefined => {
    if (projectUid || !focus?.area_uid) return undefined;
    return areas.find((area) => area.uid === focus.area_uid)?.id;
};

// "Work › Launch · #urgent #deep", built from the loaded areas and projects
// so a renamed area shows its current name.
export const describeFocus = (
    focus: Focus | null,
    areas: Area[],
    projects: Project[]
): string => {
    if (!focus) return '';
    const parts: string[] = [];
    if (focus.area_uid) {
        const area = areas.find((a) => a.uid === focus.area_uid);
        parts.push(area?.name ?? '…');
    }
    if (focus.project_uid) {
        const project = projects.find((p) => p.uid === focus.project_uid);
        parts.push(project?.name ?? '…');
    }
    let label = parts.join(' › ');
    if (focus.tags && focus.tags.length > 0) {
        const tags = focus.tags.map((name) => `#${name}`).join(' ');
        label = label ? `${label} · ${tags}` : tags;
    }
    return label;
};

export const useFocus = (): Focus | null =>
    useStore((state) => state.userSettingsStore?.focus ?? null);

export const getFocus = (): Focus | null =>
    useStore.getState().userSettingsStore?.focus ?? null;

// Saves the focus for the account and keeps the store in step. The store
// is updated first so the lists react at once; a failed save puts the
// previous focus back.
export const applyFocus = async (focus: Focus | null): Promise<void> => {
    const clean = sanitizeFocus(focus);
    const previous = getFocus();
    useStore.getState().userSettingsStore.setFocus(clean);
    try {
        await updateUiSettings({ focus: clean });
    } catch (error) {
        useStore.getState().userSettingsStore.setFocus(previous);
        throw error;
    }
};
