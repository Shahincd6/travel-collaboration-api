-- Travel Collaboration API Database Schema

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trips table
CREATE TABLE trips (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    country VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    estimated_cost DECIMAL(10,2),
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip collaborators table
CREATE TABLE trip_collaborators (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trip_id, user_id)
);

-- Itinerary days table
CREATE TABLE itinerary_days (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trip_id, day_number)
);

-- Activities table
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    itinerary_day_id INTEGER REFERENCES itinerary_days(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    location VARCHAR(200) NOT NULL,
    start_time TIME,
    end_time TIME,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity logs table (Bonus feature)
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_trips_owner_id ON trips(owner_id);
CREATE INDEX idx_trip_collaborators_trip_id ON trip_collaborators(trip_id);
CREATE INDEX idx_trip_collaborators_user_id ON trip_collaborators(user_id);
CREATE INDEX idx_itinerary_days_trip_id ON itinerary_days(trip_id);
CREATE INDEX idx_activities_itinerary_day_id ON activities(itinerary_day_id);
CREATE INDEX idx_activities_location ON activities(location);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activity_logs_trip_id ON activity_logs(trip_id);
