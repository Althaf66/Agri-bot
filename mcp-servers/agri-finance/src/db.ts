import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createFinanceDatabase(dbPath: string): { getDatabase: () => BetterSqlite3.Database; initialize: () => void } {
  const db = new Database(dbPath);

  function initialize() {
    // Create scheme_enrollments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS scheme_enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farmer_id TEXT NOT NULL,
        scheme_name TEXT NOT NULL,
        enrollment_date TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        FOREIGN KEY (farmer_id) REFERENCES farmers(id)
      )
    `);

    // Create payment_history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        farmer_id TEXT NOT NULL,
        payment_amount REAL NOT NULL,
        payment_cycle TEXT,
        scheduled_date TEXT NOT NULL,
        actual_date TEXT,
        status TEXT NOT NULL,
        FOREIGN KEY (enrollment_id) REFERENCES scheme_enrollments(id),
        FOREIGN KEY (farmer_id) REFERENCES farmers(id)
      )
    `);

    // Create insurance_policies table
    db.exec(`
      CREATE TABLE IF NOT EXISTS insurance_policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farmer_id TEXT NOT NULL,
        crop_name TEXT NOT NULL,
        season TEXT NOT NULL,
        sum_insured REAL NOT NULL,
        premium_amount REAL NOT NULL,
        premium_paid BOOLEAN DEFAULT FALSE,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        FOREIGN KEY (farmer_id) REFERENCES farmers(id)
      )
    `);

    // Create insurance_claims table
    db.exec(`
      CREATE TABLE IF NOT EXISTS insurance_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        policy_id INTEGER,
        farmer_id TEXT NOT NULL,
        claim_type TEXT NOT NULL,
        claim_amount REAL NOT NULL,
        claim_reason TEXT NOT NULL,
        filed_date TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'FILED',
        FOREIGN KEY (policy_id) REFERENCES insurance_policies(id),
        FOREIGN KEY (farmer_id) REFERENCES farmers(id)
      )
    `);

    // Create farmer_loans table
    db.exec(`
      CREATE TABLE IF NOT EXISTS farmer_loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farmer_id TEXT NOT NULL,
        loan_amount REAL NOT NULL,
        interest_rate REAL NOT NULL,
        tenure_months INTEGER NOT NULL,
        sanctioned_date TEXT DEFAULT CURRENT_TIMESTAMP,
        disbursement_date TEXT,
        status TEXT NOT NULL DEFAULT 'SANCTIONED',
        FOREIGN KEY (farmer_id) REFERENCES farmers(id)
      )
    `);

    console.error('Finance database tables initialized');

    // Load synthetic data
    loadSyntheticData();
  }

  function loadSyntheticData() {
    const dataPath = join(__dirname, '..', 'data', 'synthetic_finance_data.json');
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

    // Check if data already exists
    const existingEnrollments = db.prepare('SELECT COUNT(*) as count FROM scheme_enrollments').get() as { count: number };
    if (existingEnrollments.count > 0) {
      console.error('Synthetic finance data already loaded');
      return;
    }

    // Insert enrollments
    const insertEnrollment = db.prepare(`
      INSERT INTO scheme_enrollments (farmer_id, scheme_name, enrollment_date, status)
      VALUES (?, ?, ?, 'ACTIVE')
    `);

    // Insert payments
    const insertPayment = db.prepare(`
      INSERT INTO payment_history (enrollment_id, farmer_id, payment_amount, payment_cycle, scheduled_date, actual_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert insurance policies
    const insertPolicy = db.prepare(`
      INSERT INTO insurance_policies (farmer_id, crop_name, season, sum_insured, premium_amount, premium_paid, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert loans
    const insertLoan = db.prepare(`
      INSERT INTO farmer_loans (farmer_id, loan_amount, interest_rate, tenure_months, sanctioned_date, disbursement_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert insurance claims
    const insertClaim = db.prepare(`
      INSERT INTO insurance_claims (farmer_id, claim_type, claim_amount, claim_reason, filed_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      // Process enrollments
      for (const enrollment of data.enrollments) {
        for (const scheme of enrollment.schemes) {
          const result = insertEnrollment.run(
            enrollment.farmer_id,
            scheme,
            enrollment.pm_kisan_enrollment_date || new Date().toISOString()
          );
          const enrollmentId = result.lastInsertRowid;

          // If PM-KISAN, insert payment history
          if (scheme === 'PM-KISAN') {
            const paymentData = data.payment_history.find((p: any) => p.farmer_id === enrollment.farmer_id);
            if (paymentData) {
              for (const payment of paymentData.payments) {
                insertPayment.run(
                  enrollmentId,
                  enrollment.farmer_id,
                  payment.amount,
                  payment.cycle,
                  payment.scheduled_date,
                  payment.actual_date,
                  payment.status
                );
              }
            }
          }
        }

        // Insert insurance policies
        for (const policy of enrollment.insurance_policies) {
          insertPolicy.run(
            enrollment.farmer_id,
            policy.crop,
            policy.season,
            policy.sum_insured,
            policy.premium_paid,
            1, // premium_paid boolean as integer
            policy.start_date,
            policy.end_date,
            policy.status
          );
        }

        // Insert loans
        for (const loan of enrollment.loans) {
          insertLoan.run(
            enrollment.farmer_id,
            loan.loan_amount,
            loan.interest_rate,
            loan.tenure_months,
            loan.sanctioned_date,
            loan.disbursement_date || null,
            loan.status
          );
        }
      }

      // Insert insurance claims
      for (const claim of data.insurance_claims) {
        insertClaim.run(
          claim.farmer_id,
          claim.claim_type,
          claim.claim_amount,
          claim.claim_reason,
          claim.filed_date,
          claim.status
        );
      }
    });

    transaction();
    console.error('Synthetic finance data loaded successfully');
  }

  return {
    getDatabase: () => db,
    initialize
  };
}
