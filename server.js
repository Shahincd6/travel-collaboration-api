const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const http = require("http")
const socketIo = require("socket.io")
require("dotenv").config()

const pool = require("./config/database")
const { generalLimiter } = require("./middleware/rateLimiter")

// Import routes
const authRoutes = require("./routes/auth")
const tripRoutes = require("./routes/trips")
const collaboratorRoutes = require("./routes/collaborators")
const activityRoutes = require("./routes/activities")
const reportRoutes = require("./routes/reports")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

const PORT = process.env.PORT || 3000

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(generalLimiter)

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  })
})

// API Routes
app.use("/api/auth", authRoutes)
app.use("/api/trips", tripRoutes)
app.use("/api/trips", collaboratorRoutes)
app.use("/api/trips", activityRoutes)
app.use("/api/reports", reportRoutes)

// Socket.IO for real-time collaboration
io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  // Join trip room for real-time updates
  socket.on("join-trip", (tripId) => {
    socket.join(`trip-${tripId}`)
    console.log(`User ${socket.id} joined trip ${tripId}`)
  })

  // Leave trip room
  socket.on("leave-trip", (tripId) => {
    socket.leave(`trip-${tripId}`)
    console.log(`User ${socket.id} left trip ${tripId}`)
  })

  // Broadcast trip updates to all collaborators
  socket.on("trip-updated", (data) => {
    socket.to(`trip-${data.tripId}`).emit("trip-updated", data)
  })

  // Broadcast activity updates
  socket.on("activity-updated", (data) => {
    socket.to(`trip-${data.tripId}`).emit("activity-updated", data)
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err)
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" })
})

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Travel Collaboration API running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("Process terminated")
    pool.end()
  })
})

module.exports = app
