const zlib = require('zlib');
const { gunzipWithLimit } = require('../../../utils/safe-gunzip');

describe('gunzipWithLimit', () => {
    it('inflates a payload within the limit', async () => {
        const payload = Buffer.from(JSON.stringify({ tasks: [1, 2, 3] }));

        const result = await gunzipWithLimit(zlib.gzipSync(payload), 1024);

        expect(result.toString()).toBe(payload.toString());
    });

    it('refuses a small file that inflates past the limit', async () => {
        const bomb = zlib.gzipSync(Buffer.alloc(5 * 1024 * 1024, 'a'));
        expect(bomb.length).toBeLessThan(20 * 1024);

        await expect(gunzipWithLimit(bomb, 1024 * 1024)).rejects.toMatchObject({
            statusCode: 400,
            message: 'Backup file is too large once decompressed',
        });
    });

    it('passes other gzip errors through', async () => {
        await expect(
            gunzipWithLimit(Buffer.from('not gzip data'))
        ).rejects.toMatchObject({ code: 'Z_DATA_ERROR' });
    });
});
