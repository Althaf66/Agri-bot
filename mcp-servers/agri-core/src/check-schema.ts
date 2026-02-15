import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'agribot.db');

console.log('🔍 Checking database schema integrity...');
console.log(`📂 Database path: ${dbPath}\n`);

const db = new Database(dbPath);

try {
  // Define expected schema for critical tables
  const expectedSchema = {
    farmers: ['id', 'location_id', 'land_acres', 'income_category', 'bank_account', 'aadhaar_linked', 'phone', 'created_at'],
    city_coordinates: ['id', 'city_name', 'district', 'state', 'latitude', 'longitude'],
    users: ['id', 'name', 'role'],
    locations: ['id', 'district', 'state', 'lat', 'lon'],
    farmer_credentials: ['farmer_id', 'password_hash', 'created_at', 'last_login']
  };

  let hasIssues = false;

  for (const [tableName, expectedColumns] of Object.entries(expectedSchema)) {
    // Check if table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tableName);

    if (!tableExists) {
      console.log(`❌ Table missing: ${tableName}`);
      hasIssues = true;
      continue;
    }

    // Get actual columns
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    const actualColumns = columns.map(c => c.name);

    // Check for missing columns
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log(`⚠️  Table ${tableName}: Missing columns: ${missingColumns.join(', ')}`);
      hasIssues = true;
    } else {
      console.log(`✅ Table ${tableName}: All expected columns present (${actualColumns.length} columns)`);
    }
  }

  if (!hasIssues) {
    console.log('\n✅ All schema checks passed!');
  } else {
    console.log('\n⚠️  Schema issues detected. Run appropriate migrations to fix.');
  }

} catch (error) {
  console.error('❌ Schema check failed:', error);
  process.exit(1);
} finally {
  db.close();
}
