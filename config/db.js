require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

// Override local DNS servers to fix 'querySrv ECONNREFUSED' errors dynamically.
// This enforces Node to use Google's Public DNS to resolve MongoDB Atlas SRV records correctly.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DATABASE_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
