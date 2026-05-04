const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const connectDB = require('./config/db');

dotenv.config();

const seedUsers = async () => {
    try {
        await connectDB();

        // 1. Admin User
        const adminEmail = 'satyam@gmail.com';
        const adminPass = '12345678';
        
        let adminUser = await User.findOne({ email: adminEmail });
        
        if (adminUser) {
            console.log(`Admin user ${adminEmail} already exists. Updating password/admin status...`);
            adminUser.password = adminPass; // schema pre-save will hash this
            adminUser.isAdmin = true;
            await adminUser.save();
            console.log('Admin user updated.');
        } else {
            console.log(`Creating admin user ${adminEmail}...`);
            await User.create({
                firstName: 'Satyam',
                lastName: 'Admin',
                name: 'Satyam Admin',
                email: adminEmail,
                password: adminPass,
                isAdmin: true
            });
            console.log('Admin user created.');
        }

        // 2. Regular User
        const userEmail = 'satyamuser@gmail.com';
        const userPass = '12345678';

        let normalUser = await User.findOne({ email: userEmail });
        
        if (normalUser) {
            console.log(`Regular user ${userEmail} already exists. Updating password...`);
            normalUser.password = userPass;
            normalUser.isAdmin = false;
            await normalUser.save();
            console.log('Regular user updated.');
        } else {
            console.log(`Creating regular user ${userEmail}...`);
            await User.create({
                firstName: 'Satyam',
                lastName: 'User',
                name: 'Satyam User',
                email: userEmail,
                password: userPass,
                isAdmin: false
            });
            console.log('Regular user created.');
        }

        console.log('User check/creation complete.');
        process.exit();
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
};

seedUsers();
