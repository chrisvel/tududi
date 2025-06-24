const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const router = express.Router();

// Helper function to extract title from HTML
function extractTitleFromHtml(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    // Decode HTML entities and clean up
    return titleMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
  return null;
}

// Helper function to check if text is a URL
function isUrl(text) {
  const urlRegex = /^(https?:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i;
  return urlRegex.test(text.trim());
}

// Helper function to fetch URL title with redirect handling
async function fetchUrlTitle(url, maxRedirects = 5) {
  return new Promise((resolve) => {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }

    function makeRequest(currentUrl, redirectCount = 0) {
      if (redirectCount > maxRedirects) {
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
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        };

        const req = client.request(options, (res) => {
          // Handle redirects (301, 302, 303, 307, 308)
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, currentUrl).href;
            makeRequest(redirectUrl, redirectCount + 1);
            return;
          }

          // If not a successful response, resolve with null
          if (res.statusCode < 200 || res.statusCode >= 400) {
            resolve(null);
            return;
          }

          let data = '';
          let totalBytes = 0;
          const maxBytes = 50000;

          res.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
              req.destroy();
              return;
            }
            data += chunk;
            
            // Stop if we find the title tag
            if (data.includes('</title>')) {
              req.destroy();
            }
          });

          res.on('end', () => {
            const title = extractTitleFromHtml(data);
            resolve(title);
          });
        });

        req.on('error', () => {
          resolve(null);
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });

        req.end();
      } catch (error) {
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

    const title = await fetchUrlTitle(url);

    if (title) {
      res.json({ url, title });
    } else {
      res.json({ url, title: null, error: 'Could not extract title' });
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
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    // Simple URL extraction - look for URLs in text
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = text.match(urlRegex);

    if (urls && urls.length > 0) {
      const firstUrl = urls[0];
      const title = await fetchUrlTitle(firstUrl);
      
      res.json({
        found: true,
        url: firstUrl,
        title: title,
        originalText: text
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('Error extracting URL from text:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;