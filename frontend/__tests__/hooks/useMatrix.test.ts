import { snapshotMatrix, extractTaskFromQuadrants } from '../../hooks/useMatrix';
import { MatrixDetail, MatrixTask } from '../../entities/Matrix';

/** Build a minimal MatrixTask for testing. */
function mockTask(id: number, name = `Task ${id}`): MatrixTask {
    return {
        id,
        name,
        status: 0,
        priority: null,
        due_date: null,
        project_id: null,
        tags: [],
    } as MatrixTask;
}

/** Build a minimal MatrixDetail for testing. */
function mockMatrix(tasks: Record<string, MatrixTask[]> = {}): MatrixDetail {
    return {
        id: 1,
        uid: 'abc123',
        name: 'Test Matrix',
        user_id: 1,
        project_id: null,
        x_axis_label_left: 'Left',
        x_axis_label_right: 'Right',
        y_axis_label_top: 'Top',
        y_axis_label_bottom: 'Bottom',
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
        quadrants: {
            '0': tasks['0'] || [],
            '1': tasks['1'] || [],
            '2': tasks['2'] || [],
            '3': tasks['3'] || [],
        },
        unassigned: [],
    };
}

describe('useMatrix helpers', () => {
    describe('snapshotMatrix', () => {
        it('should return a new object', () => {
            const original = mockMatrix();
            const snapshot = snapshotMatrix(original);

            expect(snapshot).not.toBe(original);
        });

        it('should deep-clone quadrant arrays', () => {
            const t1 = mockTask(1);
            const original = mockMatrix({ '0': [t1] });
            const snapshot = snapshotMatrix(original);

            // Modifying snapshot's quadrant should NOT affect original
            snapshot.quadrants['0'].push(mockTask(2));
            expect(original.quadrants['0']).toHaveLength(1);
            expect(snapshot.quadrants['0']).toHaveLength(2);
        });

        it('should deep-clone unassigned array', () => {
            const original = mockMatrix();
            original.unassigned = [mockTask(1)];
            const snapshot = snapshotMatrix(original);

            snapshot.unassigned.push(mockTask(2));
            expect(original.unassigned).toHaveLength(1);
            expect(snapshot.unassigned).toHaveLength(2);
        });

        it('should preserve scalar properties', () => {
            const original = mockMatrix();
            const snapshot = snapshotMatrix(original);

            expect(snapshot.id).toBe(original.id);
            expect(snapshot.name).toBe(original.name);
            expect(snapshot.x_axis_label_left).toBe(original.x_axis_label_left);
        });
    });

    describe('extractTaskFromQuadrants', () => {
        it('should find and remove a task from its quadrant', () => {
            const t1 = mockTask(1);
            const t2 = mockTask(2);
            const quadrants: Record<string, MatrixTask[]> = {
                '0': [t1],
                '1': [t2],
                '2': [],
                '3': [],
            };

            const result = extractTaskFromQuadrants(quadrants, 1);

            expect(result).not.toBeNull();
            expect(result!.id).toBe(1);
            expect(quadrants['0']).toHaveLength(0);
            expect(quadrants['1']).toHaveLength(1);
        });

        it('should return null if task is not found', () => {
            const quadrants: Record<string, MatrixTask[]> = {
                '0': [mockTask(1)],
                '1': [],
                '2': [],
                '3': [],
            };

            const result = extractTaskFromQuadrants(quadrants, 999);

            expect(result).toBeNull();
            expect(quadrants['0']).toHaveLength(1); // unchanged
        });

        it('should return a shallow copy of the task', () => {
            const original = mockTask(1, 'Original');
            const quadrants: Record<string, MatrixTask[]> = {
                '0': [original],
                '1': [],
                '2': [],
                '3': [],
            };

            const result = extractTaskFromQuadrants(quadrants, 1);

            expect(result).not.toBe(original); // different reference
            expect(result!.name).toBe('Original');
        });

        it('should mutate the quadrants object (remove from source)', () => {
            const quadrants: Record<string, MatrixTask[]> = {
                '0': [mockTask(1), mockTask(2), mockTask(3)],
                '1': [],
                '2': [],
                '3': [],
            };

            extractTaskFromQuadrants(quadrants, 2);

            expect(quadrants['0']).toHaveLength(2);
            expect(quadrants['0'].map((t) => t.id)).toEqual([1, 3]);
        });

        it('should work when task is in last quadrant', () => {
            const quadrants: Record<string, MatrixTask[]> = {
                '0': [],
                '1': [],
                '2': [],
                '3': [mockTask(42)],
            };

            const result = extractTaskFromQuadrants(quadrants, 42);

            expect(result).not.toBeNull();
            expect(result!.id).toBe(42);
            expect(quadrants['3']).toHaveLength(0);
        });
    });
});
