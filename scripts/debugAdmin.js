require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

const debugAdmin = async () => {
  await connectDB();
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
    const user = await User.findOne({ email: adminEmail });
    if (user) {
      console.log('Admin found:');
      console.log('Email:', user.email);
      console.log('Status:', user.status);
      console.log('Role:', user.role);
    } else {
      console.log('Admin NOT found in DB');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

debugAdmin();
