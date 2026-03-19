const { Notification, User } = require('../../../models');

describe('Notification Model', () => {
    let testUser;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        testUser = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    describe('channel tracking methods', () => {
        let notification;

        beforeEach(async () => {
            notification = await Notification.create({
                user_id: testUser.id,
                type: 'task_due_soon',
                title: 'Test Notification',
                message: 'This is a test notification',
                sources: ['telegram'],
                level: 'info',
                sent_at: new Date(),
            });
        });

        describe('markChannelAsSent', () => {
            it('should mark a channel as sent with current timestamp', async () => {
                const beforeMark = new Date();
                await notification.markChannelAsSent('telegram');

                expect(notification.channel_sent_at).toBeDefined();
                expect(notification.channel_sent_at.telegram).toBeDefined();

                const sentTime = new Date(
                    notification.channel_sent_at.telegram
                );
                expect(sentTime).toBeInstanceOf(Date);
                expect(sentTime.getTime()).toBeGreaterThanOrEqual(
                    beforeMark.getTime()
                );
            });

            it('should track multiple channels independently', async () => {
                await notification.markChannelAsSent('telegram');
                await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
                await notification.markChannelAsSent('email');

                expect(notification.channel_sent_at.telegram).toBeDefined();
                expect(notification.channel_sent_at.email).toBeDefined();

                const telegramTime = new Date(
                    notification.channel_sent_at.telegram
                );
                const emailTime = new Date(notification.channel_sent_at.email);

                expect(emailTime.getTime()).toBeGreaterThanOrEqual(
                    telegramTime.getTime()
                );
            });

            it('should update existing channel timestamp when marked again', async () => {
                await notification.markChannelAsSent('telegram');
                const firstTime = notification.channel_sent_at.telegram;

                await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
                await notification.markChannelAsSent('telegram');
                const secondTime = notification.channel_sent_at.telegram;

                expect(secondTime).not.toBe(firstTime);
                expect(new Date(secondTime).getTime()).toBeGreaterThan(
                    new Date(firstTime).getTime()
                );
            });

            it('should persist to database', async () => {
                await notification.markChannelAsSent('telegram');

                const reloaded = await Notification.findByPk(notification.id);
                expect(reloaded.channel_sent_at).toBeDefined();
                expect(reloaded.channel_sent_at.telegram).toBe(
                    notification.channel_sent_at.telegram
                );
            });
        });

        describe('wasChannelRecentlySent', () => {
            it('should return false when channel was never sent', () => {
                expect(notification.wasChannelRecentlySent('telegram')).toBe(
                    false
                );
            });

            it('should return false when channel_sent_at is null', () => {
                notification.channel_sent_at = null;
                expect(notification.wasChannelRecentlySent('telegram')).toBe(
                    false
                );
            });

            it('should return true when channel was sent within threshold', async () => {
                await notification.markChannelAsSent('telegram');
                expect(
                    notification.wasChannelRecentlySent('telegram', 1000)
                ).toBe(true);
            });

            it('should return false when channel was sent outside threshold', async () => {
                // Manually set a timestamp from 2 days ago
                const twoDaysAgo = new Date();
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

                notification.channel_sent_at = {
                    telegram: twoDaysAgo.toISOString(),
                };

                // Check with 24h threshold (should be false)
                expect(
                    notification.wasChannelRecentlySent(
                        'telegram',
                        24 * 60 * 60 * 1000
                    )
                ).toBe(false);
            });

            it('should use default threshold of 24 hours', async () => {
                const oneDayAgo = new Date();
                oneDayAgo.setHours(oneDayAgo.getHours() - 23); // 23 hours ago

                notification.channel_sent_at = {
                    telegram: oneDayAgo.toISOString(),
                };

                // Should be true (within 24h default)
                expect(notification.wasChannelRecentlySent('telegram')).toBe(
                    true
                );

                // Set to 25 hours ago
                const moreThanADayAgo = new Date();
                moreThanADayAgo.setHours(moreThanADayAgo.getHours() - 25);
                notification.channel_sent_at = {
                    telegram: moreThanADayAgo.toISOString(),
                };

                // Should be false (outside 24h default)
                expect(notification.wasChannelRecentlySent('telegram')).toBe(
                    false
                );
            });

            it('should check channels independently', async () => {
                await notification.markChannelAsSent('telegram');

                expect(notification.wasChannelRecentlySent('telegram')).toBe(
                    true
                );
                expect(notification.wasChannelRecentlySent('email')).toBe(
                    false
                );
            });

            it('should handle different thresholds for different channels', async () => {
                await notification.markChannelAsSent('telegram');
                await notification.markChannelAsSent('email');

                // Both within 1 hour
                expect(
                    notification.wasChannelRecentlySent(
                        'telegram',
                        60 * 60 * 1000
                    )
                ).toBe(true);
                expect(
                    notification.wasChannelRecentlySent('email', 60 * 60 * 1000)
                ).toBe(true);
            });
        });
    });
});
