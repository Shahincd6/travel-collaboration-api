const jwt = require("jsonwebtoken")
const pool = require("../config/database")

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from database
    const userResult = await pool.query("SELECT id, username, email, first_name, last_name FROM users WHERE id = $1", [
      decoded.userId,
    ])

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid token" })
    }

    req.user = userResult.rows[0]
    next()
  } catch (error) {
    console.error("Token verification error:", error)
    return res.status(403).json({ error: "Invalid or expired token" })
  }
}

// Check if user has access to trip with specific role
const checkTripAccess = (requiredRoles = ["owner", "editor", "viewer"]) => {
  return async (req, res, next) => {
    try {
      const tripId = req.params.tripId || req.params.id
      const userId = req.user.id

      const result = await pool.query(
        `
        SELECT tc.role, t.owner_id
        FROM trips t
        LEFT JOIN trip_collaborators tc ON t.id = tc.trip_id AND tc.user_id = $1
        WHERE t.id = $2
      `,
        [userId, tripId],
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Trip not found" })
      }

      const { role, owner_id } = result.rows[0]

      // Owner always has access
      if (owner_id === userId) {
        req.userRole = "owner"
        return next()
      }

      // Check collaborator role
      if (!role || !requiredRoles.includes(role)) {
        return res.status(403).json({ error: "Insufficient permissions" })
      }

      req.userRole = role
      next()
    } catch (error) {
      console.error("Trip access check error:", error)
      res.status(500).json({ error: "Server error" })
    }
  }
}

module.exports = {
  authenticateToken,
  checkTripAccess,
}
