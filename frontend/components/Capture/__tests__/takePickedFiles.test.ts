import { takePickedFiles } from '../useCaptureFiles';

const inputWith = (files: File[]) => {
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: files });
    let value = 'C:\\fakepath\\photo.jpg';
    Object.defineProperty(input, 'value', {
        get: () => value,
        set: (next: string) => {
            value = next;
        },
    });
    return input;
};

describe('takePickedFiles', () => {
    it('copies the picked files into memory, then clears the input', async () => {
        const original = new File(['photo bytes'], 'photo.jpg', {
            type: 'image/jpeg',
            lastModified: 1000,
        });
        Object.defineProperty(original, 'arrayBuffer', {
            value: () =>
                Promise.resolve(new TextEncoder().encode('photo bytes').buffer),
        });
        const input = inputWith([original]);

        const [copy] = await takePickedFiles(input);

        expect(copy).not.toBe(original);
        expect(copy.name).toBe('photo.jpg');
        expect(copy.type).toBe('image/jpeg');
        expect(copy.size).toBe(original.size);
        expect(input.value).toBe('');
    });

    it('keeps the original file when it cannot be read', async () => {
        const original = new File(['x'], 'broken.jpg', { type: 'image/jpeg' });
        Object.defineProperty(original, 'arrayBuffer', {
            value: () => Promise.reject(new Error('unreadable')),
        });
        const input = inputWith([original]);

        const [kept] = await takePickedFiles(input);

        expect(kept).toBe(original);
        expect(input.value).toBe('');
    });
});
