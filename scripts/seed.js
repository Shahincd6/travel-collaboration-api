const bcrypt = require("bcryptjs")
const pool = require("../config/database")

async function seedDatabase() {
  try {
    console.log("🌱 Seeding database with sample data...")

    // Create sample users
    const password_hash = await bcrypt.hash("password123", 12)

    const users = [
      ["john_doe", "john@example.com", password_hash, "John", "Doe"],
      ["jane_smith", "jane@example.com", password_hash, "Jane", "Smith"],
      ["travel_buddy", "buddy@example.com", password_hash, "Travel", "Buddy"],
    ]

    console.log("Creating users...")
    for (const user of users) {
      await pool.query(
        `
        INSERT INTO users (username, email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (username) DO NOTHING
      `,
        user,
      )
    }

    // Get user IDs
    const userResult = await pool.query("SELECT id, username FROM users ORDER BY id LIMIT 3")
    const userIds = userResult.rows

    if (userIds.length < 2) {
      console.log("Not enough users created, skipping trip creation")
      return
    }

    // Create sample trips
    console.log("Creating sample trips...")
    const tripResult = await pool.query(
      `
      INSERT INTO trips (title, description, start_date, end_date, country, category, estimated_cost, owner_id)
      VALUES 
        ('European Adventure', 'A 10-day journey through Europe', '2024-06-01', '2024-06-10', 'Multiple', 'Adventure', 2500.00, $1),
        ('Tokyo Food Tour', 'Exploring the best food in Tokyo', '2024-08-15', '2024-08-20', 'Japan', 'Food & Culture', 1800.00, $2)
      RETURNING id, owner_id
    `,
      [userIds[0].id, userIds[1].id],
    )

    const trips = tripResult.rows

    // Add collaborators
    console.log("Adding collaborators...")
    for (const trip of trips) {
      // Add owner as collaborator
      await pool.query(
        `
        INSERT INTO trip_collaborators (trip_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (trip_id, user_id) DO NOTHING
      `,
        [trip.id, trip.owner_id],
      )

      // Add other users as collaborators
      const otherUsers = userIds.filter((u) => u.id !== trip.owner_id)
      if (otherUsers.length > 0) {
        await pool.query(
          `
          INSERT INTO trip_collaborators (trip_id, user_id, role)
          VALUES ($1, $2, 'editor')
          ON CONFLICT (trip_id, user_id) DO NOTHING
        `,
          [trip.id, otherUsers[0].id],
        )
      }
    }

    // Create itinerary days and activities
    console.log("Creating itinerary and activities...")
    for (const trip of trips) {
      // Create itinerary days (5 days for each trip)
      for (let day = 1; day <= 5; day++) {
        const date = new Date("2024-06-01")
        date.setDate(date.getDate() + day - 1)

        const dayResult = await pool.query(
          `
          INSERT INTO itinerary_days (trip_id, day_number, date)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
          [trip.id, day, date.toISOString().split("T")[0]],
        )

        const dayId = dayResult.rows[0].id

        // Add sample activities
        const activities = [
          ["sightseeing", "City Center", "09:00", "12:00", "Morning exploration"],
          ["dining", "Local Restaurant", "12:30", "14:00", "Traditional lunch"],
          ["museum", "Art Museum", "15:00", "17:00", "Cultural experience"],
        ]

        for (const activity of activities) {
          await pool.query(
            `
            INSERT INTO activities (itinerary_day_id, type, location, start_time, end_time, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
            [dayId, ...activity, trip.owner_id],
          )
        }
      }
    }

    console.log("✅ Database seeded successfully!")
    console.log("📝 Sample users created (password: password123):")
    userIds.forEach((user) => {
      console.log(`   - ${user.username}`)
    })
  } catch (error) {
    console.error("❌ Seeding failed:", error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seedDatabase()
