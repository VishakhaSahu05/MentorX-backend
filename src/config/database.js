const mongoose = require("mongoose");
//console.log(process.env.DB_CONNECTION_SECRET);

const connectDB = async () => {
  await mongoose.connect(process.env.DB_CONNECTION_SECRET);
};

module.exports = connectDB;
