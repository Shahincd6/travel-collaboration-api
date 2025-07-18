const express = require("express")
const { body, validationResult } = require("express-validator")
const pool = require("../config/database")
const { authenticateToken, checkTripAccess } = require("../middleware/auth")

const router = express.Router()

// Get all trips for authenticated user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

    const result = await pool.query(
      `
      SELECT DISTINCT t.*, 
             u.username as owner_username,
             tc.role as user_role
      FROM trips t
      JOIN users u ON t.owner_id = u.id
      LEFT JOIN trip_collaborators tc ON t.id = tc.trip_id AND tc.user_id = $1
      WHERE t.owner_id = $1 OR tc.user_id = $1
      ORDER BY t.created_at DESC
    `,
      [userId],
    )

    res.json({
      trips: result.rows,
      count: result.rows.length,
    })
  } catch (error) {
    console.error("Get trips error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get single trip with details
router.get("/:id", authenticateToken, checkTripAccess(["owner", "editor", "viewer"]), async (req, res) => {
  try {
    const tripId = req.params.id

    // Get trip details
    const tripResult = await pool.query(
      `
      SELECT t.*, u.username as owner_username
      FROM trips t
      JOIN users u ON t.owner_id = u.id
      WHERE t.id = $1
    `,
      [tripId],
    )

    // Get collaborators
    const collaboratorsResult = await pool.query(
      `
      SELECT tc.role, u.id, u.username, u.first_name, u.last_name
      FROM trip_collaborators tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.trip_id = $1
    `,
      [tripId],
    )

    // Get itinerary with activities
    const itineraryResult = await pool.query(
      `
      SELECT 
        id.id as day_id,
        id.day_number,
        id.date,
        a.id as activity_id,
        a.type,
        a.location,
        a.start_time,
        a.end_time,
        a.notes,
        u.username as created_by_username
      FROM itinerary_days id
      LEFT JOIN activities a ON id.id = a.itinerary_day_id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE id.trip_id = $1
      ORDER BY id.day_number, a.start_time
    `,
      [tripId],
    )

    // Organize itinerary data
    const itinerary = {}
    itineraryResult.rows.forEach((row) => {
      if (!itinerary[row.day_id]) {
        itinerary[row.day_id] = {
          day_id: row.day_id,
          day_number: row.day_number,
          date: row.date,
          activities: [],
        }
      }

      if (row.activity_id) {
        itinerary[row.day_id].activities.push({
          id: row.activity_id,
          type: row.type,
          location: row.location,
          start_time: row.start_time,
          end_time: row.end_time,
          notes: row.notes,
          created_by_username: row.created_by_username,
        })
      }
    })

    res.json({
      trip: tripResult.rows[0],
      collaborators: collaboratorsResult.rows,
      itinerary: Object.values(itinerary),
      user_role: req.userRole,
    })
  } catch (error) {
    console.error("Get trip error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Create new trip
router.post(
  "/",
  authenticateToken,
  [
    body("title").isLength({ min: 1 }).trim().escape(),
    body("description").optional().trim(),
    body("start_date").isISO8601().toDate(),
    body("end_date").isISO8601().toDate(),
    body("country").isLength({ min: 1 }).trim().escape(),
    body("category").isLength({ min: 1 }).trim().escape(),
    body("estimated_cost").optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { title, description, start_date, end_date, country, category, estimated_cost } = req.body
      const userId = req.user.id

      // Validate dates
      if (new Date(start_date) >= new Date(end_date)) {
        return res.status(400).json({ error: "End date must be after start date" })
      }

      const client = await pool.connect()

      try {
        await client.query("BEGIN")

        // Create trip
        const tripResult = await client.query(
          `
          INSERT INTO trips (title, description, start_date, end_date, country, category, estimated_cost, owner_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
          [title, description, start_date, end_date, country, category, estimated_cost, userId],
        )

        const trip = tripResult.rows[0]

        // Add owner as collaborator
        await client.query(
          `
          INSERT INTO trip_collaborators (trip_id, user_id, role)
          VALUES ($1, $2, 'owner')
        `,
          [trip.id, userId],
        )

        // Create itinerary days
        const startDate = new Date(start_date)
        const endDate = new Date(end_date)
        const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1

        for (let i = 0; i < dayCount; i++) {
          const currentDate = new Date(startDate)
          currentDate.setDate(startDate.getDate() + i)

          await client.query(
            `
            INSERT INTO itinerary_days (trip_id, day_number, date)
            VALUES ($1, $2, $3)
          `,
            [trip.id, i + 1, currentDate.toISOString().split("T")[0]],
          )
        }

        await client.query("COMMIT")

        res.status(201).json({
          message: "Trip created successfully",
          trip,
        })
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      console.error("Create trip error:", error)
      res.status(500).json({ error: "Server error" })
    }
  },
)

// Update trip
router.put(
  "/:id",
  authenticateToken,
  checkTripAccess(["owner", "editor"]),
  [
    body("title").optional().isLength({ min: 1 }).trim().escape(),
    body("description").optional().trim(),
    body("country").optional().isLength({ min: 1 }).trim().escape(),
    body("category").optional().isLength({ min: 1 }).trim().escape(),
    body("estimated_cost").optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const tripId = req.params.id
      const updates = req.body

      // Build dynamic update query
      const updateFields = []
      const values = []
      let paramCount = 1

      Object.keys(updates).forEach((key) => {
        if (["title", "description", "country", "category", "estimated_cost"].includes(key)) {
          updateFields.push(`${key} = $${paramCount}`)
          values.push(updates[key])
          paramCount++
        }
      })

      if (updateFields.length === 0) {
        return res.status(400).json({ error: "No valid fields to update" })
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
      values.push(tripId)

      const query = `
        UPDATE trips 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramCount}
        RETURNING *
      `

      const result = await pool.query(query, values)

      res.json({
        message: "Trip updated successfully",
        trip: result.rows[0],
      })
    } catch (error) {
      console.error("Update trip error:", error)
      res.status(500).json({ error: "Server error" })
    }
  },
)

// Delete trip
router.delete("/:id", authenticateToken, checkTripAccess(["owner"]), async (req, res) => {
  try {
    const tripId = req.params.id

    await pool.query("DELETE FROM trips WHERE id = $1", [tripId])

    res.json({ message: "Trip deleted successfully" })
  } catch (error) {
    console.error("Delete trip error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router
