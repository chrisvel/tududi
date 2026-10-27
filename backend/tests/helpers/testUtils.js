const bcrypt = require('bcrypt');
const { User } = require('../../models');

const createTestUser = async (userData = {}) => {
    const defaultUser = {
        email: 'test@example.com',
        password_digest:
            '$2b$10$DPcA0XSvK9FT04mLyKGza.uHb8d.bESwP.XdQfQ47.sKVT4fYzbP.', // Pre-computed hash for 'password123'
        ...userData,
    };

    return await User.create(defaultUser);
};

// Marks two-factor sign-in as on for a user, without going through setup.
// A hosted superadmin needs it to reach the admin panel; call it after the
// user's agent has signed in, since a password sign-in would otherwise stop
// at the code prompt.
const enrollMfa = async (user) => {
    const { UserMfa } = require('../../models');
    await UserMfa.create({
        user_id: user.id,
        secret_encrypted: 'enc:v1:test',
        enabled_at: new Date(),
    });
};

const authenticateUser = async (request, user) => {
    const response = await request.post('/api/login').send({
        email: user.email,
        password: 'password123',
    });

    return response.headers['set-cookie'];
};

// Shares are invitations: the recipient's agent must accept before the
// resource becomes visible to them.
const acceptAllInvitations = async (agent) => {
    const list = await agent.get('/api/shares/invitations');
    const invitations = (list.body && list.body.invitations) || [];
    for (const invitation of invitations) {
        await agent.post(`/api/shares/invitations/${invitation.id}/accept`);
    }
    return invitations.length;
};

module.exports = {
    createTestUser,
    enrollMfa,
    authenticateUser,
    acceptAllInvitations,
};
