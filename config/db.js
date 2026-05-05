const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);
        // Do not process.exit(1) in serverless environments (Vercel) as it crashes the instance and throws 500s
    }
};

module.exports = connectDB;
