const bcrypt = require('bcrypt');
const { OIDCIdentity, User } = require('../../../models');

describe('OIDCIdentity Model', () => {
    let user;

    beforeEach(async () => {
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    describe('validation', () => {
        it('should create an identity with valid data', async () => {
            const identity = await OIDCIdentity.create({
                user_id: user.id,
                provider_slug: 'authentik',
                subject: 'sub-123',
                email: 'test@example.com',
                name: 'Test User',
            });

            expect(identity.provider_slug).toBe('authentik');
            expect(identity.subject).toBe('sub-123');
        });

        it('should require user_id', async () => {
            await expect(
                OIDCIdentity.create({
                    provider_slug: 'authentik',
                    subject: 'sub-123',
                })
            ).rejects.toThrow();
        });

        it('should store a picture claim longer than 255 characters (#1607)', async () => {
            // Some providers (e.g. Authentik) send the picture claim as an
            // inline base64 data URI rather than a URL, which can easily
            // exceed a varchar(255) column.
            const longPicture = `data:image/svg+xml;base64,${'a'.repeat(2000)}`;

            const identity = await OIDCIdentity.create({
                user_id: user.id,
                provider_slug: 'authentik',
                subject: 'sub-456',
                picture: longPicture,
            });

            expect(identity.picture).toBe(longPicture);

            const reloaded = await OIDCIdentity.findByPk(identity.id);
            expect(reloaded.picture).toBe(longPicture);
        });

        it('should enforce unique provider_slug + subject', async () => {
            await OIDCIdentity.create({
                user_id: user.id,
                provider_slug: 'authentik',
                subject: 'sub-789',
            });

            await expect(
                OIDCIdentity.create({
                    user_id: user.id,
                    provider_slug: 'authentik',
                    subject: 'sub-789',
                })
            ).rejects.toThrow();
        });
    });
});
