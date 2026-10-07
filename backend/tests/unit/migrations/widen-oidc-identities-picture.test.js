const { Sequelize } = require('sequelize');
const { sequelize, User, OIDCIdentity } = require('../../../models');
const migration = require('../../../migrations/20260922000005-widen-oidc-identities-picture');

describe('migration 20260922000005-widen-oidc-identities-picture', () => {
    const qi = () => sequelize.getQueryInterface();

    it('keeps the composite unique index on (provider_slug, subject) after the picture column is widened (#1607)', async () => {
        await migration.up(qi(), Sequelize);

        const indexes = await qi().showIndex('oidc_identities');
        const composite = indexes.find((index) => {
            const attrs = index.fields.map((f) => f.attribute);
            return (
                attrs.length === 2 &&
                attrs.includes('provider_slug') &&
                attrs.includes('subject')
            );
        });

        expect(composite).toBeDefined();
        expect(composite.unique).toBe(true);
    });

    it('still rejects a duplicate provider_slug + subject after migrating', async () => {
        await migration.up(qi(), Sequelize);

        const user = await User.create({
            email: `mig-${Date.now()}@example.com`,
            password_digest: 'x',
        });
        await OIDCIdentity.create({
            user_id: user.id,
            provider_slug: 'authentik',
            subject: 'dup-subject',
        });

        await expect(
            OIDCIdentity.create({
                user_id: user.id,
                provider_slug: 'authentik',
                subject: 'dup-subject',
            })
        ).rejects.toThrow();
    });

    it('accepts a picture claim longer than 255 characters after migrating', async () => {
        await migration.up(qi(), Sequelize);

        const user = await User.create({
            email: `mig-long-${Date.now()}@example.com`,
            password_digest: 'x',
        });
        const longPicture = `data:image/svg+xml;base64,${'a'.repeat(2000)}`;

        const identity = await OIDCIdentity.create({
            user_id: user.id,
            provider_slug: 'authentik',
            subject: 'long-picture-subject',
            picture: longPicture,
        });

        expect(identity.picture).toBe(longPicture);
    });

    it('can be run again without dropping the index a second time', async () => {
        await migration.up(qi(), Sequelize);
        await migration.up(qi(), Sequelize);

        const indexes = await qi().showIndex('oidc_identities');
        const matching = indexes.filter((index) => {
            const attrs = index.fields.map((f) => f.attribute);
            return (
                attrs.length === 2 &&
                attrs.includes('provider_slug') &&
                attrs.includes('subject')
            );
        });
        expect(matching).toHaveLength(1);
    });
});
