-- ============================================================================
-- ALERTORA AI — PostgreSQL / PostGIS Geospatial Database Schema
-- SIH Problem Statement SIH26084: Convective Scale Nowcasting (0-6 hr)
-- ============================================================================

-- Enable PostGIS spatial extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'citizen', -- citizen, eoc_operator, admin
    district VARCHAR(100),
    phone_number VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Locations Table (Geospatial Geometry)
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    coordinates GEOMETRY(Point, 4326),
    population INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Automatic Weather Stations (AWS) Observations
CREATE TABLE IF NOT EXISTS weather_observations (
    id BIGSERIAL PRIMARY KEY,
    location_id VARCHAR(100) REFERENCES locations(id),
    temperature_c NUMERIC(5,2),
    humidity_pct INT,
    wind_speed_kmh NUMERIC(5,2),
    wind_direction_deg INT,
    pressure_hpa NUMERIC(6,2),
    rainfall_rate_mmh NUMERIC(6,2),
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Doppler Weather Radar (DWR) Observations
CREATE TABLE IF NOT EXISTS radar_observations (
    id BIGSERIAL PRIMARY KEY,
    station_code VARCHAR(50) NOT NULL,
    max_reflectivity_dbz NUMERIC(5,2),
    vil_kg_m2 NUMERIC(5,2),
    freezing_level_height_km NUMERIC(4,2),
    spatial_extent GEOMETRY(Polygon, 4326),
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. INSAT-3DR Satellite Imagery Metadata
CREATE TABLE IF NOT EXISTS satellite_observations (
    id BIGSERIAL PRIMARY KEY,
    satellite_name VARCHAR(50) DEFAULT 'INSAT-3DR',
    channel VARCHAR(50), -- Thermal IR, Water Vapor
    cloud_top_temperature_c NUMERIC(5,2),
    cloud_top_height_km NUMERIC(4,2),
    imaged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Lightning Strike Events
CREATE TABLE IF NOT EXISTS lightning_events (
    id BIGSERIAL PRIMARY KEY,
    strike_type VARCHAR(20), -- Cloud-to-Ground (CG), Intra-Cloud (IC)
    peak_current_ka NUMERIC(6,2),
    location_point GEOMETRY(Point, 4326),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. AI Predictions & Hazard Forecasts
CREATE TABLE IF NOT EXISTS predictions (
    id BIGSERIAL PRIMARY KEY,
    location_id VARCHAR(100) REFERENCES locations(id),
    forecast_hour INT CHECK (forecast_hour BETWEEN 0 AND 6),
    thunderstorm_prob INT CHECK (thunderstorm_prob BETWEEN 0 AND 100),
    hail_prob INT CHECK (hail_prob BETWEEN 0 AND 100),
    cloudburst_prob INT CHECK (cloudburst_prob BETWEEN 0 AND 100),
    lightning_prob INT CHECK (lightning_prob BETWEEN 0 AND 100),
    overall_confidence NUMERIC(4,2),
    risk_level VARCHAR(20), -- LOW, MODERATE, HIGH, EXTREME
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Emergency Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    alert_code VARCHAR(50) PRIMARY KEY,
    severity VARCHAR(20) NOT NULL, -- GREEN, YELLOW, ORANGE, RED
    title VARCHAR(255) NOT NULL,
    location_id VARCHAR(100) REFERENCES locations(id),
    eta_minutes INT,
    summary TEXT,
    action_required TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. AI Precautions Knowledgebase
CREATE TABLE IF NOT EXISTS precautions (
    id SERIAL PRIMARY KEY,
    hazard_type VARCHAR(50) NOT NULL, -- THUNDERSTORM, LIGHTNING, HAIL, CLOUDBURST, DOWNBURST
    target_audience VARCHAR(50) NOT NULL, -- GOVERNMENT, PUBLIC
    instruction_text TEXT NOT NULL,
    priority_order INT DEFAULT 1
);

-- Create Spatial Index on Locations
CREATE INDEX IF NOT EXISTS idx_locations_geom ON locations USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx_lightning_geom ON lightning_events USING GIST(location_point);
