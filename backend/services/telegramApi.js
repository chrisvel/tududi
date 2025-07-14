// Helper function to get bot info from Telegram API
async function getBotInfo(token) {
    return new Promise((resolve, reject) => {
        const url = `https://api.telegram.org/bot${token}/getMe`;

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = require('https').request(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.ok) {
                        resolve(response.result);
                    } else {
                        console.error(
                            'Telegram API error:',
                            response.description
                        );
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Error parsing Telegram response:', error);
                    resolve(null);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error getting bot info:', error);
            resolve(null);
        });

        req.end();
    });
}

module.exports = { getBotInfo };
