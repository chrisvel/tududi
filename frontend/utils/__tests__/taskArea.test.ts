import { resolveTaskArea } from '../taskArea';

const areas = [
    { id: 1, uid: 'a1', name: 'Health' },
    { id: 2, uid: 'a2', name: 'Work' },
];
const projects = [
    { id: 10, name: 'Gym', area_id: 1 },
    { id: 11, name: 'Loose', area_id: null },
] as never[];

describe('resolveTaskArea', () => {
    it('uses the task own area first', () => {
        expect(resolveTaskArea({ area_id: 2 }, 10, projects, areas)).toEqual({
            area: areas[1],
            inherited: false,
        });
    });

    it('falls back to the project area and marks it inherited', () => {
        expect(resolveTaskArea({}, 10, projects, areas)).toEqual({
            area: areas[0],
            inherited: true,
        });
    });

    it('returns no area when neither the task nor its project has one', () => {
        expect(resolveTaskArea({}, 11, projects, areas).area).toBeNull();
        expect(resolveTaskArea({}, null, projects, areas).area).toBeNull();
        expect(resolveTaskArea({}, 99, projects, areas).area).toBeNull();
    });
});
