const express = require("express")
const pool = require("../config/database")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Top 5 cities with most activity mentions across all trips
router.get("/top-cities", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        location as city,
        COUNT(*) as activity_count,
        COUNT(DISTINCT id.trip_id) as trip_count
      FROM activities a
      JOIN itinerary_days id ON a.itinerary_day_id = id.id
      JOIN trips t ON id.trip_id = t.id
      LEFT JOIN trip_collaborators tc ON t.id = tc.trip_id
      WHERE t.owner_id = $1 OR tc.user_id = $1
      GROUP BY location
      ORDER BY activity_count DESC, trip_count DESC
      LIMIT 5
    `,
      [req.user.id],
    )

    res.json({
      report: "Top 5 Cities by Activity Count",
      data: result.rows,
    })
  } catch (error) {
    console.error("Top cities report error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Users ranked by how many trips they've collaborated on
router.get("/user-collaborations", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        COUNT(DISTINCT tc.trip_id) as collaboration_count,
        COUNT(DISTINCT CASE WHEN tc.role = 'owner' THEN tc.trip_id END) as owned_trips,
        COUNT(DISTINCT CASE WHEN tc.role = 'editor' THEN tc.trip_id END) as editor_trips,
        COUNT(DISTINCT CASE WHEN tc.role = 'viewer' THEN tc.trip_id END) as viewer_trips
      FROM users u
      LEFT JOIN trip_collaborators tc ON u.id = tc.user_id
      LEFT JOIN trips t ON tc.trip_id = t.id
      WHERE t.owner_id = $1 OR tc.trip_id IN (
        SELECT trip_id FROM trip_collaborators WHERE user_id = $1
      )
      GROUP BY u.id, u.username, u.first_name, u.last_name
      HAVING COUNT(DISTINCT tc.trip_id) > 0
      ORDER BY collaboration_count DESC, owned_trips DESC
    `,
      [req.user.id],
    )

    res.json({
      report: "User Collaboration Rankings",
      data: result.rows,
    })
  } catch (error) {
    console.error("User collaborations report error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Average duration per activity type across all trips
router.get("/activity-summary", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        a.type,
        COUNT(*) as total_activities,
        COUNT(DISTINCT id.trip_id) as trips_with_type,
        AVG(
          CASE 
            WHEN a.start_time IS NOT NULL AND a.end_time IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600.0
            ELSE NULL 
          END
        ) as avg_duration_hours,
        MIN(
          CASE 
            WHEN a.start_time IS NOT NULL AND a.end_time IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600.0
            ELSE NULL 
          END
        ) as min_duration_hours,
        MAX(
          CASE 
            WHEN a.start_time IS NOT NULL AND a.end_time IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600.0
            ELSE NULL 
          END
        ) as max_duration_hours,
        COUNT(CASE WHEN a.start_time IS NOT NULL AND a.end_time IS NOT NULL THEN 1 END) as activities_with_duration
      FROM activities a
      JOIN itinerary_days id ON a.itinerary_day_id = id.id
      JOIN trips t ON id.trip_id = t.id
      LEFT JOIN trip_collaborators tc ON t.id = tc.trip_id
      WHERE t.owner_id = $1 OR tc.user_id = $1
      GROUP BY a.type
      ORDER BY total_activities DESC, avg_duration_hours DESC
    `,
      [req.user.id],
    )

    res.json({
      report: "Activity Type Summary with Duration Analysis",
      data: result.rows,
    })
  } catch (error) {
    console.error("Activity summary report error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router
