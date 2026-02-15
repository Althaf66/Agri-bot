import type Database from 'better-sqlite3';
import type { FarmerData, PaymentStatus, InsuranceInfo, InsurancePolicy, InsuranceClaim } from './types.js';

export function createFinanceQueries(db: Database.Database) {
  // Get farmer data from core database
  function getFarmerData(farmerId: string): (FarmerData & { credit_score?: number; has_loan_default?: boolean; is_taxpayer?: boolean }) | null {
    const farmerQuery = db.prepare('SELECT * FROM farmers WHERE id = ?');
    const farmerRow = farmerQuery.get(farmerId) as any;

    if (!farmerRow) return null;

    // Get finance-specific data
    const financeQuery = db.prepare(`
      SELECT * FROM scheme_enrollments
      WHERE farmer_id = ?
      LIMIT 1
    `);
    const financeRow = financeQuery.get(farmerId) as any;

    // Parse JSON fields
    const farmerData: FarmerData & { credit_score?: number; has_loan_default?: boolean; is_taxpayer?: boolean } = {
      id: farmerRow.id,
      name: farmerRow.name,
      location: JSON.parse(farmerRow.location),
      land_acres: farmerRow.land_acres,
      crops: JSON.parse(farmerRow.crops),
      income_category: farmerRow.income_category,
      bank_account: Boolean(farmerRow.bank_account),
      aadhaar_linked: Boolean(farmerRow.aadhaar_linked),
      role: farmerRow.role,
      // Add synthetic finance data
      credit_score: 650 + Math.floor(Math.random() * 150), // 650-800
      has_loan_default: false,
      is_taxpayer: false
    };

    return farmerData;
  }

  // Get weather risk for location (check for RED/ORANGE alerts)
  function getWeatherRisk(district: string): boolean {
    // In a real implementation, this would call agri-weather server
    // For now, simulate based on district
    const highRiskDistricts = ['Belgaum', 'Dharwad'];
    return highRiskDistricts.includes(district);
  }

  // Get disease risk for farmer (check recent disease diagnoses)
  function getDiseaseRisk(farmerId: string): boolean {
    // In a real implementation, this would call agri-doctor server
    // Check if farmer has recent disease diagnoses
    try {
      const diagnosisQuery = db.prepare(`
        SELECT severity FROM diagnoses
        WHERE farmer_id = ?
        ORDER BY diagnosis_date DESC
        LIMIT 1
      `);
      const diagnosis = diagnosisQuery.get(farmerId) as any;

      if (diagnosis && (diagnosis.severity === 'HIGH' || diagnosis.severity === 'CRITICAL')) {
        return true;
      }
    } catch (error) {
      // Table might not exist
    }

    return false;
  }

  // Get market price for crop
  function getMarketPrice(cropName: string): number {
    // In a real implementation, this would call agri-market server
    // Simulate market prices (₹ per quintal)
    const prices: Record<string, number> = {
      'Rice': 2500,
      'Wheat': 2200,
      'Cotton': 6500,
      'Maize': 2000,
      'Tomato': 3000,
      'Sugarcane': 3100,
      'Soybean': 4500
    };

    return prices[cropName] || 2000;
  }

  // Get payment status for farmer
  function getPaymentStatus(farmerId: string, schemeName?: string): PaymentStatus[] {
    let query = `
      SELECT
        se.scheme_name,
        ph.payment_cycle,
        ph.payment_amount,
        ph.scheduled_date,
        ph.actual_date,
        ph.status
      FROM scheme_enrollments se
      LEFT JOIN payment_history ph ON se.id = ph.enrollment_id
      WHERE se.farmer_id = ?
    `;

    const params: any[] = [farmerId];

    if (schemeName) {
      query += ' AND se.scheme_name = ?';
      params.push(schemeName);
    }

    query += ' ORDER BY ph.scheduled_date DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];

    // Group by scheme
    const schemeMap = new Map<string, any>();

    for (const row of rows) {
      if (!schemeMap.has(row.scheme_name)) {
        schemeMap.set(row.scheme_name, {
          farmer_id: farmerId,
          scheme_name: row.scheme_name,
          payment_history: [],
          total_received: 0
        });
      }

      const scheme = schemeMap.get(row.scheme_name);

      if (row.payment_cycle) {
        scheme.payment_history.push({
          cycle: row.payment_cycle,
          amount: row.payment_amount,
          scheduled_date: row.scheduled_date,
          actual_date: row.actual_date,
          status: row.status
        });

        if (row.status === 'PAID') {
          scheme.total_received += row.payment_amount;
        }
      }
    }

    // Add next payment info
    const results: PaymentStatus[] = [];
    for (const scheme of schemeMap.values()) {
      const pendingPayment = scheme.payment_history.find((p: any) => p.status === 'PENDING' || p.status === 'SCHEDULED');
      if (pendingPayment) {
        scheme.next_payment = {
          cycle: pendingPayment.cycle,
          amount: pendingPayment.amount,
          scheduled_date: pendingPayment.scheduled_date
        };
      }
      results.push(scheme);
    }

    return results;
  }

  // Get insurance info for farmer
  function getInsuranceInfo(farmerId: string): InsuranceInfo {
    // Get active policies
    const policiesQuery = db.prepare(`
      SELECT * FROM insurance_policies
      WHERE farmer_id = ?
      ORDER BY start_date DESC
    `);
    const policyRows = policiesQuery.all(farmerId) as any[];

    const policies: InsurancePolicy[] = policyRows.map(row => ({
      id: row.id,
      farmer_id: row.farmer_id,
      crop_name: row.crop_name,
      season: row.season,
      sum_insured: row.sum_insured,
      premium_amount: row.premium_amount,
      premium_paid: Boolean(row.premium_paid),
      start_date: row.start_date,
      end_date: row.end_date,
      status: row.status
    }));

    // Get claims
    const claimsQuery = db.prepare(`
      SELECT * FROM insurance_claims
      WHERE farmer_id = ?
      ORDER BY filed_date DESC
    `);
    const claimRows = claimsQuery.all(farmerId) as any[];

    const claims: InsuranceClaim[] = claimRows.map(row => ({
      id: row.id,
      policy_id: row.policy_id,
      farmer_id: row.farmer_id,
      claim_type: row.claim_type,
      claim_amount: row.claim_amount,
      claim_reason: row.claim_reason,
      filed_date: row.filed_date,
      status: row.status
    }));

    // Calculate totals
    const activePolicies = policies.filter(p => p.status === 'ACTIVE');
    const total_coverage = activePolicies.reduce((sum, p) => sum + p.sum_insured, 0);
    const total_premium_paid = policies.reduce((sum, p) => sum + (p.premium_paid ? p.premium_amount : 0), 0);

    // Check if claim eligible based on weather/disease
    const farmerData = getFarmerData(farmerId);
    let claim_eligible = false;
    let claim_reason: string | undefined;

    if (farmerData && activePolicies.length > 0) {
      const weatherRisk = getWeatherRisk(farmerData.location.district);
      const diseaseRisk = getDiseaseRisk(farmerId);

      if (weatherRisk) {
        claim_eligible = true;
        claim_reason = `RED/ORANGE weather alert in ${farmerData.location.district} - crop damage likely. File claim within 72 hours.`;
      } else if (diseaseRisk) {
        claim_eligible = true;
        claim_reason = 'HIGH/CRITICAL disease severity detected - significant crop loss expected. File claim with disease diagnosis report.';
      }
    }

    return {
      farmer_id: farmerId,
      active_policies: activePolicies,
      claims,
      total_coverage,
      total_premium_paid,
      claim_eligible,
      claim_reason
    };
  }

  return {
    getFarmerData,
    getWeatherRisk,
    getDiseaseRisk,
    getMarketPrice,
    getPaymentStatus,
    getInsuranceInfo
  };
}
