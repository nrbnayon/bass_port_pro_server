require("dotenv").config();
const mongoose = require("mongoose");
const dns = require("dns");

// Override local DNS servers to fix 'querySrv ECONNREFUSED' errors dynamically.
// This enforces Node to use Google's Public DNS to resolve MongoDB Atlas SRV records correctly.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DATABASE_URL, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
      family: 4,
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Connection lost. Retrying in background...');
    });

    mongoose.connection.on('reconnected', () => {
      console.info('[MongoDB] Reconnected successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err.message);
    });

    console.log("Database Connected Successfully");
    // console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
