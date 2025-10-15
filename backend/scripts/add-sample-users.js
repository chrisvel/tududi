const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../models');

const sampleUsers = [
    {
        name: 'Alice',
        surname: 'Johnson',
        email: 'alice.johnson@example.com',
        password: 'password123',
    },
    {
        name: 'Bob',
        surname: 'Smith',
        email: 'bob.smith@example.com',
        password: 'password123',
    },
    {
        name: 'Carol',
        surname: 'Williams',
        email: 'carol.williams@example.com',
        password: 'password123',
    },
    {
        name: 'David',
        surname: 'Brown',
        email: 'david.brown@example.com',
        password: 'password123',
    },
    {
        name: 'Emma',
        surname: 'Davis',
        email: 'emma.davis@example.com',
        password: 'password123',
    },
    {
        name: 'Frank',
        surname: 'Miller',
        email: 'frank.miller@example.com',
        password: 'password123',
    },
    {
        name: 'Grace',
        surname: 'Wilson',
        email: 'grace.wilson@example.com',
        password: 'password123',
    },
    {
        name: 'Henry',
        surname: 'Moore',
        email: 'henry.moore@example.com',
        password: 'password123',
    },
    {
        name: 'Ivy',
        surname: 'Taylor',
        email: 'ivy.taylor@example.com',
        password: 'password123',
    },
    {
        name: 'Jack',
        surname: 'Anderson',
        email: 'jack.anderson@example.com',
        password: 'password123',
    },
];

async function addSampleUsers() {
    try {
        console.log('Starting to add sample users...');

        for (const userData of sampleUsers) {
            try {
                // Check if user already exists
                const existingUser = await db.User.findOne({
                    where: { email: userData.email },
                });

                if (existingUser) {
                    console.log(
                        `User ${userData.email} already exists, skipping...`
                    );
                    continue;
                }

                // Create user - the beforeValidate hook will hash the password
                const user = await db.User.create({
                    name: userData.name,
                    surname: userData.surname,
                    email: userData.email,
                    password: userData.password,
                });

                // Create role entry (non-admin by default)
                await db.Role.create({
                    user_id: user.id,
                    is_admin: false,
                });

                console.log(
                    `✓ Created user: ${userData.name} ${userData.surname} (${userData.email})`
                );
            } catch (error) {
                console.error(
                    `✗ Failed to create user ${userData.email}:`,
                    error.message
                );
            }
        }

        console.log('\n✓ Sample users added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error adding sample users:', error);
        process.exit(1);
    }
}

// Run the script
addSampleUsers();
