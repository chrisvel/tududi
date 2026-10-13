import { fetchNoteBySlug, prefetchNoteFromPath } from '../notesService';

const note = { uid: 'abc123', title: 'Linked note' };

const okResponse = () =>
    Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(note),
    } as unknown as Response);

describe('note prefetch on boot (#1785)', () => {
    beforeEach(() => {
        global.fetch = jest.fn(okResponse) as jest.Mock;
    });

    it('reuses the request started at boot for the linked note', async () => {
        prefetchNoteFromPath('/notes/abc123');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        await expect(fetchNoteBySlug('abc123')).resolves.toEqual(note);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Used once: later loads fetch fresh data.
        await fetchNoteBySlug('abc123');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('ignores the prefetch when a different note is asked for', async () => {
        prefetchNoteFromPath('/notes/abc123');
        await fetchNoteBySlug('other-note');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('does nothing outside a note path', () => {
        prefetchNoteFromPath('/notes');
        prefetchNoteFromPath('/today');
        prefetchNoteFromPath('/public/notes/token');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
