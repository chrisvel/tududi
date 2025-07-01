const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { requireAuth } = require('../middleware/auth');
const config = require('../config/config');

// Google Calendar configuration
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// OAuth2 client setup
const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        config.credentials.google.clientId,
        config.credentials.google.clientSecret,
        config.credentials.google.redirectUri
    );
};

// GET /api/calendar/auth - Start OAuth flow (Demo mode)
router.get('/auth', requireAuth, (req, res) => {
    try {
        // Check if Google credentials are configured
        if (
            !config.credentials.google.clientId ||
            !config.credentials.google.clientSecret
        ) {
            // Demo mode - simulate successful connection
            console.log(
                'Demo mode: Simulating Google Calendar connection for user:',
                req.currentUser.id
            );

            // Simulate the callback redirect with success
            return res.json({
                authUrl: `${config.frontendUrl}/calendar?demo=true&connected=true`,
                demo: true,
                message: 'Demo mode: Google Calendar integration simulated',
            });
        }

        // Production mode with real Google OAuth
        const oauth2Client = getOAuth2Client();

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            state: JSON.stringify({ userId: req.currentUser.id }),
        });

        res.json({ authUrl });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
});

// GET /api/calendar/oauth/callback - Handle OAuth callback
router.get('/oauth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res
                .status(400)
                .json({ error: 'Authorization code not provided' });
        }

        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        // Parse state to get user ID
        const { userId } = JSON.parse(state);

        // Here you would typically save the tokens to the database
        // For now, we'll just return them (in production, store securely)
        console.log('Google Calendar tokens received for user:', userId);
        console.log('Tokens:', tokens);

        // TODO: Save tokens to database associated with user
        // await saveGoogleTokensForUser(userId, tokens);

        // Redirect to frontend with success
        res.redirect(`${config.frontendUrl}/calendar?connected=true`);
    } catch (error) {
        console.error('Error handling OAuth callback:', error);
        res.redirect(`${config.frontendUrl}/calendar?error=auth_failed`);
    }
});

// GET /api/calendar/status - Check connection status
router.get('/status', requireAuth, async (req, res) => {
    try {
        // Check if we're in demo mode or have real Google integration
        if (
            !config.credentials.google.clientId ||
            !config.credentials.google.clientSecret
        ) {
            // Demo mode - check if user has been "connected" in this session
            // For demo purposes, we'll simulate connection status
            res.json({
                connected: false, // Will be set to true after demo connection
                email: null,
                demo: true,
            });
            return;
        }

        // TODO: Check if user has valid Google Calendar tokens in database
        // const tokens = await getGoogleTokensForUser(req.currentUser.id);

        res.json({
            connected: false, // Change to true when tokens exist and are valid
            email: null, // Return connected Google account email when available
        });
    } catch (error) {
        console.error('Error checking calendar status:', error);
        res.status(500).json({ error: 'Failed to check calendar status' });
    }
});

// GET /api/calendar/events - Get events from Google Calendar
router.get('/events', requireAuth, async (req, res) => {
    try {
        const { start, end } = req.query;

        // TODO: Get tokens from database
        // const tokens = await getGoogleTokensForUser(req.currentUser.id);
        // if (!tokens) {
        //   return res.status(401).json({ error: 'Google Calendar not connected' });
        // }

        // For now, return sample data
        const sampleEvents = [
            {
                id: 'google-1',
                title: 'Google Calendar Event',
                start: new Date().toISOString(),
                end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                type: 'google',
                color: '#ea4335',
            },
        ];

        res.json({ events: sampleEvents });

        // TODO: Implement actual Google Calendar API call
        /*
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start || new Date().toISOString(),
      timeMax: end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items.map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      type: 'google',
      color: '#ea4335',
      description: event.description,
      location: event.location
    }));

    res.json({ events });
    */
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
});

// POST /api/calendar/disconnect - Disconnect Google Calendar
router.post('/disconnect', requireAuth, async (req, res) => {
    try {
        // TODO: Remove tokens from database
        // await removeGoogleTokensForUser(req.currentUser.id);

        res.json({ success: true, message: 'Google Calendar disconnected' });
    } catch (error) {
        console.error('Error disconnecting calendar:', error);
        res.status(500).json({ error: 'Failed to disconnect calendar' });
    }
});

module.exports = router;
