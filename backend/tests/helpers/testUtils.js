const bcrypt = require('bcrypt');
const User = require('../../models-mongo/user');

const createTestUser = async (userData = {}) => {
    const defaultUser = {
        email: 'test@example.com',
        password: 'password123',
        ...userData,
    };

    const user = new User(defaultUser);
    await user.save();
    return user;
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
