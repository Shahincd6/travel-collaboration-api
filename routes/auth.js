const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const pool = require("../config/database")
const { authLimiter } = require("../middleware/rateLimiter")

const router = express.Router()

// Register user
router.post(
  "/register",
  authLimiter,
  [
    body("username").isLength({ min: 3 }).trim().escape(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("first_name").optional().trim().escape(),
    body("last_name").optional().trim().escape(),
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { username, email, password, first_name, last_name } = req.body

      // Check if user already exists
      const existingUser = await pool.query("SELECT id FROM users WHERE username = $1 OR email = $2", [username, email])

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: "Username or email already exists" })
      }

      // Hash password
      const saltRounds = 12
      const password_hash = await bcrypt.hash(password, saltRounds)

      // Create user
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, username, email, first_name, last_name, created_at`,
        [username, email, password_hash, first_name, last_name],
      )

      const user = result.rows[0]

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      })

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          created_at: user.created_at,
        },
        token,
      })
    } catch (error) {
      console.error("Registration error:", error)
      res.status(500).json({ error: "Server error during registration" })
    }
  },
)

// Login user
router.post("/login", authLimiter, [body("username").trim().escape(), body("password").exists()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username, password } = req.body

    // Find user by username or email
    const result = await pool.query(
      "SELECT id, username, email, password_hash, first_name, last_name FROM users WHERE username = $1 OR email = $1",
      [username],
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const user = result.rows[0]

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    })

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ error: "Server error during login" })
  }
})

module.exports = router
