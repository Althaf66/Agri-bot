// Database initialization and migration module

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Schema creation function
const createSchema = (db: Database.Database): void => {
  // Base user table
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('farmer', 'officer', 'trader'))
    );
  `);

  // Location table
  db.exec(`
    CREATE TABLE locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL
    );
  `);

  // Farmers table
  db.exec(`
    CREATE TABLE farmers (
      id TEXT PRIMARY KEY,
      location_id INTEGER NOT NULL,
      land_acres REAL NOT NULL,
      income_category TEXT NOT NULL,
      bank_account BOOLEAN NOT NULL,
      aadhaar_linked BOOLEAN NOT NULL,
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id) REFERENCES users(id),
      FOREIGN KEY (location_id) REFERENCES locations(id)
    );
  `);

  // Add unique constraint on user names
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_name ON users(name);
  `);

  // Password hashing table (separate for security)
  db.exec(`
    CREATE TABLE IF NOT EXISTS farmer_credentials (
      farmer_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT,
      FOREIGN KEY (farmer_id) REFERENCES farmers(id)
    );
  `);

  // City coordinates mapping table
  db.exec(`
    CREATE TABLE IF NOT EXISTS city_coordinates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_name TEXT UNIQUE NOT NULL,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL
    );
  `);

  // Crop types
  db.exec(`
    CREATE TABLE crop_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  // Crop varieties
  db.exec(`
    CREATE TABLE crop_varieties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crop_type_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (crop_type_id) REFERENCES crop_types(id),
      UNIQUE(crop_type_id, name)
    );
  `);

  // Farmer crops
  db.exec(`
    CREATE TABLE farmer_crops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farmer_id TEXT NOT NULL,
      crop_variety_id INTEGER NOT NULL,
      phase TEXT NOT NULL,
      sown_date TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farmer_id) REFERENCES farmers(id),
      FOREIGN KEY (crop_variety_id) REFERENCES crop_varieties(id)
    );
  `);

  // Crop phases
  db.exec(`
    CREATE TABLE crop_phases (
      phase_key TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      context_prompt TEXT NOT NULL,
      next_phase TEXT NOT NULL,
      typical_duration_days INTEGER NOT NULL
    );
  `);

  // Phase agents
  db.exec(`
    CREATE TABLE phase_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_key TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      FOREIGN KEY (phase_key) REFERENCES crop_phases(phase_key)
    );
  `);

  // Phase tools
  db.exec(`
    CREATE TABLE phase_tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase_key TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      FOREIGN KEY (phase_key) REFERENCES crop_phases(phase_key)
    );
  `);

  // Officers table
  db.exec(`
    CREATE TABLE officers (
      id TEXT PRIMARY KEY,
      block TEXT NOT NULL,
      FOREIGN KEY (id) REFERENCES users(id)
    );
  `);

  // Traders table
  db.exec(`
    CREATE TABLE traders (
      id TEXT PRIMARY KEY,
      mandi TEXT NOT NULL,
      FOREIGN KEY (id) REFERENCES users(id)
    );
  `);

  // Farmer summary view
  db.exec(`
    CREATE VIEW farmer_summary AS
    SELECT
      u.id,
      u.name,
      l.district,
      l.state,
      l.lat,
      l.lon,
      f.land_acres,
      f.income_category,
      f.bank_account,
      f.aadhaar_linked
    FROM users u
    JOIN farmers f ON u.id = f.id
    JOIN locations l ON f.location_id = l.id
    WHERE u.role = 'farmer';
  `);
};

// Data migration function
const migrateData = (db: Database.Database): void => {
  const transaction = db.transaction(() => {
    // Load JSON data
    const farmersPath = join(__dirname, '..', 'data', 'farmers.json');
    const phasesPath = join(__dirname, '..', 'data', 'crop_phases.json');

    const farmersData = JSON.parse(readFileSync(farmersPath, 'utf-8'));
    const phasesData = JSON.parse(readFileSync(phasesPath, 'utf-8'));

    // Insert crop phases first
    const phaseInsert = db.prepare(`
      INSERT INTO crop_phases (phase_key, display_name, context_prompt, next_phase, typical_duration_days)
      VALUES (?, ?, ?, ?, ?)
    `);

    const agentInsert = db.prepare(`
      INSERT INTO phase_agents (phase_key, agent_name) VALUES (?, ?)
    `);

    const toolInsert = db.prepare(`
      INSERT INTO phase_tools (phase_key, tool_name) VALUES (?, ?)
    `);

    for (const [phaseKey, phase] of Object.entries(phasesData.phases) as [string, any][]) {
      phaseInsert.run(
        phaseKey,
        phase.display_name,
        phase.context_prompt,
        phase.next_phase,
        phase.typical_duration_days
      );

      for (const agent of phase.active_agents) {
        agentInsert.run(phaseKey, agent);
      }

      for (const tool of phase.tools_activated) {
        toolInsert.run(phaseKey, tool);
      }
    }

    // Insert users, locations, and farmers
    const userInsert = db.prepare(`
      INSERT INTO users (id, name, role) VALUES (?, ?, ?)
    `);

    const locationInsert = db.prepare(`
      INSERT INTO locations (district, state, lat, lon) VALUES (?, ?, ?, ?)
    `);

    const farmerInsert = db.prepare(`
      INSERT INTO farmers (id, location_id, land_acres, income_category, bank_account, aadhaar_linked, phone, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const cropTypeInsert = db.prepare(`
      INSERT OR IGNORE INTO crop_types (name) VALUES (?)
    `);

    const cropVarietyInsert = db.prepare(`
      INSERT OR IGNORE INTO crop_varieties (crop_type_id, name) VALUES (?, ?)
    `);

    const farmerCropInsert = db.prepare(`
      INSERT INTO farmer_crops (farmer_id, crop_variety_id, phase, sown_date)
      VALUES (?, ?, ?, ?)
    `);

    for (const farmer of farmersData.farmers) {
      userInsert.run(farmer.id, farmer.name, farmer.role);

      const locationResult = locationInsert.run(
        farmer.location.district,
        farmer.location.state,
        farmer.location.lat,
        farmer.location.lon
      );

      const locationId = locationResult.lastInsertRowid;

      farmerInsert.run(
        farmer.id,
        locationId,
        farmer.land_acres,
        farmer.income_category,
        farmer.bank_account ? 1 : 0,
        farmer.aadhaar_linked ? 1 : 0,
        null  // phone - will be added during registration
      );

      // Insert crops
      for (const crop of farmer.crops) {
        cropTypeInsert.run(crop.name);

        const cropType = db
          .prepare('SELECT id FROM crop_types WHERE name = ?')
          .get(crop.name) as { id: number };

        cropVarietyInsert.run(cropType.id, crop.variety);

        const cropVariety = db
          .prepare('SELECT id FROM crop_varieties WHERE crop_type_id = ? AND name = ?')
          .get(cropType.id, crop.variety) as { id: number };

        farmerCropInsert.run(
          farmer.id,
          cropVariety.id,
          crop.phase,
          crop.sown_date
        );
      }
    }

    // Insert officers
    const officerInsert = db.prepare(`
      INSERT INTO officers (id, block) VALUES (?, ?)
    `);

    for (const officer of farmersData.officers) {
      userInsert.run(officer.id, officer.name, officer.role);
      officerInsert.run(officer.id, officer.block);
    }

    // Insert traders
    const traderInsert = db.prepare(`
      INSERT INTO traders (id, mandi) VALUES (?, ?)
    `);

    for (const trader of farmersData.traders) {
      userInsert.run(trader.id, trader.name, trader.role);
      traderInsert.run(trader.id, trader.mandi);
    }

    // Insert city coordinates seed data for Karnataka cities
    const cityInsert = db.prepare(`
      INSERT INTO city_coordinates (city_name, district, state, latitude, longitude)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(city_name) DO NOTHING
    `);

    const cities = [
      { city: 'Dharwad', district: 'Dharwad', state: 'Karnataka', lat: 15.4589, lon: 75.0078 },
      { city: 'Belgaum', district: 'Belgaum', state: 'Karnataka', lat: 15.8497, lon: 74.4977 },
      { city: 'Hubli', district: 'Dharwad', state: 'Karnataka', lat: 15.3647, lon: 75.1240 },
      { city: 'Gadag', district: 'Gadag', state: 'Karnataka', lat: 15.4287, lon: 75.6280 },
      { city: 'Bagalkot', district: 'Bagalkot', state: 'Karnataka', lat: 16.1691, lon: 75.6905 },
      { city: 'Bellary', district: 'Bellary', state: 'Karnataka', lat: 15.1394, lon: 76.9214 },
      { city: 'Bijapur', district: 'Bijapur', state: 'Karnataka', lat: 16.8302, lon: 75.7100 },
      { city: 'Raichur', district: 'Raichur', state: 'Karnataka', lat: 16.2076, lon: 77.3463 }
    ];

    for (const city of cities) {
      cityInsert.run(city.city, city.district, city.state, city.lat, city.lon);
    }
  });

  transaction();
};

// Type for the database instance
export interface AgribotDatabase {
  initialize: () => void;
  getDatabase: () => Database.Database;
}

// Factory function to create database instance
export const createAgribotDatabase = (dbPath: string): AgribotDatabase => {
  // Initialize database connection
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize database (idempotent)
  const initialize = (): void => {
    // List of critical tables that should exist in a properly initialized database
    const criticalTables = [
      'users',
      'farmers',
      'locations',
      'crop_types',
      'farmer_credentials',
      'city_coordinates'
    ];

    // Check which critical tables exist
    const existingTables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];

    const existingTableNames = new Set(existingTables.map(t => t.name));
    const missingTables = criticalTables.filter(t => !existingTableNames.has(t));

    if (missingTables.length === 0 && existingTableNames.size > 0) {
      console.error(`Database already initialized (${existingTableNames.size} tables found)`);
      return;
    }

    if (missingTables.length > 0 && existingTableNames.size > 0) {
      console.error(`Warning: Database is partially initialized. Missing critical tables: ${missingTables.join(', ')}`);
      console.error('This may indicate a schema update. Consider running migrations.');
      console.error(`Found ${existingTableNames.size} existing tables: ${Array.from(existingTableNames).join(', ')}`);
      return;
    }

    console.error('Initializing database schema...');
    createSchema(db);
    console.error('Migrating data from JSON files...');
    migrateData(db);
    console.error('Database initialization complete');
  };

  // Return public API
  return {
    initialize,
    getDatabase: () => db
  };
};
