// Scheme Types
export interface Scheme {
  scheme_name: string;
  description: string;
  eligibility_criteria: Record<string, any>;
}

export interface EligibilityCheckRequest {
  farmer_id: string;
  scheme_name: 'PM-KISAN' | 'PM Fasal Bima Yojana' | 'Kisan Credit Card';
  crop_name?: string; // Required for insurance/loan
}

export interface EligibilityFactor {
  factor: string;
  required: any;
  actual: any;
  passed: boolean;
}

export interface EligibilityCheckResult {
  farmer_id: string;
  scheme_name: string;
  eligible: boolean;
  eligibility_score: number; // 0-100
  factors_checked: EligibilityFactor[];
  recommended_action: string;
  enrollment_steps?: string[] | undefined;
  additional_info?: Record<string, any> | undefined;
}

// Payment Types
export interface PaymentRecord {
  cycle: string;
  amount: number;
  scheduled_date: string;
  actual_date?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'SCHEDULED';
}

export interface PaymentStatus {
  farmer_id: string;
  scheme_name: string;
  payment_history: PaymentRecord[];
  total_received: number;
  next_payment?: {
    cycle: string;
    amount: number;
    scheduled_date: string;
  };
}

// Insurance Types
export interface InsurancePolicy {
  id?: number;
  farmer_id: string;
  crop_name: string;
  season: 'KHARIF' | 'RABI';
  sum_insured: number;
  premium_amount: number;
  premium_paid: boolean;
  start_date: string;
  end_date: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CLAIMED';
}

export interface InsuranceClaim {
  id?: number;
  policy_id?: number;
  farmer_id: string;
  claim_type: 'WEATHER' | 'DISEASE' | 'PEST' | 'YIELD_LOSS';
  claim_amount: number;
  claim_reason: string;
  filed_date: string;
  status: 'FILED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID';
}

export interface InsuranceInfo {
  farmer_id: string;
  active_policies: InsurancePolicy[];
  claims: InsuranceClaim[];
  total_coverage: number;
  total_premium_paid: number;
  claim_eligible: boolean;
  claim_reason?: string | undefined;
}

// Farmer Data Types
export interface FarmerData {
  id: string;
  name: string;
  location: {
    district: string;
    state: string;
    lat: number;
    lon: number;
  };
  land_acres: number;
  crops: Array<{
    name: string;
    variety: string;
    phase: string;
    sown_date: string | null;
  }>;
  income_category: string;
  bank_account: boolean;
  aadhaar_linked: boolean;
  role: string;
  credit_score?: number;
  has_loan_default?: boolean;
  is_taxpayer?: boolean;
}

// Loan Types
export interface Loan {
  id?: number;
  farmer_id: string;
  loan_amount: number;
  interest_rate: number;
  tenure_months: number;
  sanctioned_date: string;
  disbursement_date?: string;
  status: 'SANCTIONED' | 'DISBURSED' | 'ACTIVE' | 'REPAID' | 'DEFAULTED';
}
