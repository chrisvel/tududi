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

const authenticateUser = async (request, user) => {
    const response = await request.post('/api/login').send({
        email: user.email,
        password: 'password123',
    });

    return response.headers['set-cookie'];
};

module.exports = {
    createTestUser,
    authenticateUser,
};
