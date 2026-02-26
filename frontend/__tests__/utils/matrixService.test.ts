import {
    fetchMatrices,
    fetchMatrix,
    createMatrix,
    updateMatrix,
    deleteMatrix,
    assignTaskToMatrix,
    removeTaskFromMatrix,
    fetchTaskMatrices,
    fetchAllPlacements,
    browseMatrixTasks,
} from '../../utils/matrixService';

/* ------------------------------------------------------------------ */
/* Mock global fetch                                                   */
/* ------------------------------------------------------------------ */
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
    return Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(body),
    } as Response);
}

beforeEach(() => {
    mockFetch.mockReset();
});

/* ------------------------------------------------------------------ */
/* fetchMatrices                                                       */
/* ------------------------------------------------------------------ */
describe('fetchMatrices', () => {
    it('should call the matrices endpoint', async () => {
        const payload = { success: true, data: [] };
        mockFetch.mockReturnValue(jsonResponse(payload));

        const result = await fetchMatrices();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][0]).toMatch(/matrices$/);
        expect(result).toEqual(payload);
    });

    it('should include project_id query param when provided', async () => {
        mockFetch.mockReturnValue(jsonResponse({ success: true, data: [] }));

        await fetchMatrices(5);

        expect(mockFetch.mock.calls[0][0]).toContain('project_id=5');
    });

    it('should throw on non-ok response', async () => {
        mockFetch.mockReturnValue(jsonResponse({}, false));

        await expect(fetchMatrices()).rejects.toThrow('Failed to fetch matrices');
    });
});

/* ------------------------------------------------------------------ */
/* fetchMatrix                                                         */
/* ------------------------------------------------------------------ */
describe('fetchMatrix', () => {
    it('should fetch a single matrix by id', async () => {
        const payload = { success: true, data: { id: 1 } };
        mockFetch.mockReturnValue(jsonResponse(payload));

        const result = await fetchMatrix(1);

        expect(mockFetch.mock.calls[0][0]).toMatch(/matrices\/1$/);
        expect(result).toEqual(payload);
    });

    it('should throw on non-ok response', async () => {
        mockFetch.mockReturnValue(jsonResponse({}, false));

        await expect(fetchMatrix(1)).rejects.toThrow('Failed to load matrix');
    });
});

/* ------------------------------------------------------------------ */
/* createMatrix                                                        */
/* ------------------------------------------------------------------ */
describe('createMatrix', () => {
    it('should POST to matrices endpoint', async () => {
        const input = { name: 'Test Matrix' };
        const payload = { success: true, data: { id: 1, ...input } };
        mockFetch.mockReturnValue(jsonResponse(payload));

        const result = await createMatrix(input);

        expect(mockFetch.mock.calls[0][1].method).toBe('POST');
        expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(input);
        expect(result).toEqual(payload);
    });

    it('should throw server error message on failure', async () => {
        mockFetch.mockReturnValue(
            jsonResponse({ message: 'Name required' }, false)
        );

        await expect(createMatrix({})).rejects.toThrow('Name required');
    });
});

/* ------------------------------------------------------------------ */
/* updateMatrix                                                        */
/* ------------------------------------------------------------------ */
describe('updateMatrix', () => {
    it('should PUT to matrices/:id', async () => {
        const payload = { success: true, data: { id: 1, name: 'Updated' } };
        mockFetch.mockReturnValue(jsonResponse(payload));

        const result = await updateMatrix(1, { name: 'Updated' });

        expect(mockFetch.mock.calls[0][0]).toMatch(/matrices\/1$/);
        expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
        expect(result).toEqual(payload);
    });

    it('should throw server error message on failure', async () => {
        mockFetch.mockReturnValue(
            jsonResponse({ message: 'Not found' }, false)
        );

        await expect(updateMatrix(99, {})).rejects.toThrow('Not found');
    });
});

/* ------------------------------------------------------------------ */
/* deleteMatrix                                                        */
/* ------------------------------------------------------------------ */
describe('deleteMatrix', () => {
    it('should DELETE matrices/:id', async () => {
        mockFetch.mockReturnValue(
            jsonResponse({ success: true, message: 'Deleted' })
        );

        const result = await deleteMatrix(1);

        expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
        expect(result.message).toBe('Deleted');
    });

    it('should throw on failure', async () => {
        mockFetch.mockReturnValue(jsonResponse({}, false));

        await expect(deleteMatrix(1)).rejects.toThrow('Failed to delete matrix');
    });
});

/* ------------------------------------------------------------------ */
/* assignTaskToMatrix                                                  */
/* ------------------------------------------------------------------ */
describe('assignTaskToMatrix', () => {
    it('should PUT to matrices/:matrixId/tasks/:taskId', async () => {
        const payload = { success: true, data: {}, message: 'Assigned' };
        mockFetch.mockReturnValue(jsonResponse(payload));

        await assignTaskToMatrix(1, 42, 2, 3);

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body).toEqual({ quadrant_index: 2, position: 3 });
        expect(mockFetch.mock.calls[0][0]).toMatch(/matrices\/1\/tasks\/42$/);
    });

    it('should default position to 0', async () => {
        mockFetch.mockReturnValue(jsonResponse({ success: true, data: {} }));

        await assignTaskToMatrix(1, 42, 1);

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.position).toBe(0);
    });

    it('should throw server error message on failure', async () => {
        mockFetch.mockReturnValue(
            jsonResponse({ message: 'Invalid quadrant' }, false)
        );

        await expect(assignTaskToMatrix(1, 42, 9)).rejects.toThrow(
            'Invalid quadrant'
        );
    });
});

/* ------------------------------------------------------------------ */
/* removeTaskFromMatrix                                                */
/* ------------------------------------------------------------------ */
describe('removeTaskFromMatrix', () => {
    it('should DELETE matrices/:matrixId/tasks/:taskId', async () => {
        mockFetch.mockReturnValue(
            jsonResponse({ success: true, message: 'Removed' })
        );

        const result = await removeTaskFromMatrix(1, 42);

        expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
        expect(result.message).toBe('Removed');
    });
});

/* ------------------------------------------------------------------ */
/* fetchTaskMatrices                                                   */
/* ------------------------------------------------------------------ */
describe('fetchTaskMatrices', () => {
    it('should GET tasks/:taskId/matrices', async () => {
        mockFetch.mockReturnValue(
            jsonResponse({ success: true, data: [] })
        );

        await fetchTaskMatrices(42);

        expect(mockFetch.mock.calls[0][0]).toMatch(/tasks\/42\/matrices$/);
    });
});

/* ------------------------------------------------------------------ */
/* fetchAllPlacements                                                  */
/* ------------------------------------------------------------------ */
describe('fetchAllPlacements', () => {
    it('should GET matrices/placements', async () => {
        mockFetch.mockReturnValue(
            jsonResponse({ success: true, data: [] })
        );

        await fetchAllPlacements();

        expect(mockFetch.mock.calls[0][0]).toMatch(/matrices\/placements$/);
    });
});

/* ------------------------------------------------------------------ */
/* browseMatrixTasks                                                   */
/* ------------------------------------------------------------------ */
describe('browseMatrixTasks', () => {
    it('should GET matrices/:id/browse with source and sourceId', async () => {
        mockFetch.mockReturnValue(
            jsonResponse({ success: true, data: [] })
        );

        await browseMatrixTasks(1, 'project', 5);

        const url = mockFetch.mock.calls[0][0];
        expect(url).toMatch(/matrices\/1\/browse/);
        expect(url).toContain('source=project');
        expect(url).toContain('sourceId=5');
    });

    it('should throw on failure', async () => {
        mockFetch.mockReturnValue(jsonResponse({}, false));

        await expect(browseMatrixTasks(1, 'area', 2)).rejects.toThrow(
            'Failed to browse tasks'
        );
    });
});
