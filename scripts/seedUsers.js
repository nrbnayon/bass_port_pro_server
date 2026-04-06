require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const connectDB = require('../config/db');

const usersData = [
  {
    name: "Sarah Johnson",
    email: "sara@example.com",
    role: "user",
    status: "suspended",
    reports: 42,
    location: "New York, USA",
    avatar: "",
    phone: "+123 456 7890",
    permissions: ["view_dashboard"]
  },
  {
    name: "Mike Chen",
    email: "mike@example.com",
    role: "creator",
    status: "active",
    reports: 32,
    location: "San Francisco, USA",
    avatar: "",
    permissions: ["view_dashboard"]
  },
  {
    name: "Emily Davis",
    email: "emily@example.com",
    role: "user",
    status: "banned",
    reports: 22,
    location: "London, UK",
    avatar: "",
    permissions: ["view_dashboard"]
  },
  {
    name: "John Smith",
    email: "john@example.com",
    role: "user",
    status: "active",
    reports: 12,
    location: "Toronto, Canada",
    avatar: "",
    phone: "+123 555 0102",
    permissions: ["view_dashboard"]
  },
  {
    name: "Olivia Rhye",
    email: "olivia@example.com",
    role: "creator",
    status: "active",
    reports: 5,
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    permissions: ["view_dashboard"]
  },
  {
    name: "Natali Craig",
    email: "natali@example.com",
    role: "user",
    status: "active",
    reports: 0,
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    phone: "+123 555 0100",
    permissions: ["view_dashboard"]
  }
];

const seedUsers = async () => {
  await connectDB();
  try {
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('password123', salt);

    console.log('Clearing existing users (keeping admin)...');
    // Optional: Keep admin if it has a specific email or just clear others
    await User.deleteMany({ role: { $ne: 'admin' } });

    for (const userData of usersData) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`Skipping existing user: ${userData.email}`);
        continue;
      }

      await User.create({
        ...userData,
        password: defaultPassword
      });
      console.log(`User created: ${userData.email} (Status: ${userData.status}, Reports: ${userData.reports})`);
    }

    console.log('Seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedUsers();
