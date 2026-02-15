import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Schema creation
const createSchema = (db: Database.Database): void => {
  // Diagnosis history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS diagnosis_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farmer_id TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      image_url TEXT,
      disease_detected TEXT NOT NULL,
      confidence_score REAL NOT NULL,
      symptoms_observed TEXT NOT NULL,
      treatment_recommended TEXT NOT NULL,
      diagnosis_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farmer_id) REFERENCES farmers(id)
    );
  `);

  // Create index for faster farmer queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_diagnosis_farmer_date
    ON diagnosis_history(farmer_id, diagnosis_date DESC);
  `);
};

// Data migration (load common disease treatments)
const migrateData = (db: Database.Database): void => {
  const transaction = db.transaction(() => {
    // Optional: Load treatment data from JSON
    // For now, treatments.json will be queried directly by queries.ts
  });

  transaction();
};

export interface DoctorDatabase {
  initialize: () => void;
  getDatabase: () => Database.Database;
}

export const createDoctorDatabase = (dbPath: string): DoctorDatabase => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const initialize = (): void => {
    // Check if doctor tables already exist (idempotent)
    const tableCount = db
      .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='diagnosis_history'")
      .get() as { cnt: number };

    if (tableCount.cnt === 1) {
      console.error('Doctor database already initialized');
      return;
    }

    console.error('Initializing doctor database schema...');
    createSchema(db);
    migrateData(db);
    console.error('Doctor database initialization complete');
  };

  return {
    initialize,
    getDatabase: () => db
  };
};
