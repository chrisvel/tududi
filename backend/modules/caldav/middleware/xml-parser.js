async function xmlParser(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const hasBody =
        req.method === 'POST' ||
        req.method === 'PUT' ||
        req.method === 'PROPFIND' ||
        req.method === 'REPORT';

    if (
        hasBody &&
        contentLength > 0 &&
        (contentType.includes('xml') ||
            contentType.includes('text/calendar') ||
            req.method === 'PROPFIND' ||
            req.method === 'REPORT')
    ) {
        if (req.rawBody) {
            console.log('[XML-PARSER] Already processed, skipping');
            return next();
        }

        try {
            console.log('[XML-PARSER] Processing', req.method, contentType);
            const chunks = [];

            for await (const chunk of req) {
                console.log('[XML-PARSER] Got chunk:', chunk.length);
                chunks.push(chunk);
            }

            req.rawBody = Buffer.concat(chunks).toString('utf8');
            console.log('[XML-PARSER] Total body length:', req.rawBody.length);
            return next();
        } catch (error) {
            console.error('XML parser error:', error);
            return res.status(400).json({ error: 'Invalid request body' });
        }
    } else {
        console.log('[XML-PARSER] Skipping', req.method, contentType);
        return next();
    }
}

module.exports = xmlParser;
