const mongoose = require("mongoose");

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/cloudexecx";

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log("📦  MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;