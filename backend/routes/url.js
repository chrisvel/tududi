const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const router = express.Router();

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
        console.error('Error parsing HTML:', error);
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

// Helper function to fetch URL metadata with redirect handling
async function fetchUrlMetadata(url, maxRedirects = 5) {
    return new Promise((resolve) => {
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }

        // Handle YouTube URLs specially to avoid anti-bot issues
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const youtubeMetadata = handleYouTubeUrl(url);
            if (youtubeMetadata) {
                resolve(youtubeMetadata);
            } else {
                resolve(null);
            }
            return;
        }

        // Global timeout for the entire operation
        const globalTimeout = setTimeout(() => {
            resolve(null);
        }, 3000); // 3 second max for entire operation

        function makeRequest(currentUrl, redirectCount = 0) {
            if (redirectCount > maxRedirects) {
                clearTimeout(globalTimeout);
                resolve(null);
                return;
            }

            try {
                const urlObj = new URL(currentUrl);
                const isHttps = urlObj.protocol === 'https:';
                const client = isHttps ? https : http;

                const options = {
                    hostname: urlObj.hostname,
                    port: urlObj.port || (isHttps ? 443 : 80),
                    path: urlObj.pathname + urlObj.search,
                    method: 'GET',
                    timeout: 2000, // Reduced from 5000ms to 2000ms
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    },
                };

                const req = client.request(options, (res) => {
                    // Handle redirects (301, 302, 303, 307, 308)
                    if (
                        [301, 302, 303, 307, 308].includes(res.statusCode) &&
                        res.headers.location
                    ) {
                        const redirectUrl = new URL(
                            res.headers.location,
                            currentUrl
                        ).href;
                        makeRequest(redirectUrl, redirectCount + 1);
                        return;
                    }

                    // If not a successful response, resolve with null
                    if (res.statusCode < 200 || res.statusCode >= 400) {
                        clearTimeout(globalTimeout);
                        resolve(null);
                        return;
                    }

                    let data = '';
                    let totalBytes = 0;
                    const maxBytes = 20000; // Reduced from 100KB to 20KB - most meta tags are in head
                    let foundMeta = false;

                    res.on('data', (chunk) => {
                        totalBytes += chunk.length;
                        if (totalBytes > maxBytes) {
                            clearTimeout(globalTimeout);
                            req.destroy();
                            return;
                        }
                        data += chunk;

                        // Early termination if we've found essential meta tags and closed head
                        if (
                            !foundMeta &&
                            (data.includes('og:title') ||
                                data.includes('twitter:title') ||
                                data.includes('</title>'))
                        ) {
                            foundMeta = true;
                        }

                        // Stop early if we have meta tags and hit end of head
                        if (foundMeta && data.includes('</head>')) {
                            clearTimeout(globalTimeout);
                            req.destroy();
                            return;
                        }
                    });

                    res.on('end', () => {
                        clearTimeout(globalTimeout);
                        const metadata = extractMetadataFromHtml(data);

                        // Resolve relative image URLs to absolute
                        if (
                            metadata.image &&
                            !metadata.image.startsWith('http')
                        ) {
                            metadata.image = resolveUrl(
                                currentUrl,
                                metadata.image
                            );
                        }

                        resolve(metadata);
                    });
                });

                req.on('error', (err) => {
                    clearTimeout(globalTimeout);
                    resolve(null);
                });

                req.on('timeout', () => {
                    clearTimeout(globalTimeout);
                    req.destroy();
                    resolve(null);
                });

                req.end();
            } catch (error) {
                clearTimeout(globalTimeout);
                resolve(null);
            }
        }

        makeRequest(url);
    });
}

// GET /api/url/title
router.get('/url/title', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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
        console.error('Error extracting URL title:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/url/extract-from-text
router.post('/url/extract-from-text', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

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
        console.error('Error extracting URL from text:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
