let mockAllowPrivate = false;

jest.mock('../../../config/config', () => {
    const actual = jest.requireActual('../../../config/config');
    return {
        ...actual,
        getConfig: () => ({
            ...actual.getConfig(),
            caldav: {
                get allowPrivateHosts() {
                    return mockAllowPrivate;
                },
            },
        }),
    };
});

const axios = require('axios');
const dns = require('dns');
const {
    fetchFeed,
    FeedFetchError,
} = require('../../../modules/calendar-feeds/fetcher');

const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';

describe('fetchFeed with CALDAV_ALLOW_PRIVATE_HOSTS', () => {
    afterEach(() => {
        mockAllowPrivate = false;
        jest.restoreAllMocks();
    });

    it('names the setting when a private address is refused', async () => {
        const get = jest.spyOn(axios, 'get');
        await expect(fetchFeed('https://192.168.1.10/cal.ics')).rejects.toThrow(
            'CALDAV_ALLOW_PRIVATE_HOSTS'
        );
        expect(get).not.toHaveBeenCalled();
    });

    it('fetches a feed whose host resolves to a LAN address when allowed', async () => {
        mockAllowPrivate = true;
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: '192.168.1.10', family: 4 },
        ]);
        const get = jest
            .spyOn(axios, 'get')
            .mockResolvedValue({ status: 200, headers: {}, data: ICS });

        await expect(
            fetchFeed('https://mail.example.org:8443/cal.ics')
        ).resolves.toContain('BEGIN:VCALENDAR');
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('still refuses link-local and metadata addresses when allowed', async () => {
        mockAllowPrivate = true;
        const get = jest.spyOn(axios, 'get');

        await expect(
            fetchFeed('http://169.254.169.254/latest/meta-data')
        ).rejects.toThrow(FeedFetchError);
        await expect(
            fetchFeed('http://169.254.169.254/latest/meta-data')
        ).rejects.toThrow(/link-local/);
        expect(get).not.toHaveBeenCalled();
    });

    it('still refuses a link-local address at connect time when allowed', async () => {
        mockAllowPrivate = true;
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
            { address: '192.168.1.10', family: 4 },
        ]);
        jest.spyOn(dns, 'lookup').mockImplementation((host, opts, cb) =>
            cb(null, [{ address: '169.254.169.254', family: 4 }])
        );

        await expect(
            fetchFeed('http://rebind.example/cal.ics')
        ).rejects.toThrow(/link-local/);
    });
});
