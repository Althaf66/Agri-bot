import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'agribot.db');

console.log('🔄 Starting farmers table column migration...');
console.log(`📂 Database path: ${dbPath}`);

const db = new Database(dbPath);

try {
  // Check current farmers table structure
  const columns = db.prepare('PRAGMA table_info(farmers)').all() as Array<{ name: string }>;
  const columnNames = columns.map(col => col.name);

  console.log(`📊 Current farmers table has ${columns.length} columns: ${columnNames.join(', ')}`);

  const missingColumns: string[] = [];

  // Check for phone column
  if (!columnNames.includes('phone')) {
    missingColumns.push('phone');
    console.log('⚠️  Missing column: phone');
  } else {
    console.log('✅ Column exists: phone');
  }

  // Check for created_at column
  if (!columnNames.includes('created_at')) {
    missingColumns.push('created_at');
    console.log('⚠️  Missing column: created_at');
  } else {
    console.log('✅ Column exists: created_at');
  }

  if (missingColumns.length === 0) {
    console.log('✅ All required columns exist - no migration needed');
    process.exit(0);
  }

  console.log(`\n🔧 Adding ${missingColumns.length} missing column(s)...`);

  // Add phone column if missing
  if (missingColumns.includes('phone')) {
    db.exec('ALTER TABLE farmers ADD COLUMN phone TEXT');
    console.log('✅ Added column: phone TEXT');
  }

  // Add created_at column if missing
  // Note: SQLite ALTER TABLE doesn't support CURRENT_TIMESTAMP as default
  // We add the column and then set values for existing rows
  if (missingColumns.includes('created_at')) {
    db.exec("ALTER TABLE farmers ADD COLUMN created_at TEXT");
    console.log('✅ Added column: created_at TEXT');

    // Update existing rows to have current timestamp
    const updateResult = db.prepare("UPDATE farmers SET created_at = datetime('now') WHERE created_at IS NULL").run();
    if (updateResult.changes > 0) {
      console.log(`   Updated ${updateResult.changes} existing row(s) with current timestamp`);
    }
  }

  // Verify final structure
  const finalColumns = db.prepare('PRAGMA table_info(farmers)').all() as Array<{ name: string }>;
  console.log(`\n📊 Final farmers table has ${finalColumns.length} columns: ${finalColumns.map(c => c.name).join(', ')}`);

  console.log('✅ Migration completed successfully!');

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
