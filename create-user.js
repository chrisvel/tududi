const { User } = require('./backend/models');

async function createUser() {
    try {
        const user = await User.create({
            email: 'william@karadigital.co',
            password: 'davison40',
            name: 'William',
            email_verified: true, // Skip email verification for development
        });

        console.log('✓ User created successfully!');
        console.log('Email:', user.email);
        console.log('UID:', user.uid);
        console.log('Is Admin:', user.id === 1 ? 'Yes (first user)' : 'No');
        console.log('\nYou can now log in with these credentials.');

        process.exit(0);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.error('✗ User with this email already exists.');
        } else {
            console.error('✗ Error creating user:', error.message);
        }
        process.exit(1);
    }
}

createUser();
