const getRawBody = require('raw-body');

async function xmlParser(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    const hasBody =
        req.method === 'POST' ||
        req.method === 'PUT' ||
        req.method === 'PROPFIND' ||
        req.method === 'REPORT';

    if (
        hasBody &&
        (contentType.includes('xml') ||
            contentType.includes('text/calendar') ||
            req.method === 'PROPFIND' ||
            req.method === 'REPORT')
    ) {
        try {
            const buffer = await getRawBody(req, {
                length: req.headers['content-length'],
                limit: '1mb',
                encoding: 'utf8',
            });

            req.rawBody = buffer.toString('utf8');
            next();
        } catch (error) {
            console.error('XML parser error:', error);
            return res.status(400).json({ error: 'Invalid request body' });
        }
    } else {
        next();
    }
}

module.exports = xmlParser;
