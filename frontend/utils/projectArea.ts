import { Area } from '../entities/Area';
import { Project } from '../entities/Project';

// The UID of the area a project sits in, as the viewer sees it. The projects
// list (GET /api/projects) carries `area_id` and the `Area` association, not
// `area` or `area_uid`, and for a shared project both already hold the
// viewer's own placement - so the id is looked up in the loaded areas.
export const projectAreaUid = (
    project: Pick<Project, 'area' | 'area_id' | 'area_uid'>,
    areas: Area[]
): string | null => {
    if (project.area_id) {
        const area = areas.find((a) => a.id === project.area_id);
        if (area?.uid) return area.uid;
    }
    return project.area?.uid ?? project.area_uid ?? null;
};
