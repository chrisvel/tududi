const bcrypt = require('bcrypt');
const { User } = require('../../models');

const createTestUser = async (userData = {}) => {
  const defaultUser = {
    email: 'test@example.com',
    password_digest: await bcrypt.hash('password123', 10),
    ...userData
  };
  
  return await User.create(defaultUser);
};

const authenticateUser = async (request, user) => {
  const response = await request
    .post('/api/login')
    .send({
      email: user.email,
      password: 'password123'
    });
  
  return response.headers['set-cookie'];
};

module.exports = {
  createTestUser,
  authenticateUser
};