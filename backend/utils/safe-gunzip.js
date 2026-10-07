const zlib = require('zlib');
const { promisify } = require('util');
const { ValidationError } = require('../shared/errors');

const gunzip = promisify(zlib.gunzip);

// V8 cannot hold a string much beyond 512 MiB, so a backup that inflates past
// this could not be parsed anyway. A small upload can expand a thousandfold,
// so the limit is enforced while inflating rather than after.
const DEFAULT_MAX_DECOMPRESSED_BYTES = 500 * 1024 * 1024;

async function gunzipWithLimit(
    buffer,
    maxBytes = DEFAULT_MAX_DECOMPRESSED_BYTES
) {
    try {
        return await gunzip(buffer, { maxOutputLength: maxBytes });
    } catch (error) {
        if (error.code === 'ERR_BUFFER_TOO_LARGE') {
            throw new ValidationError(
                'Backup file is too large once decompressed'
            );
        }
        throw error;
    }
}

module.exports = { gunzipWithLimit, DEFAULT_MAX_DECOMPRESSED_BYTES };
