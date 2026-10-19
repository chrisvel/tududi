const { EmailDelivery, Role, Task } = require('../../models');
const { getConfig } = require('../../config/config');
const entitlements = require('../../services/entitlementsService');
const emailService = require('../../services/emailService');
const engagement = require('../../services/engagementEmailService');
const { createTestUser } = require('../helpers/testUtils');

jest.mock('../../services/emailService', () => ({
    ...jest.requireActual('../../services/emailService'),
    isEmailEnabled: jest.fn(() => true),
    sendEmail: jest.fn(async () => ({ success: true })),
}));

const config = getConfig();
const DAY = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY);
let seq = 0;
const uniqueEmail = (p) => `${p}_${Date.now()}_${seq++}@example.com`;

const sentTo = (user) =>
    emailService.sendEmail.mock.calls
        .map(([mail]) => mail)
        .filter((mail) => mail.to === user.email);

// The two nudges from the daily job: an account still empty a couple of
// days in, and one that had things in it and went quiet.
describe('Engagement emails', () => {
    beforeEach(async () => {
        config.hosted.enabled = true;
        config.hosted.requireSubscription = false;
        entitlements.invalidate();
        emailService.isEmailEnabled.mockReturnValue(true);
        emailService.sendEmail.mockClear();
        emailService.sendEmail.mockResolvedValue({ success: true });
        // The first user made is an admin, and admins are left out.
        const admin = await createTestUser({ email: uniqueEmail('adm') });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
    });

    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.requireSubscription = false;
        entitlements.invalidate();
    });

    describe('empty account', () => {
        it('goes once to an owner who made nothing in the first days', async () => {
            const user = await createTestUser({ email: uniqueEmail('empty') });

            expect(
                await engagement.nudgeEmptyAccounts({ now: inDays(1) })
            ).not.toContain(user.id);

            const sent = await engagement.nudgeEmptyAccounts({
                now: inDays(3),
            });
            expect(sent).toContain(user.id);
            const [mail] = sentTo(user);
            expect(mail.subject).toBe('Your tududi is still empty');
            expect(mail.text).toContain('/inbox');

            expect(
                await engagement.nudgeEmptyAccounts({ now: inDays(4) })
            ).not.toContain(user.id);
            expect(
                await EmailDelivery.count({
                    where: { user_id: user.id, email: 'emptyAccount' },
                })
            ).toBe(1);
        });

        it('leaves out owners who made something, members and old accounts', async () => {
            const busy = await createTestUser({ email: uniqueEmail('busy') });
            await Task.create({ name: 'Something', user_id: busy.id });
            const owner = await createTestUser({ email: uniqueEmail('own') });
            const member = await createTestUser({
                email: uniqueEmail('member'),
                created_by_user_id: owner.id,
            });

            const sent = await engagement.nudgeEmptyAccounts({
                now: inDays(3),
            });
            expect(sent).not.toContain(busy.id);
            expect(sent).not.toContain(member.id);
            expect(sent).toContain(owner.id);

            const old = await createTestUser({ email: uniqueEmail('old') });
            expect(
                await engagement.nudgeEmptyAccounts({ now: inDays(20) })
            ).not.toContain(old.id);
        });

        it('says when a running trial ends', async () => {
            const user = await createTestUser({ email: uniqueEmail('trial') });
            await entitlements.startTrial(user.id);
            entitlements.invalidate(user.id);

            await engagement.nudgeEmptyAccounts({ now: inDays(3) });
            const [mail] = sentTo(user);
            expect(mail.text).toContain('Your free trial runs until');
        });

        it('sends nothing on a self-hosted instance', async () => {
            config.hosted.enabled = false;
            await createTestUser({ email: uniqueEmail('self') });
            expect(
                await engagement.nudgeEmptyAccounts({ now: inDays(3) })
            ).toEqual([]);
        });
    });

    describe('come back', () => {
        it('goes once per quiet spell', async () => {
            const user = await createTestUser({ email: uniqueEmail('quiet') });
            const task = await Task.create({
                name: 'Started',
                user_id: user.id,
            });

            expect(
                await engagement.nudgeQuietAccounts({ now: inDays(3) })
            ).not.toContain(user.id);
            expect(
                await engagement.nudgeQuietAccounts({ now: inDays(8) })
            ).toContain(user.id);
            expect(sentTo(user)[0].subject).toBe(
                'Your tasks are where you left them'
            );
            expect(
                await engagement.nudgeQuietAccounts({ now: inDays(9) })
            ).not.toContain(user.id);

            // Back after the email, then quiet again.
            await task.update({ status: 2, completed_at: inDays(10) });
            expect(
                await engagement.nudgeQuietAccounts({ now: inDays(18) })
            ).toContain(user.id);
        });

        it('leaves alone accounts quiet for over a month', async () => {
            const user = await createTestUser({ email: uniqueEmail('gone') });
            await Task.create({ name: 'Long ago', user_id: user.id });
            expect(
                await engagement.nudgeQuietAccounts({ now: inDays(40) })
            ).not.toContain(user.id);
        });
    });
});
