import { Area } from '../entities/Area';
import { Project } from '../entities/Project';

export interface TaskAreaInfo {
    area: Area | null;
    // True when the task has no area of its own and takes its project's.
    inherited: boolean;
}

// The area a task belongs to: its own area when set, otherwise the area of
// its project. Task lists don't carry the project's area, so it is looked up
// in the projects and areas the user already has loaded.
export const resolveTaskArea = (
    task: { area_id?: number | null; Area?: Area | null },
    projectId: number | null | undefined,
    projects: Project[],
    areas: Area[]
): TaskAreaInfo => {
    if (task.area_id) {
        const own = task.Area || areas.find((area) => area.id === task.area_id);
        return { area: own || null, inherited: false };
    }
    if (!projectId) return { area: null, inherited: false };
    const project = projects.find((p) => p.id === projectId);
    if (!project?.area_id) return { area: null, inherited: false };
    const area = areas.find((a) => a.id === project.area_id) || null;
    return { area, inherited: !!area };
};
