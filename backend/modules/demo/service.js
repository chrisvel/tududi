'use strict';

const bcrypt = require('bcrypt');
const { getConfig } = require('../../config/config');
const { logError, logInfo } = require('../../services/logService');
const { withJobLock } = require('../../services/jobLock');
const { seedDemoData } = require('./seed');

// A public sandbox: one shared account, seeded with plausible content and
// wiped on a timer so whatever the last visitor did is gone. Anyone can
// open it without signing up, which is the whole point, so the account is
// locked down elsewhere (see middleware/demo.js): it cannot change its own
// password or email, delete itself, or hold an admin role.

let cachedDemoUserId = null;

function demoConfig() {
    return getConfig().demo || {};
}

function isDemoEnabled() {
    const c = demoConfig();
    return c.enabled === true && !!c.email;
}

async function getDemoUser() {
    if (!isDemoEnabled()) return null;
    const { User } = require('../../models');
    return User.findOne({ where: { email: demoConfig().email } });
}

// Cheap enough to call on every request once warm; a miss only costs one
// indexed lookup, and the id is cleared whenever the account is rebuilt.
async function isDemoUser(userId) {
    if (!isDemoEnabled() || !userId) return false;
    if (cachedDemoUserId !== null) return cachedDemoUserId === userId;
    const user = await getDemoUser();
    cachedDemoUserId = user ? user.id : -1;
    return cachedDemoUserId === userId;
}

// Creates the account if it is missing, gives it Pro through the ordinary
// admin-override mechanism (so an instance that requires a subscription
// still lets the demo in), and seeds it when it is empty.
async function ensureDemoUser() {
    if (!isDemoEnabled()) return null;
    const { User, Role, Task } = require('../../models');
    const config = demoConfig();

    let user = await getDemoUser();
    if (!user) {
        user = await User.create({
            email: config.email,
            password_digest: await bcrypt.hash(config.password, 10),
            name: 'Demo',
            email_verified: true,
            language: 'en',
        });
        logInfo(`Demo account created: ${config.email}`);
    }
    cachedDemoUserId = user.id;

    // Never an admin, whatever else happens to the roles table
    const [role] = await Role.findOrCreate({
        where: { user_id: user.id },
        defaults: { user_id: user.id, is_admin: false },
    });
    if (role.is_admin) await role.update({ is_admin: false });

    await grantDemoEntitlement(user.id);

    const taskCount = await Task.count({ where: { user_id: user.id } });
    if (taskCount === 0) {
        await seedDemoData(user.id, require('../../models'));
        logInfo('Demo account seeded');
    }
    return user;
}

// The demo is not a customer, so it gets an admin override rather than a
// subscription: the same path a comped account uses, visible in the admin
// billing list, and it survives the subscription gate.
async function grantDemoEntitlement(userId) {
    try {
        const entitlements = require('../../services/entitlementsService');
        if (!entitlements.isHostedMode()) return;
        const account = await entitlements.ensureAccount(userId);
        if (account && account.override_plan !== 'pro') {
            await account.update({
                override_plan: 'pro',
                override_expires_at: null,
                override_reason: 'Public demo account',
            });
            entitlements.invalidate(userId);
        }
    } catch (error) {
        logError('Could not grant the demo entitlement:', error);
    }
}

// Wipes everything the demo account owns and seeds it again. Runs under a
// job lock so one worker does it even with several processes.
async function resetDemo({ force = false } = {}) {
    if (!isDemoEnabled()) return { reset: false, reason: 'disabled' };

    const outcome = await withJobLock('demo-reset', async () => {
        const models = require('../../models');
        const user = await ensureDemoUser();
        if (!user) return { reset: false, reason: 'no_user' };

        const {
            Task,
            Project,
            Area,
            Note,
            Tag,
            InboxItem,
            Goal,
            View,
            Person,
            ApiToken,
        } = models;
        const where = { where: { user_id: user.id } };
        // Tasks first: notes and projects are referenced by them.
        await Task.destroy({ ...where, force: true });
        await Note.destroy({ ...where, force: true });
        await InboxItem.destroy({ ...where, force: true });
        await Project.destroy({ ...where, force: true });
        await Goal.destroy({ ...where, force: true });
        await Area.destroy({ ...where, force: true });
        await Tag.destroy({ ...where, force: true });
        if (View) await View.destroy({ ...where, force: true });
        if (Person) await Person.destroy({ ...where, force: true });
        // Any token minted before the route guard existed dies here too.
        if (ApiToken) await ApiToken.destroy({ ...where, force: true });

        await seedDemoData(user.id, models);
        await user.update({
            password_digest: await bcrypt.hash(demoConfig().password, 10),
        });
        logInfo('Demo account reset');
        return { reset: true, at: new Date() };
    });

    if (!outcome.ran) return { reset: false, reason: 'busy' };
    return outcome.result;
}

// What the marketing page needs to know: whether to offer the demo at all.
async function demoStatus() {
    if (!isDemoEnabled()) return { available: false };
    try {
        const user = await getDemoUser();
        return {
            available: !!user,
            resetMinutes: demoConfig().resetMinutes,
        };
    } catch {
        return { available: false };
    }
}

function forgetCachedUser() {
    cachedDemoUserId = null;
}

module.exports = {
    isDemoEnabled,
    isDemoUser,
    getDemoUser,
    ensureDemoUser,
    resetDemo,
    demoStatus,
    forgetCachedUser,
};
