import type { EligibilityCheckResult, FarmerData } from './types.js';

export function checkPMKisanEligibility(
  farmerData: FarmerData & { credit_score?: number; has_loan_default?: boolean; is_taxpayer?: boolean },
  schemes: any
): EligibilityCheckResult {
  const scheme = schemes.schemes.find((s: any) => s.scheme_name === 'PM-KISAN');

  const factors = [
    {
      factor: 'Land Ownership',
      required: 'Any land (>0 acres)',
      actual: `${farmerData.land_acres} acres`,
      passed: farmerData.land_acres > 0
    },
    {
      factor: 'Bank Account',
      required: 'Required',
      actual: farmerData.bank_account ? 'Yes' : 'No',
      passed: farmerData.bank_account === true
    },
    {
      factor: 'Aadhaar Linked',
      required: 'Required',
      actual: farmerData.aadhaar_linked ? 'Yes' : 'No',
      passed: farmerData.aadhaar_linked === true
    },
    {
      factor: 'Income Taxpayer',
      required: 'No (Excluded)',
      actual: farmerData.is_taxpayer ? 'Yes (ineligible)' : 'No',
      passed: !farmerData.is_taxpayer
    }
  ];

  const passedCount = factors.filter(f => f.passed).length;
  const eligibility_score = (passedCount / factors.length) * 100;
  const eligible = eligibility_score === 100;

  return {
    farmer_id: farmerData.id,
    scheme_name: 'PM-KISAN',
    eligible,
    eligibility_score,
    factors_checked: factors,
    recommended_action: eligible
      ? 'Visit nearest Common Service Center (CSC) to enroll. Bring Aadhaar + Bank Passbook.'
      : 'Fix eligibility issues: ' + factors.filter(f => !f.passed).map(f => f.factor).join(', '),
    enrollment_steps: eligible ? [
      '1. Visit PM-KISAN portal: pmkisan.gov.in',
      '2. Select "Farmer Corner" → "New Farmer Registration"',
      '3. Enter Aadhaar number + Mobile + Bank details',
      '4. Upload land records (if available)',
      '5. Submit for verification',
      '6. First payment in next quarterly cycle (Apr/Aug/Dec)'
    ] : undefined,
    additional_info: {
      annual_benefit: scheme.annual_benefit,
      installments: scheme.installments,
      installment_amount: scheme.installment_amount
    }
  };
}

export function checkFasalBimaEligibility(
  farmerData: FarmerData & { credit_score?: number; has_loan_default?: boolean; is_taxpayer?: boolean },
  cropName: string,
  schemes: any,
  weatherRisk: boolean,
  diseaseRisk: boolean
): EligibilityCheckResult {
  const scheme = schemes.schemes.find((s: any) => s.scheme_name === 'PM Fasal Bima Yojana');
  const notifiedCrops = scheme.eligibility_criteria.notified_crops;

  const factors = [
    {
      factor: 'Notified Crop',
      required: 'Must be in list: ' + notifiedCrops.slice(0, 4).join(', ') + '...',
      actual: cropName,
      passed: notifiedCrops.includes(cropName)
    },
    {
      factor: 'Land Ownership',
      required: 'Required (or tenancy agreement)',
      actual: `${farmerData.land_acres} acres`,
      passed: farmerData.land_acres > 0
    },
    {
      factor: 'Weather Risk Zone',
      required: 'Optional (affects premium)',
      actual: weatherRisk ? 'High risk area (+20% premium)' : 'Normal risk area',
      passed: true // Not blocking
    },
    {
      factor: 'Disease History',
      required: 'Optional (affects premium)',
      actual: diseaseRisk ? 'Recent disease detected (+15% premium)' : 'No recent disease',
      passed: true // Not blocking
    }
  ];

  const passedCount = factors.filter(f => f.passed).length;
  const eligibility_score = (passedCount / factors.length) * 100;
  const eligible = (factors[0]?.passed ?? false) && (factors[1]?.passed ?? false); // Only crop + land are mandatory

  // Calculate premium (2% for Kharif, 1.5% for Rabi, 5% for commercial)
  const kharifCrops = ['Rice', 'Cotton', 'Maize', 'Sugarcane', 'Soybean'];
  const commercialCrops = ['Tomato'];

  let premiumRate: number;
  let season: 'KHARIF' | 'RABI';

  if (kharifCrops.includes(cropName)) {
    premiumRate = scheme?.premium_rates?.kharif || 0.02;
    season = 'KHARIF';
  } else if (commercialCrops.includes(cropName)) {
    premiumRate = scheme?.premium_rates?.commercial || 0.05;
    season = 'RABI';
  } else {
    premiumRate = scheme?.premium_rates?.rabi || 0.015;
    season = 'RABI';
  }

  // Sum insured calculation (₹40k per acre average)
  const sumInsuredPerAcre: Record<string, number> = {
    'Rice': 40000,
    'Wheat': 30000,
    'Cotton': 50000,
    'Maize': 35000,
    'Tomato': 60000,
    'Sugarcane': 55000,
    'Soybean': 32000
  };

  const sumInsured = farmerData.land_acres * (sumInsuredPerAcre[cropName] || 35000);
  const basePremium = sumInsured * premiumRate;

  // Apply risk multipliers
  const weatherMultiplier = weatherRisk ? 1.2 : 1;
  const diseaseMultiplier = diseaseRisk ? 1.15 : 1;
  const finalPremium = basePremium * weatherMultiplier * diseaseMultiplier;

  // Government subsidy (farmer pays only 2%/1.5%/5%, govt pays rest)
  const farmerPremium = sumInsured * premiumRate;

  return {
    farmer_id: farmerData.id,
    scheme_name: 'PM Fasal Bima Yojana',
    eligible,
    eligibility_score,
    factors_checked: factors,
    recommended_action: eligible
      ? `Enroll before sowing. Pay premium: ₹${farmerPremium.toFixed(0)} for ₹${sumInsured.toFixed(0)} coverage.`
      : cropName
        ? `Crop "${cropName}" not covered under PMFBY. Covered crops: ${notifiedCrops.join(', ')}`
        : 'Provide crop name to check eligibility.',
    enrollment_steps: eligible ? [
      '1. Visit bank/insurance company within 7 days of sowing',
      '2. Fill Crop Insurance Proposal Form',
      `3. Pay farmer share premium: ₹${farmerPremium.toFixed(0)}`,
      '4. Receive policy document via SMS',
      '5. File claims within 72 hours of crop loss event'
    ] : undefined,
    additional_info: {
      season,
      sum_insured: sumInsured,
      farmer_premium: farmerPremium,
      premium_rate_percent: premiumRate * 100,
      weather_risk_loading: weatherRisk ? '+20%' : 'None',
      disease_risk_loading: diseaseRisk ? '+15%' : 'None',
      coverage_types: scheme.coverage_types
    }
  };
}

export function checkKCCEligibility(
  farmerData: FarmerData & { credit_score?: number; has_loan_default?: boolean; is_taxpayer?: boolean },
  cropName: string,
  schemes: any,
  marketPrice: number
): EligibilityCheckResult {
  const scheme = schemes.schemes.find((s: any) => s.scheme_name === 'Kisan Credit Card');

  const factors = [
    {
      factor: 'Minimum Land',
      required: '0.5 acres',
      actual: `${farmerData.land_acres} acres`,
      passed: farmerData.land_acres >= 0.5
    },
    {
      factor: 'Bank Account',
      required: 'Required',
      actual: farmerData.bank_account ? 'Yes' : 'No',
      passed: farmerData.bank_account === true
    },
    {
      factor: 'Credit Score',
      required: '600+',
      actual: String(farmerData.credit_score || 650),
      passed: (farmerData.credit_score || 650) >= 600
    },
    {
      factor: 'No Loan Default',
      required: 'No defaults',
      actual: farmerData.has_loan_default ? 'Has default (ineligible)' : 'Clean record',
      passed: !farmerData.has_loan_default
    },
    {
      factor: 'Market Viability',
      required: 'Crop price above MSP (₹2000/quintal)',
      actual: marketPrice ? `₹${marketPrice}/quintal` : 'Not checked',
      passed: marketPrice >= 2000
    }
  ];

  const passedCount = factors.filter(f => f.passed).length;
  const eligibility_score = (passedCount / factors.length) * 100;
  const eligible = eligibility_score === 100;

  // Calculate loan amount (Scale of Finance × Land × Safety Margin)
  const scaleOfFinance = scheme.loan_calculation.scale_of_finance[cropName] || 30000;
  const safetyMargin = scheme.loan_calculation.safety_margin;
  const loanAmount = farmerData.land_acres * scaleOfFinance * safetyMargin;

  // Interest calculation (4% per annum)
  const interestRate = scheme.interest_rate;
  const tenureMonths = scheme.max_tenure_months;
  const monthlyInterest = (loanAmount * interestRate) / 12;
  const totalInterest = monthlyInterest * tenureMonths;

  return {
    farmer_id: farmerData.id,
    scheme_name: 'Kisan Credit Card',
    eligible,
    eligibility_score,
    factors_checked: factors,
    recommended_action: eligible
      ? `Apply for KCC. Eligible loan: ₹${loanAmount.toFixed(0)} at 4% interest.`
      : 'Fix eligibility issues: ' + factors.filter(f => !f.passed).map(f => f.factor).join(', '),
    enrollment_steps: eligible ? [
      '1. Visit nearest bank branch (any nationalized/cooperative bank)',
      '2. Fill KCC application form (Form A)',
      '3. Submit: Land documents + Aadhaar + Bank statement + Passport photo',
      `4. Bank will verify credit history and land records`,
      '5. Loan sanctioned within 7-14 days',
      '6. KCC card issued - use for withdrawals up to sanctioned limit'
    ] : undefined,
    additional_info: {
      loan_amount: loanAmount,
      interest_rate_percent: interestRate * 100,
      tenure_months: tenureMonths,
      scale_of_finance_per_acre: scaleOfFinance,
      estimated_monthly_interest: monthlyInterest,
      total_interest_12_months: totalInterest,
      market_price_per_quintal: marketPrice,
      crop_name: cropName
    }
  };
}
