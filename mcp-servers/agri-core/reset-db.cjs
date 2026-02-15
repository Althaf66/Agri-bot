// Script to reset and reinitialize the database
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'agribot.db');

console.log('Checking database at:', dbPath);

// Check if database exists
if (fs.existsSync(dbPath)) {
  console.log('Database exists. Checking tables...');

  const db = new Database(dbPath);

  // Get list of tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('\nCurrent tables:', tables.map(t => t.name).join(', '));

  // Check if required tables exist
  const requiredTables = ['farmers', 'farmer_credentials', 'users', 'locations'];
  const existingTableNames = tables.map(t => t.name);
  const missingTables = requiredTables.filter(t => !existingTableNames.includes(t));

  if (missingTables.length > 0) {
    console.log('\nMissing required tables:', missingTables.join(', '));
    console.log('\nDeleting database to reinitialize...');
    db.close();
    fs.unlinkSync(dbPath);
    console.log('Database deleted. Please restart the server to reinitialize.');
  } else {
    console.log('\nAll required tables exist.');

    // Check if farmer_credentials has any data
    const credCount = db.prepare("SELECT COUNT(*) as cnt FROM farmer_credentials").get();
    console.log(`\nfarmer_credentials has ${credCount.cnt} records`);

    db.close();
  }
} else {
  console.log('Database does not exist. It will be created on server start.');
}
