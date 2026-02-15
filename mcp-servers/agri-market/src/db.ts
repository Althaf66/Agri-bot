// Database initialization and migration module for Market MCP Server

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Schema creation function
const createSchema = (db: Database.Database): void => {
  // Crop MSP table
  db.exec(`
    CREATE TABLE IF NOT EXISTS crop_msp (
      crop_name TEXT PRIMARY KEY,
      msp_price REAL NOT NULL,
      unit TEXT NOT NULL
    );
  `);

  // Mandis table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mandis (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL
    );
  `);

  // Mandi prices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mandi_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mandi_id TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      current_price REAL NOT NULL,
      FOREIGN KEY (mandi_id) REFERENCES mandis(id),
      FOREIGN KEY (crop_name) REFERENCES crop_msp(crop_name),
      UNIQUE(mandi_id, crop_name)
    );
  `);

  // Price trends table (7-day history)
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_trends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mandi_id TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      day_offset INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (mandi_id) REFERENCES mandis(id),
      FOREIGN KEY (crop_name) REFERENCES crop_msp(crop_name),
      UNIQUE(mandi_id, crop_name, day_offset)
    );
  `);

  // Market configuration table
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_config (
      key TEXT PRIMARY KEY,
      value REAL NOT NULL
    );
  `);

  // Mandi price summary view (joins mandis + prices + MSP)
  db.exec(`
    CREATE VIEW IF NOT EXISTS mandi_price_summary AS
    SELECT
      m.id as mandi_id,
      m.name as mandi_name,
      m.district,
      m.lat,
      m.lon,
      mp.crop_name,
      mp.current_price,
      c.msp_price,
      (mp.current_price - c.msp_price) as msp_diff,
      CASE
        WHEN mp.current_price >= c.msp_price THEN 'ABOVE_MSP'
        ELSE 'BELOW_MSP'
      END as msp_status
    FROM mandis m
    JOIN mandi_prices mp ON m.id = mp.mandi_id
    JOIN crop_msp c ON mp.crop_name = c.crop_name;
  `);
};

// Data migration function
const migrateData = (db: Database.Database): void => {
  const transaction = db.transaction(() => {
    // Load JSON data
    const mandiPricesPath = join(__dirname, '..', 'data', 'mandi_prices.json');
    const mandiData = JSON.parse(readFileSync(mandiPricesPath, 'utf-8'));

    // Insert crops with MSP
    const cropInsert = db.prepare(`
      INSERT OR REPLACE INTO crop_msp (crop_name, msp_price, unit)
      VALUES (?, ?, ?)
    `);

    for (const [cropName, cropInfo] of Object.entries(mandiData.crops) as [string, any][]) {
      cropInsert.run(cropName, cropInfo.msp, cropInfo.unit);
    }

    // Insert mandis
    const mandiInsert = db.prepare(`
      INSERT OR REPLACE INTO mandis (id, name, district, state, lat, lon)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const mandi of mandiData.mandis) {
      mandiInsert.run(
        mandi.id,
        mandi.name,
        mandi.district,
        mandi.state,
        mandi.lat,
        mandi.lon
      );
    }

    // Insert current prices
    const priceInsert = db.prepare(`
      INSERT OR REPLACE INTO mandi_prices (mandi_id, crop_name, current_price)
      VALUES (?, ?, ?)
    `);

    for (const mandi of mandiData.mandis) {
      for (const [cropName, price] of Object.entries(mandi.prices) as [string, number][]) {
        priceInsert.run(mandi.id, cropName, price);
      }
    }

    // Insert price trends (7-day history)
    const trendInsert = db.prepare(`
      INSERT OR REPLACE INTO price_trends (mandi_id, crop_name, day_offset, price)
      VALUES (?, ?, ?, ?)
    `);

    for (const [mandiId, mandiTrends] of Object.entries(mandiData.price_trends) as [string, any][]) {
      for (const [cropName, prices] of Object.entries(mandiTrends) as [string, number[]][]) {
        prices.forEach((price, index) => {
          trendInsert.run(mandiId, cropName, index, price);
        });
      }
    }

    // Insert transport cost configuration
    const configInsert = db.prepare(`
      INSERT OR REPLACE INTO market_config (key, value)
      VALUES (?, ?)
    `);

    configInsert.run('transport_cost_per_km', mandiData.transport_cost_per_km);
  });

  transaction();
};

// Type for the database instance
export interface MarketDatabase {
  initialize: () => void;
  getDatabase: () => Database.Database;
}

// Factory function to create database instance
export const createMarketDatabase = (dbPath: string): MarketDatabase => {
  // Initialize database connection
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize database (idempotent)
  const initialize = (): void => {
    // Check if market tables already exist
    const marketTableCount = db
      .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name IN ('crop_msp', 'mandis', 'mandi_prices', 'price_trends', 'market_config')")
      .get() as { cnt: number };

    if (marketTableCount.cnt === 5) {
      console.error('Market database already initialized');
      return;
    }

    console.error('Initializing market database schema...');
    createSchema(db);
    console.error('Migrating market data from JSON files...');
    migrateData(db);
    console.error('Market database initialization complete');
  };

  // Return public API
  return {
    initialize,
    getDatabase: () => db
  };
};
