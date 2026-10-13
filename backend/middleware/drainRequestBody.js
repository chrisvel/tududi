// Hold a response back until an unread request body has been drained.
//
// Node tears the socket down when a response ends before its request body has
// been read: the client is still writing, so its bytes meet a closed connection
// and it never gets to read the status that was just sent. The client sees
// ECONNRESET instead of the 401 or 403.
//
// Every middleware that can refuse a request ahead of the parser that would
// have read its body runs into this - the auth guard, a rate limiter, a feature
// gate, CSRF - and the largest bodies belong to the routes most likely to
// refuse one: an upload that is not signed in. Mounted once, after the body
// parsers, it holds such a response until the body has been read and discarded.
// A body those parsers already consumed (JSON, urlencoded) or a request that
// never had one leaves `req.complete` true and the response goes out untouched.
//
// The body is discarded, not parsed; Node's own requestTimeout still bounds a
// client that stops writing without ever finishing.

function drainRequestBody(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return next();
    }

    const end = res.end;
    let alreadyWaited = false;

    res.end = function (...args) {
        const self = this;

        if (alreadyWaited || req.readableEnded || req.complete) {
            return end.apply(self, args);
        }

        alreadyWaited = true;

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            end.apply(self, args);
        };

        req.on('end', finish);
        req.on('error', finish);
        // The client gave up, so there is nothing left to deliver.
        req.on('close', finish);
        req.resume();

        return self;
    };

    return next();
}

module.exports = drainRequestBody;
