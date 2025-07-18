const express = require("express")
const { body, validationResult } = require("express-validator")
const pool = require("../config/database")
const { authenticateToken, checkTripAccess } = require("../middleware/auth")

const router = express.Router()

// Add activity to itinerary day
router.post(
  "/:tripId/days/:dayId/activities",
  authenticateToken,
  checkTripAccess(["owner", "editor"]),
  [
    body("type").isLength({ min: 1 }).trim().escape(),
    body("location").isLength({ min: 1 }).trim().escape(),
    body("start_time")
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body("end_time")
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body("notes").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { tripId, dayId } = req.params
      const { type, location, start_time, end_time, notes } = req.body
      const userId = req.user.id

      // Verify day belongs to trip
      const dayResult = await pool.query("SELECT id FROM itinerary_days WHERE id = $1 AND trip_id = $2", [
        dayId,
        tripId,
      ])

      if (dayResult.rows.length === 0) {
        return res.status(404).json({ error: "Itinerary day not found" })
      }

      // Add activity
      const result = await pool.query(
        `
        INSERT INTO activities (itinerary_day_id, type, location, start_time, end_time, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
        [dayId, type, location, start_time, end_time, notes, userId],
      )

      res.status(201).json({
        message: "Activity added successfully",
        activity: result.rows[0],
      })
    } catch (error) {
      console.error("Add activity error:", error)
      res.status(500).json({ error: "Server error" })
    }
  },
)

// Update activity
router.put(
  "/:tripId/activities/:activityId",
  authenticateToken,
  checkTripAccess(["owner", "editor"]),
  [
    body("type").optional().isLength({ min: 1 }).trim().escape(),
    body("location").optional().isLength({ min: 1 }).trim().escape(),
    body("start_time")
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body("end_time")
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body("notes").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { tripId, activityId } = req.params
      const updates = req.body

      // Verify activity belongs to trip
      const activityResult = await pool.query(
        `
        SELECT a.id FROM activities a
        JOIN itinerary_days id ON a.itinerary_day_id = id.id
        WHERE a.id = $1 AND id.trip_id = $2
      `,
        [activityId, tripId],
      )

      if (activityResult.rows.length === 0) {
        return res.status(404).json({ error: "Activity not found" })
      }

      // Build dynamic update query
      const updateFields = []
      const values = []
      let paramCount = 1

      Object.keys(updates).forEach((key) => {
        if (["type", "location", "start_time", "end_time", "notes"].includes(key)) {
          updateFields.push(`${key} = $${paramCount}`)
          values.push(updates[key])
          paramCount++
        }
      })

      if (updateFields.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" })
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
      values.push(activityId)

      const query = `
        UPDATE activities 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramCount}
        RETURNING *
      `

      const result = await pool.query(query, values)

      res.json({
        message: "Activity updated successfully",
        activity: result.rows[0],
      })
    } catch (error) {
      console.error("Update activity error:", error)
      res.status(500).json({ error: "Server error" })
    }
  },
)

// Delete activity
router.delete(
  "/:tripId/activities/:activityId",
  authenticateToken,
  checkTripAccess(["owner", "editor"]),
  async (req, res) => {
    try {
      const { tripId, activityId } = req.params

      // Verify activity belongs to trip and delete
      const result = await pool.query(
        `
        DELETE FROM activities 
        WHERE id = $1 AND itinerary_day_id IN (
          SELECT id FROM itinerary_days WHERE trip_id = $2
        )
      `,
        [activityId, tripId],
      )

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Activity not found" })
      }

      res.json({ message: "Activity deleted successfully" })
    } catch (error) {
      console.error("Delete activity error:", error)
      res.status(500).json({ error: "Server error" })
    }
  },
)

module.exports = router
