import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'agribot.db');

console.log('🔄 Starting city_coordinates table migration...');
console.log(`📂 Database path: ${dbPath}`);

const db = new Database(dbPath);

try {
  // Check if table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='city_coordinates'
  `).get();

  if (tableExists) {
    console.log('✅ city_coordinates table already exists');

    // Check row count
    const count = db.prepare('SELECT COUNT(*) as cnt FROM city_coordinates').get() as { cnt: number };
    console.log(`📊 Table has ${count.cnt} rows`);

    if (count.cnt === 0) {
      console.log('⚠️  Table is empty, will seed data...');
    } else {
      console.log('✅ Migration complete - no changes needed');
      process.exit(0);
    }
  } else {
    console.log('⚠️  city_coordinates table does not exist, creating...');

    // Create the table
    db.exec(`
      CREATE TABLE IF NOT EXISTS city_coordinates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city_name TEXT UNIQUE NOT NULL,
        district TEXT NOT NULL,
        state TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL
      )
    `);

    console.log('✅ Table created successfully');
  }

  // Seed data for Karnataka cities
  const cities = [
    { city_name: 'Dharwad', district: 'Dharwad', state: 'Karnataka', latitude: 15.4589, longitude: 75.0078 },
    { city_name: 'Belgaum', district: 'Belgaum', state: 'Karnataka', latitude: 15.8497, longitude: 74.4977 },
    { city_name: 'Hubli', district: 'Dharwad', state: 'Karnataka', latitude: 15.3647, longitude: 75.1240 },
    { city_name: 'Gadag', district: 'Gadag', state: 'Karnataka', latitude: 15.4287, longitude: 75.6280 },
    { city_name: 'Bagalkot', district: 'Bagalkot', state: 'Karnataka', latitude: 16.1691, longitude: 75.6905 },
    { city_name: 'Bellary', district: 'Bellary', state: 'Karnataka', latitude: 15.1394, longitude: 76.9214 },
    { city_name: 'Bijapur', district: 'Bijapur', state: 'Karnataka', latitude: 16.8302, longitude: 75.7100 },
    { city_name: 'Raichur', district: 'Raichur', state: 'Karnataka', latitude: 16.2076, longitude: 77.3463 }
  ];

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO city_coordinates (city_name, district, state, latitude, longitude)
    VALUES (@city_name, @district, @state, @latitude, @longitude)
  `);

  const insertMany = db.transaction((cities) => {
    let inserted = 0;
    for (const city of cities) {
      const result = insertStmt.run(city);
      if (result.changes > 0) {
        inserted++;
      }
    }
    return inserted;
  });

  const inserted = insertMany(cities);

  if (inserted > 0) {
    console.log(`✅ Seeded ${inserted} cities`);
  } else {
    console.log('ℹ️  All cities already exist in database');
  }

  // Verify final state
  const finalCount = db.prepare('SELECT COUNT(*) as cnt FROM city_coordinates').get() as { cnt: number };
  console.log(`📊 Final table has ${finalCount.cnt} rows`);

  console.log('✅ Migration completed successfully!');

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
