const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { logError } = require('../services/logService');
const router = express.Router();

let nodeFetchInstance = null;
try {
    // eslint-disable-next-line global-require
    nodeFetchInstance = require('node-fetch');
} catch {
    nodeFetchInstance = null;
}

const getFetchImplementation = () => {
    if (typeof fetch === 'function') {
        return fetch;
    }
    if (nodeFetchInstance) {
        return nodeFetchInstance;
    }
    return null;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 7000) => {
    const fetchFn = getFetchImplementation();
    if (!fetchFn) {
        throw new Error('Fetch API is not available in this environment');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchFn(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
};

// Fast regex-based metadata extraction (much faster than cheerio for head content)
function extractMetadataFromHtml(html) {
    try {
        // Extract title with priority: og:title > twitter:title > title tag
        let title = null;

        // Try og:title first
        const ogTitleMatch = html.match(
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
        );
        if (ogTitleMatch) {
            title = ogTitleMatch[1];
        } else {
            // Try twitter:title
            const twitterTitleMatch = html.match(
                /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i
            );
            if (twitterTitleMatch) {
                title = twitterTitleMatch[1];
            } else {
                // Fallback to title tag
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (titleMatch) {
                    title = titleMatch[1].trim();
                }
            }
        }

        // Clean up title
        if (title) {
            title = title.trim();
            // Decode common HTML entities
            title = title
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");

            if (title.length > 100) {
                title = title.substring(0, 100) + '...';
            }
        }

        // Extract image with priority: og:image > twitter:image
        let image = null;
        const ogImageMatch = html.match(
            /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
        );
        if (ogImageMatch) {
            image = ogImageMatch[1];
        } else {
            const twitterImageMatch = html.match(
                /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
            );
            if (twitterImageMatch) {
                image = twitterImageMatch[1];
            }
        }

        // Extract description
        let description = null;
        const ogDescMatch = html.match(
            /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
        );
        if (ogDescMatch) {
            description = ogDescMatch[1];
        } else {
            const twitterDescMatch = html.match(
                /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i
            );
            if (twitterDescMatch) {
                description = twitterDescMatch[1];
            } else {
                const metaDescMatch = html.match(
                    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
                );
                if (metaDescMatch) {
                    description = metaDescMatch[1];
                }
            }
        }

        if (description && description.length > 150) {
            description = description.substring(0, 150) + '...';
        }

        return {
            title,
            image,
            description,
        };
    } catch (error) {
        logError('Error parsing HTML:', error);
        return { title: null, image: null, description: null };
    }
}

// Helper function to check if text is a URL
function isUrl(text) {
    const urlRegex =
        /^(https?:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i;
    return urlRegex.test(text.trim());
}

// Helper function to resolve relative URLs to absolute URLs
function resolveUrl(baseUrl, relativeUrl) {
    try {
        return new URL(relativeUrl, baseUrl).href;
    } catch {
        return relativeUrl;
    }
}

// Helper function to handle YouTube URLs specially
function handleYouTubeUrl(url) {
    const youtubeRegex =
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);

    if (match) {
        const videoId = match[1];

        // For now, return basic YouTube info - this is fast and reliable
        return {
            title: 'YouTube Video',
            image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            description: 'YouTube video',
        };
    }

    return null;
}

const finalizeMetadata = (metadata, sourceUrl) => {
    if (!metadata) {
        return null;
    }

    const enriched = { ...metadata };

    if (
        enriched.image &&
        !enriched.image.startsWith('http') &&
        !enriched.image.startsWith('//')
    ) {
        enriched.image = resolveUrl(sourceUrl, enriched.image);
    }

    if (!enriched.title) {
        try {
            enriched.title = new URL(sourceUrl).hostname;
        } catch {
            enriched.title = sourceUrl;
        }
    }

    return enriched;
};

// Helper function to fetch URL metadata with proper redirect/timeout handling
async function fetchUrlMetadata(url) {
    if (!url) {
        return null;
    }

    let normalizedUrl = url.trim();
    if (
        !normalizedUrl.startsWith('http://') &&
        !normalizedUrl.startsWith('https://')
    ) {
        normalizedUrl = `https://${normalizedUrl}`;
    }

    // Handle YouTube URLs specially to avoid anti-bot issues
    if (
        normalizedUrl.includes('youtube.com') ||
        normalizedUrl.includes('youtu.be')
    ) {
        const youtubeMetadata = handleYouTubeUrl(normalizedUrl);
        if (youtubeMetadata) {
            return youtubeMetadata;
        }
    }

    try {
        if (getFetchImplementation()) {
            const metadata = await fetchMetadataViaFetch(normalizedUrl);
            if (metadata) {
                return metadata;
            }
        }
    } catch (error) {
        logError('Error fetching URL metadata via fetch:', error);
    }

    const httpMetadata = await fetchMetadataViaHttp(normalizedUrl);
    if (httpMetadata) {
        return httpMetadata;
    }

    try {
        const proxyMetadata = await fetchMetadataViaProxy(normalizedUrl);
        if (proxyMetadata) {
            return proxyMetadata;
        }
    } catch (error) {
        logError('Error fetching URL metadata via proxy:', error);
    }

    return null;
}

async function fetchMetadataViaFetch(normalizedUrl) {
    const response = await fetchWithTimeout(
        normalizedUrl,
        {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        },
        7000
    );

    if (!response || !response.ok) {
        return null;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('text/html')) {
        return null;
    }

    const html = await response.text();
    if (!html) {
        return null;
    }

    return finalizeMetadata(extractMetadataFromHtml(html), normalizedUrl);
}

function fetchMetadataViaHttp(normalizedUrl, maxRedirects = 5) {
    return new Promise((resolve) => {
        let finished = false;
        const fallbackResolve = (metadata, sourceUrl = normalizedUrl) => {
            if (finished) {
                return;
            }
            finished = true;
            clearTimeout(globalTimeout);
            resolve(finalizeMetadata(metadata, sourceUrl));
        };

        const globalTimeout = setTimeout(() => {
            fallbackResolve(null);
        }, 6000);

        function makeRequest(currentUrl, redirectCount = 0) {
            if (redirectCount > maxRedirects) {
                clearTimeout(globalTimeout);
                fallbackResolve(null);
                return;
            }

            try {
                const urlObj = new URL(currentUrl);
                const isHttps = urlObj.protocol === 'https:';
                const client = isHttps ? https : http;

                const options = {
                    hostname: urlObj.hostname,
                    port: urlObj.port || (isHttps ? 443 : 80),
                    path: urlObj.pathname + urlObj.search || '/',
                    method: 'GET',
                    timeout: 4000,
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    },
                };

                const req = client.request(options, (res) => {
                    let resolvedForRequest = false;
                    const conclude = (metadata) => {
                        if (resolvedForRequest) {
                            return;
                        }
                        resolvedForRequest = true;
                        fallbackResolve(metadata, currentUrl);
                    };

                    if (
                        [301, 302, 303, 307, 308].includes(res.statusCode) &&
                        res.headers.location
                    ) {
                        const redirectUrl = new URL(
                            res.headers.location,
                            currentUrl
                        ).href;
                        res.resume();
                        makeRequest(redirectUrl, redirectCount + 1);
                        return;
                    }

                    if (res.statusCode < 200 || res.statusCode >= 400) {
                        conclude(null);
                        return;
                    }

                    let data = '';
                    let totalBytes = 0;
                    const maxBytes = 40000;
                    let foundMeta = false;

                    res.on('data', (chunk) => {
                        totalBytes += chunk.length;
                        if (totalBytes > maxBytes) {
                            res.destroy();
                            conclude(extractMetadataFromHtml(data));
                            return;
                        }
                        data += chunk;

                        if (
                            !foundMeta &&
                            (data.includes('og:title') ||
                                data.includes('twitter:title') ||
                                data.includes('</title>'))
                        ) {
                            foundMeta = true;
                        }

                        if (foundMeta && data.includes('</head>')) {
                            res.destroy();
                            conclude(extractMetadataFromHtml(data));
                        }
                    });

                    res.on('end', () => {
                        conclude(extractMetadataFromHtml(data));
                    });
                    res.on('error', () => {
                        conclude(null);
                    });
                });

                req.on('error', () => {
                    fallbackResolve(null);
                });

                req.on('timeout', () => {
                    req.destroy();
                    fallbackResolve(null);
                });

                req.end();
            } catch (error) {
                clearTimeout(globalTimeout);
                fallbackResolve(null);
            }
        }

        makeRequest(normalizedUrl);
    });
}

async function fetchMetadataViaProxy(normalizedUrl) {
    const fetchFn = getFetchImplementation();
    if (!fetchFn) {
        return null;
    }

    const proxiedUrl = `https://r.jina.ai/${normalizedUrl}`;

    const response = await fetchWithTimeout(
        proxiedUrl,
        {
            method: 'GET',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml',
            },
        },
        7000
    );

    if (!response || !response.ok) {
        return null;
    }

    const html = await response.text();
    if (!html) {
        return null;
    }

    return finalizeMetadata(extractMetadataFromHtml(html), normalizedUrl);
}

// GET /api/url/title
router.get('/url/title', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        const metadata = await fetchUrlMetadata(url);

        if (metadata && metadata.title) {
            res.json({
                url,
                title: metadata.title,
                image: metadata.image,
                description: metadata.description,
            });
        } else {
            res.json({
                url,
                title: null,
                image: null,
                description: null,
                error: 'Could not extract metadata',
            });
        }
    } catch (error) {
        logError('Error extracting URL title:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/url/extract-from-text
router.post('/url/extract-from-text', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res
                .status(400)
                .json({ error: 'Text parameter is required' });
        }

        // Enhanced URL extraction - look for URLs with or without protocol
        const urlWithProtocolRegex = /(https?:\/\/[^\s]+)/gi;
        const urlWithoutProtocolRegex =
            /(?:^|\s)((?:www\.)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(?::[0-9]{1,5})?(?:\/[^\s]*)?)/gi;

        let urls = text.match(urlWithProtocolRegex);

        // If no URLs with protocol found, look for URLs without protocol
        if (!urls) {
            const matches = text.match(urlWithoutProtocolRegex);
            if (matches) {
                // Clean up the matches (remove leading whitespace)
                urls = matches.map((match) => match.trim());
            }
        }

        if (urls && urls.length > 0) {
            const firstUrl = urls[0];
            const metadata = await fetchUrlMetadata(firstUrl);

            if (metadata && metadata.title) {
                res.json({
                    found: true,
                    url: firstUrl,
                    title: metadata.title,
                    image: metadata.image,
                    description: metadata.description,
                    originalText: text,
                });
            } else {
                res.json({
                    found: true,
                    url: firstUrl,
                    title: null,
                    image: null,
                    description: null,
                    originalText: text,
                });
            }
        } else {
            res.json({ found: false });
        }
    } catch (error) {
        logError('Error extracting URL from text:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
