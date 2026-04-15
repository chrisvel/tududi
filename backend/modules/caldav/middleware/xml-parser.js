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
            console.log('[XML-PARSER] Processing', req.method, contentType);
            const chunks = [];

            for await (const chunk of req) {
                console.log('[XML-PARSER] Got chunk:', chunk.length);
                chunks.push(chunk);
            }

            req.rawBody = Buffer.concat(chunks).toString('utf8');
            console.log('[XML-PARSER] Total body length:', req.rawBody.length);
            next();
        } catch (error) {
            console.error('XML parser error:', error);
            return res.status(400).json({ error: 'Invalid request body' });
        }
    } else {
        console.log('[XML-PARSER] Skipping', req.method, contentType);
        next();
    }
}

module.exports = xmlParser;
