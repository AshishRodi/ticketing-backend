const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") }); // <- explicitly load

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

console.log("DB_USER:", process.env.DB_USER);

module.exports = pool;
