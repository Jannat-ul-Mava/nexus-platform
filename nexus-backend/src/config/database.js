const mongoose = require('mongoose');

function connectDB() {
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  .then((conn) => {
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  })
  .catch((error) => {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });
}

module.exports = connectDB;