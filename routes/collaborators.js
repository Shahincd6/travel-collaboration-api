const express = require("express")
const { body, validationResult } = require("express-validator")
const pool = require("../config/database")
const { authenticateToken, checkTripAccess } = require("../middleware/auth")

const router = express.Router()

// Add collaborator to trip
router.post(
  "/:tripId/collaborators",
  authenticateToken,
  checkTripAccess(["owner"]),
  [body("username").isLength({ min: 1 }).trim().escape(), body("role").isIn(["editor", "viewer"])],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { tripId } = req.params
      const { username, role } = req.body

      // Find user by username
      const userResult = await pool.query("SELECT id, username FROM users WHERE username = $1", [username])

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" })
      }

      const user = userResult.rows[0]

      // Check if user is already a collaborator
      const existingResult = await pool.query("SELECT id FROM trip_collaborators WHERE trip_id = $1 AND user_id = $2", [
        tripId,
        user.id,
      ])

      if (existingResult.rows.length > 0) {
        return res.status(400).json({ error: "User is already a collaborator" })
      }

      // Add collaborator
      await pool.query("INSERT INTO trip_collaborators (trip_id, user_id, role) VALUES ($1, $2, $3)", [
        tripId,
        user.id,
        role,
      ])

      res.status(201).json({
        message: "Collaborator added successfully",
        collaborator: {
          user_id: user.id,
          username: user.username,
          role,
        },
      })
    } catch (error) {
      console.error("Add collaborator error:", error)
      res.status(500).json({ error: "Server error" })
    }
  },
)

// Update collaborator role
router.put(
  "/:tripId/collaborators/:userId",
  authenticateToken,
  checkTripAccess(["owner"]),
  [body("role").isIn(["editor", "viewer"])],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { tripId, userId } = req.params
      const { role } = req.body

      const result = await pool.query(
        "UPDATE trip_collaborators SET role = $1 WHERE trip_id = $2 AND user_id = $3 RETURNING *",
        [role, tripId, userId],
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Collaborator not found" })
      }

      res.json({
        message: "Collaborator role updated successfully",
        collaborator: result.rows[0],
      })
    } catch (error) {
      console.error("Update collaborator error:", error)
      res.status(500).json({ error: "Server error" })
    }
  },
)

// Remove collaborator
router.delete("/:tripId/collaborators/:userId", authenticateToken, checkTripAccess(["owner"]), async (req, res) => {
  try {
    const { tripId, userId } = req.params

    const result = await pool.query(
      "DELETE FROM trip_collaborators WHERE trip_id = $1 AND user_id = $2 AND role != $3",
      [tripId, userId, "owner"],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Collaborator not found or cannot remove owner" })
    }

    res.json({ message: "Collaborator removed successfully" })
  } catch (error) {
    console.error("Remove collaborator error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router
