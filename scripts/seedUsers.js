require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const connectDB = require('../config/db');

const usersData = [
  {
    name: "Nayon",
    email: "admin@gmail.com",
    role: "admin",
    status: "active",
    location: "New York, USA",
    avatar: "/images/avatar.png",
    phone: "+123 456 7890",
    permissions: ["view_dashboard", "manage_jobs", "manage_users", "view_audit_logs"]
  },
  {
    name: "Olivia Rhye",
    email: "olivia@example.com",
    role: "creator",
    status: "active",
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    permissions: ["view_dashboard"]
  },
  {
    name: "Phoenix Baker",
    email: "phoenix@example.com",
    role: "creator",
    status: "suspended",
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    permissions: ["view_dashboard"]
  },
  {
    name: "Candice Wu",
    email: "candice@example.com",
    role: "creator",
    status: "active",
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    permissions: ["view_dashboard"]
  },
  {
    name: "Drew Cano",
    email: "drew@example.com",
    role: "creator",
    status: "suspended",
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    permissions: ["view_dashboard"]
  },
  {
    name: "Natali Craig",
    email: "natali@example.com",
    role: "user",
    status: "active",
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    phone: "+123 555 0100",
    permissions: ["view_dashboard"]
  },
  {
    name: "Orlando Diggs",
    email: "orlando@example.com",
    role: "user",
    status: "suspended",
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    phone: "+123 555 0101",
    permissions: ["view_dashboard"]
  },
  {
    name: "Andi Lane",
    email: "andi@example.com",
    role: "user",
    status: "active",
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    phone: "+123 555 0102",
    permissions: ["view_dashboard"]
  },
  {
    name: "Kate Morrison",
    email: "kate@example.com",
    role: "user",
    status: "active",
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    phone: "+123 555 0103",
    permissions: ["view_dashboard"]
  },
  {
    name: "Koray Okumus",
    email: "koray@example.com",
    role: "user",
    status: "active",
    location: "775 Rolling Green Rd.",
    avatar: "/images/avatar.png",
    phone: "+123 555 0104",
    permissions: ["view_dashboard"]
  }
];

const seedUsers = async () => {
  await connectDB();
  try {
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('password123', salt);

    for (const userData of usersData) {
      // Avoid duplicating the admin if it already exists from seedAdmin.js
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`Skipping existing user: ${userData.email}`);
        continue;
      }

      await User.create({
        ...userData,
        password: defaultPassword
      });
      console.log(`User created: ${userData.email}`);
    }

    console.log('Seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedUsers();
