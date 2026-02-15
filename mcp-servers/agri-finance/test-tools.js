// Quick test to verify finance tools
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'agri-core', 'data', 'agribot.db');

const db = new Database(dbPath);

console.log('\n=== Database Verification ===\n');

// Check scheme enrollments
const enrollments = db.prepare('SELECT COUNT(*) as count FROM scheme_enrollments').get();
console.log(`Scheme Enrollments: ${enrollments.count}`);

// Check payment history
const payments = db.prepare('SELECT COUNT(*) as count FROM payment_history').get();
console.log(`Payment History Records: ${payments.count}`);

// Check insurance policies
const policies = db.prepare('SELECT COUNT(*) as count FROM insurance_policies').get();
console.log(`Insurance Policies: ${policies.count}`);

// Check insurance claims
const claims = db.prepare('SELECT COUNT(*) as count FROM insurance_claims').get();
console.log(`Insurance Claims: ${claims.count}`);

// Check farmer loans
const loans = db.prepare('SELECT COUNT(*) as count FROM farmer_loans').get();
console.log(`Farmer Loans: ${loans.count}`);

console.log('\n=== Sample Data ===\n');

// Check F001 enrollments
const f001Enrollments = db.prepare(`
  SELECT scheme_name, enrollment_date, status
  FROM scheme_enrollments
  WHERE farmer_id = 'F001'
`).all();

console.log('F001 Enrolled Schemes:');
f001Enrollments.forEach(e => {
  console.log(`  - ${e.scheme_name} (${e.status}, enrolled: ${e.enrollment_date})`);
});

// Check F001 payments
const f001Payments = db.prepare(`
  SELECT payment_cycle, payment_amount, status, scheduled_date
  FROM payment_history
  WHERE farmer_id = 'F001'
  ORDER BY scheduled_date DESC
  LIMIT 3
`).all();

console.log('\nF001 Recent Payments:');
f001Payments.forEach(p => {
  console.log(`  - ${p.payment_cycle}: ₹${p.payment_amount} (${p.status}, scheduled: ${p.scheduled_date})`);
});

// Check F001 insurance
const f001Insurance = db.prepare(`
  SELECT crop_name, season, sum_insured, status
  FROM insurance_policies
  WHERE farmer_id = 'F001'
`).all();

console.log('\nF001 Insurance Policies:');
f001Insurance.forEach(i => {
  console.log(`  - ${i.crop_name} (${i.season}): ₹${i.sum_insured} coverage (${i.status})`);
});

// Check F001 loans
const f001Loans = db.prepare(`
  SELECT loan_amount, interest_rate, status, sanctioned_date
  FROM farmer_loans
  WHERE farmer_id = 'F001'
`).all();

console.log('\nF001 Loans:');
f001Loans.forEach(l => {
  console.log(`  - ₹${l.loan_amount} at ${l.interest_rate * 100}% (${l.status}, sanctioned: ${l.sanctioned_date})`);
});

console.log('\n=== Test Complete ===\n');

db.close();
