# Travel Collaboration API

A comprehensive backend system for collaborative trip planning built with Node.js, Express, and PostgreSQL.

## Features

- User Authentication: JWT-based registration and login  
- Trip Management: Create, read, update, delete trips with detailed information  
- Multi-Day Itinerary: Organize activities across multiple days  
- Collaboration System: Role-based access control (owner, editor, viewer)  
- Real-time Updates: Socket.IO integration for live collaboration  
- Advanced Reporting: Complex SQL queries for insights  
- Security: Rate limiting, input validation, and secure password hashing  

## Prerequisites

- Node.js (v16 or higher)  
- PostgreSQL (v12 or higher)  
- npm or yarn  

## Installation

### Option 1: Manual Setup

1. Clone the repository  
   ```bash
   git clone <your-repo-url>
   cd travel-collaboration-api
   ```

2. Install dependencies  
   ```bash
   npm install
   ```

3. Set up environment variables  
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and JWT secret.

4. Set up PostgreSQL database  
   ```bash
   # Create database
   createdb travel_collaboration

   # Run migrations
   npm run migrate

   # Seed with sample data (optional)
   npm run seed
   ```

5. Start the server  
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

### Option 2: Docker Setup

1. Using Docker Compose  
   ```bash
   docker-compose up -d
   ```

2. Run migrations  
   ```bash
   docker-compose exec app npm run migrate
   docker-compose exec app npm run seed
   ```

## API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication Endpoints

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe"
}
```

### Render Link: https://travel-collaboration-api.onrender.com 
