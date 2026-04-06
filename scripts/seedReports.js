require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Lake = require('../models/Lake');
const FishingReport = require('../models/FishingReport');
const connectDB = require('../config/db');

const initialReports = [
  {
    title: "Great day at Guntersville",
    text: "Incredible day on Guntersville! The grass is loaded with with Fish. Started flipping mats early and switched to swim jigs mid-morning. Topwater bite turned on around 4pm. Fish are staging on the grass edges in 4-8 ft.",
    species: "Bass",
    score: 85,
    tags: ["Bass", "Spinnerbait", "Morning Bite"],
    conditions: {
      temp: "72°F",
      weather: "Sunny",
      waterLevel: "Normal",
      clarity: "Clear",
      pressure: "Stable",
    },
    catchCount: 15,
    biggestCatch: 6.5,
    fishedAt: "2026-03-24",
    status: "rejected",
    featured: true,
  },
  {
    title: "Sam Rayburn Crappie Blast",
    text: "Crappie are moving into the creek channels. Jigging soft plastics in 15-20ft was the key today. Limits for everyone on board.",
    species: "Crappie",
    score: 72,
    tags: ["Crappie", "Limits"],
    conditions: {
      temp: "65°F",
      weather: "Windy",
      waterLevel: "High",
      clarity: "Muddy",
      pressure: "Rising",
    },
    catchCount: 30,
    biggestCatch: 2.1,
    fishedAt: "2026-03-23",
    status: "active",
    featured: false,
  },
  {
    title: "Chikamauga Catfish",
    text: "Big blues were active on cut bait. Anchored up near the river channel ledges. Tough current but the bite was consistent.",
    species: "Catfish",
    score: 65,
    tags: ["Catfish", "Blues"],
    conditions: {
      temp: "68°F",
      weather: "Partly Cloudy",
      waterLevel: "Normal",
      clarity: "Stained",
    },
    catchCount: 8,
    biggestCatch: 24.0,
    fishedAt: "2026-03-22",
    status: "rejected",
    featured: false,
  },
  {
    title: "Lake Fork Giants",
    text: "Large specimens were relating to deep timber. Drop shots and heavy jigs were the only way to get down to them.",
    species: "Bass",
    score: 92,
    tags: ["Bass", "Giants"],
    conditions: {
      temp: "75°F",
      weather: "Clear",
      waterLevel: "Normal",
    },
    catchCount: 12,
    biggestCatch: 8.2,
    fishedAt: "2026-03-21",
    status: "pending",
    featured: false,
  },
];

const seedReports = async () => {
  await connectDB();
  try {
    console.log('Clearing existing fishing reports...');
    await FishingReport.deleteMany({});

    // Fetch existing users and lakes to use as references
    const users = await User.find({ role: { $ne: 'admin' } });
    if (users.length === 0) {
      console.log('No users found. Please run seedUsers.js first.');
      process.exit(1);
    }

    const lakes = await Lake.find({});
    if (lakes.length === 0) {
      console.log('No lakes found. Please ensure lakes are Seeded or Create a Lake first.');
      // Create a dummy lake if none exists to ensure tests can run
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        const dummyLake = await Lake.create({
          name: "Lake Guntersville",
          slug: "lake-guntersville",
          state: "Alabama",
          description: "Famous for bass fishing.",
          status: "active",
          createdBy: admin._id,
        });
        lakes.push(dummyLake);
      } else {
        process.exit(1);
      }
    }

    // Distribute reports among users and lakes
    for (let i = 0; i < initialReports.length; i++) {
      const user = users[i % users.length];
      const lake = lakes[i % lakes.length];

      await FishingReport.create({
        ...initialReports[i],
        user: user._id,
        lake: lake._id,
        lakeName: lake.name,
      });

      console.log(`Created report: "${initialReports[i].title}" by ${user.name}`);
    }

    console.log('Fishing reports seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedReports();
