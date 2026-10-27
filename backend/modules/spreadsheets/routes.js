'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const exportService = require('./exportService');
const importService = require('./importService');
const { ValidationError } = require('../../shared/errors');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.csv', '.tsv', '.txt', '.xlsx', '.xls'];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        const name = String(file.originalname || '').toLowerCase();
        if (ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
            return cb(null, true);
        }
        cb(new ValidationError('Choose a .csv or .xlsx file.'));
    },
});

function receiveFile(req, res, next) {
    upload.single('file')(req, res, (error) => {
        if (error?.code === 'LIMIT_FILE_SIZE') {
            return next(
                new ValidationError('The file is too large (5 MB at most).')
            );
        }
        next(error);
    });
}

const CONTENT_TYPES = {
    csv: 'text/csv; charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function sendFile(res, { buffer, format, fileName }) {
    res.set({
        'Content-Type': CONTENT_TYPES[format],
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
    });
    res.send(buffer);
}

const handle = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    } catch (error) {
        next(error);
    }
};

router.get(
    '/export/tasks',
    handle(async (req, res) => {
        sendFile(
            res,
            await exportService.exportTasks(req.currentUser, req.query)
        );
    })
);

router.get(
    '/export/template',
    handle(async (req, res) => {
        sendFile(
            res,
            await exportService.exportTemplate(req.currentUser, req.query)
        );
    })
);

router.get(
    '/imports',
    handle(async (req, res) => {
        res.json(await importService.list(req.currentUser));
    })
);

router.post(
    '/imports',
    receiveFile,
    handle(async (req, res) => {
        const job = await importService.upload(req.currentUser, req.file, {
            encoding: req.body?.encoding,
        });
        res.status(201).json(job);
    })
);

router.get(
    '/imports/:uid',
    handle(async (req, res) => {
        res.json(await importService.get(req.currentUser, req.params.uid));
    })
);

router.post(
    '/imports/:uid/columns',
    handle(async (req, res) => {
        res.json(
            await importService.columns(
                req.currentUser,
                req.params.uid,
                req.body || {}
            )
        );
    })
);

router.post(
    '/imports/:uid/preview',
    handle(async (req, res) => {
        res.json(
            await importService.preview(
                req.currentUser,
                req.params.uid,
                req.body || {}
            )
        );
    })
);

router.post(
    '/imports/:uid/commit',
    handle(async (req, res) => {
        res.json(
            await importService.commit(
                req.currentUser,
                req.params.uid,
                req.body || {}
            )
        );
    })
);

router.post(
    '/imports/:uid/undo',
    handle(async (req, res) => {
        res.json(await importService.undo(req.currentUser, req.params.uid));
    })
);

router.delete(
    '/imports/:uid',
    handle(async (req, res) => {
        await importService.discard(req.currentUser, req.params.uid);
        res.status(204).end();
    })
);

module.exports = router;
