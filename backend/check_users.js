const { User } = require('./backend/models');
async function check() {
  const users = await User.findAll();
  console.log(JSON.stringify(users, null, 2));
  process.exit(0);
}
check();
