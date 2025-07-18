const { Pool } = require("pg")
require("dotenv").config()

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "travel_collaboration",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // For deployment (like Railway, Render)
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

// Test database connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL database")
})

pool.on("error", (err) => {
  console.error("Database connection error:", err)
})

module.exports = pool
