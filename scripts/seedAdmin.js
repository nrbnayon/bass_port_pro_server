require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Lake = require("../models/Lake");
const bcrypt = require("bcrypt");
const connectDB = require("../config/db");

const ADMIN_ATOMS = [
  "view_dashboard",
  "manage_lakes",
  "view_lakes",
  "manage_catches",
  "view_catches",
  "manage_reports",
  "view_reports",
  "manage_reviews",
  "view_reviews",
  "manage_users",
  "view_users",
  "manage_settings",
  "manage_contacts",
  "view_contacts",
  "view_audit_logs",
  "view_notifications",
];

// const SAMPLE_LAKES = [
//   {
//     name: 'Lake Guntersville', slug: 'lake-guntersville', state: 'Alabama',
//     description: "Lake Guntersville is widely regarded as one of the best bass fishing lakes in the country. World-class grass bed fishing.",
//     size: 69100, catchRate: 4.2, recordBass: 13.5,
//     species: ['Largemouth Bass', 'Smallmouth Bass', 'Striped Bass'],
//     image: '/images/lake1.jpg', color: 'from-cyan-700/80 to-sky-900/80',
//     rating: 4.9, ratingCount: 1, reviewCount: 1,
//     conditions: { temp: '72F', weather: 'Clear', wind: '4.2 mph', clarity: 'Clear', condition: 'Excellent', waterLevel: 'Normal', pressure: 'Stable' },
//     status: 'active', featured: true,
//   },
//   {
//     name: 'Sam Rayburn Reservoir', slug: 'sam-rayburn-reservoir', state: 'Texas',
//     description: "One of the premier bass fishing destinations in Texas. Sam Rayburn is renowned for large largemouth bass.",
//     size: 114500, catchRate: 3.8, recordBass: 16.8,
//     species: ['Largemouth Bass', 'Spotted Bass', 'Crappie'],
//     image: '/images/lake2.jpg', color: 'from-emerald-700/80 to-teal-900/80',
//     rating: 4.8, ratingCount: 1, reviewCount: 1,
//     conditions: { temp: '68F', weather: 'Stained', wind: '3.1 mph', clarity: 'Stained', condition: 'Excellent', waterLevel: 'Normal', pressure: 'Stable' },
//     status: 'active', featured: true,
//   },
//   {
//     name: 'Lake Chickamauga', slug: 'lake-chickamauga', state: 'Tennessee',
//     description: "Chickamauga has exploded onto the bass fishing scene with incredible largemouth and smallmouth fishing.",
//     size: 36240, catchRate: 4.0, recordBass: 15.2,
//     species: ['Largemouth Bass', 'Smallmouth Bass', 'Striped Bass'],
//     image: '/images/lake3.jpg', color: 'from-blue-700/80 to-cyan-900/80',
//     rating: 4.8, ratingCount: 1, reviewCount: 1,
//     conditions: { temp: '68F', weather: 'Clear', wind: '6.0 mph', clarity: 'Clear', condition: 'Excellent', waterLevel: 'Normal', pressure: 'Rising' },
//     status: 'active', featured: true,
//   },
//   {
//     name: 'Lake Fork', slug: 'lake-fork', state: 'Texas',
//     description: "Lake Fork holds the Texas state record Largemouth bass at 18.18 lbs. Legendary trophy bass destination.",
//     size: 27264, catchRate: 3.2, recordBass: 18.18,
//     species: ['Largemouth Bass', 'Smallmouth Bass', 'Crappie', 'Catfish'],
//     image: '/images/lake4.jpg', color: 'from-emerald-800/80 to-green-950/80',
//     rating: 4.7, ratingCount: 1, reviewCount: 1,
//     conditions: { temp: '65F', weather: 'Clear', wind: '5.2 mph', clarity: 'Clear', condition: 'Excellent', waterLevel: 'Normal', pressure: 'Stable' },
//     status: 'active', featured: true,
//   },
//   {
//     name: 'Lake Tohopekaliga', slug: 'lake-tohopekaliga', state: 'Florida',
//     description: "Lake Toho is one of Central Florida's premier bass fishing lakes. Trophy largemouth habitat at its finest.",
//     size: 22700, catchRate: 3.8, recordBass: 16.5,
//     species: ['Largemouth Bass', 'Bluegill', 'Crappie'],
//     image: '/images/lake5.jpg', color: 'from-slate-700/80 to-blue-950/80',
//     rating: 4.7, ratingCount: 1, reviewCount: 1,
//     conditions: { temp: '72F', weather: 'Stained', wind: '4.5 mph', clarity: 'Stained', condition: 'Excellent', waterLevel: 'Normal', pressure: 'Stable' },
//     status: 'active', featured: false,
//   },
//   {
//     name: 'Lake Okeechobee', slug: 'lake-okeechobee', state: 'Florida',
//     description: "The Big O is Florida's largest lake and one of the most famous bass fishing destinations in the world.",
//     size: 450000, catchRate: 4.5, recordBass: 12.0,
//     species: ['Largemouth Bass', 'Bluegill', 'Crappie'],
//     image: '/images/lake6.jpg', color: 'from-indigo-700/80 to-sky-900/80',
//     rating: 4.6, ratingCount: 1, reviewCount: 1,
//     conditions: { temp: '74F', weather: 'Stained', wind: '3.5 mph', clarity: 'Stained', condition: 'Good', waterLevel: 'Normal', pressure: 'Falling' },
//     status: 'active', featured: true,
//   },
// ];

const seedAdmin = async () => {
  if (mongoose.connection.readyState === 0) await connectDB();

  try {
    // ── Seed admin users ───────────────────────────────────────────────────
    const adminsToSeed = [
      {
        email: process.env.ADMIN_EMAIL || "admin@bassinsight.com",
        name: process.env.ADMIN_NAME || "BassInsight Admin",
        password: process.env.ADMIN_PASSWORD || "Admin@123",
      },
      {
        email: "bassport@gmail.com",
        name: "BassPort",
        password: "bassport@Admin",
      },
    ];

    for (const adminData of adminsToSeed) {
      let adminUser = await User.findOne({ email: adminData.email });

      if (!adminUser) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminData.password, salt);

        adminUser = await User.create({
          name: adminData.name,
          email: adminData.email,
          password: hashedPassword,
          role: "admin",
          status: "active",
          permissions: ADMIN_ATOMS,
        });
        console.log("✅ Admin user seeded:", adminData.email);
      } else {
        let changed = false;
        if (adminUser.role !== "admin") {
          adminUser.role = "admin";
          changed = true;
        }
        if (adminUser.status !== "active") {
          adminUser.status = "active";
          changed = true;
        }
        // Also ensure permissions are up to date if they differ
        if (JSON.stringify(adminUser.permissions) !== JSON.stringify(ADMIN_ATOMS)) {
          adminUser.permissions = ADMIN_ATOMS;
          changed = true;
        }

        if (changed) {
          await adminUser.save();
          console.log(`🔧 Admin roles/permissions updated for: ${adminData.email}`);
        } else {
          console.log(`ℹ️  Admin user already exists: ${adminData.email}`);
        }
      }
    }

    // ── Seed sample lakes ──────────────────────────────────────────────────
    // const lakeCount = await Lake.countDocuments();
    // if (lakeCount === 0) {
    //   const lakeDocs = SAMPLE_LAKES.map(l => ({
    //     ...l,
    //     submittedBy: adminUser._id,
    //     approvedBy:  adminUser._id,
    //     approvedAt:  new Date(),
    //   }));
    //   await Lake.insertMany(lakeDocs);
    //   console.log(`✅ ${lakeDocs.length} sample lakes seeded`);
    // } else {
    //   console.log(`ℹ️  Lakes already exist (${lakeCount}), skipping lake seed`);
    // }

    if (require.main === module) process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error.message);
    if (require.main === module) process.exit(1);
  }
};

if (require.main === module) seedAdmin();

module.exports = seedAdmin;
