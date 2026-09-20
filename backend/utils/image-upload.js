const crypto = require('crypto');

// Avatars and project images are served back through /api/uploads, so the
// stored extension comes from the validated MIME type rather than the
// client-supplied filename, and the name itself is unguessable.
const IMAGE_MIME_EXTENSIONS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
};

const imageFileFilter = (message) => (req, file, cb) => {
    if (IMAGE_MIME_EXTENSIONS[file.mimetype]) {
        return cb(null, true);
    }
    return cb(new Error(message));
};

const randomUploadName = (prefix, mimetype) =>
    `${prefix}-${Date.now()}-${crypto.randomBytes(12).toString('hex')}${
        IMAGE_MIME_EXTENSIONS[mimetype] || ''
    }`;

module.exports = {
    IMAGE_MIME_EXTENSIONS,
    imageFileFilter,
    randomUploadName,
};
