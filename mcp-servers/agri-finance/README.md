# AgriBot Finance MCP Server

MCP server providing eligibility checks, payment tracking, and insurance management for Indian agricultural finance schemes.

## Overview

The **agri-finance** server provides real-time access to:

- **PM-KISAN** (Pradhan Mantri Kisan Samman Nidhi) - ₹6,000/year direct benefit transfer
- **PM Fasal Bima Yojana** (PMFBY) - Crop insurance against weather, pests, diseases
- **Kisan Credit Card** (KCC) - Agricultural credit at 4% interest

## Features

✅ **Real Eligibility Logic** - Actual government scheme criteria
✅ **Real Payment Schedules** - Government disbursement dates (Apr/Aug/Dec)
✅ **Synthetic User Data** - 50+ realistic farmer finance records
✅ **Weather Integration** - Auto-detect insurance claims from RED alerts
✅ **Market Integration** - Loan calculations based on crop prices
✅ **Disease Integration** - Premium adjustments based on risk

## Installation

```bash
cd E:\Agribot\mcp-servers\agri-finance
npm install
npm run build
npm start
```

Server runs on: **http://localhost:3006/mcp**

## MCP Tools

### 1. check_scheme_eligibility

**Primary tool for checking farmer eligibility for schemes.**

**Parameters:**
- `farmer_id` (string, required) - Farmer ID (e.g., "F001")
- `scheme_name` (enum, required) - One of:
  - `"PM-KISAN"` - Direct benefit transfer
  - `"PM Fasal Bima Yojana"` - Crop insurance
  - `"Kisan Credit Card"` - Agricultural loan
- `crop_name` (string, optional) - Required for insurance/loan schemes

**Returns:**
```json
{
  "farmer_id": "F001",
  "scheme_name": "PM-KISAN",
  "eligible": true,
  "eligibility_score": 100,
  "factors_checked": [
    {
      "factor": "Land Ownership",
      "required": "Any land (>0 acres)",
      "actual": "4.5 acres",
      "passed": true
    }
  ],
  "recommended_action": "Visit nearest CSC to enroll...",
  "enrollment_steps": [
    "1. Visit PM-KISAN portal: pmkisan.gov.in",
    "2. Select 'Farmer Corner' → 'New Farmer Registration'",
    "..."
  ],
  "additional_info": {
    "annual_benefit": 6000,
    "installments": 3
  }
}
```

**Example Usage:**

```typescript
// Check PM-KISAN eligibility
await check_scheme_eligibility({
  farmer_id: "F001",
  scheme_name: "PM-KISAN"
});

// Check crop insurance eligibility
await check_scheme_eligibility({
  farmer_id: "F001",
  scheme_name: "PM Fasal Bima Yojana",
  crop_name: "Rice"
});

// Check KCC loan eligibility
await check_scheme_eligibility({
  farmer_id: "F001",
  scheme_name: "Kisan Credit Card",
  crop_name: "Rice"
});
```

### 2. get_payment_status

**Track payment history and upcoming disbursements.**

**Parameters:**
- `farmer_id` (string, required) - Farmer ID
- `scheme_name` (string, optional) - Filter by scheme

**Returns:**
```json
{
  "farmer_id": "F001",
  "total_schemes": 1,
  "payment_status": [
    {
      "farmer_id": "F001",
      "scheme_name": "PM-KISAN",
      "payment_history": [
        {
          "cycle": "Q1_2026",
          "amount": 2000,
          "scheduled_date": "2026-04-01",
          "actual_date": "2026-04-05",
          "status": "PAID"
        }
      ],
      "total_received": 8000,
      "next_payment": {
        "cycle": "Q2_2026",
        "amount": 2000,
        "scheduled_date": "2026-08-01"
      }
    }
  ]
}
```

**Example Usage:**

```typescript
// Get all payment status
await get_payment_status({
  farmer_id: "F001"
});

// Get PM-KISAN payments only
await get_payment_status({
  farmer_id: "F001",
  scheme_name: "PM-KISAN"
});
```

### 3. get_insurance_info

**View insurance policies, claims, and auto-detect claim eligibility.**

**Parameters:**
- `farmer_id` (string, required) - Farmer ID

**Returns:**
```json
{
  "farmer_id": "F002",
  "active_policies": [
    {
      "id": 2,
      "crop_name": "Tomato",
      "season": "RABI",
      "sum_insured": 120000,
      "premium_amount": 1800,
      "premium_paid": true,
      "start_date": "2025-12-01",
      "end_date": "2026-04-30",
      "status": "ACTIVE"
    }
  ],
  "claims": [
    {
      "id": 1,
      "claim_type": "DISEASE",
      "claim_amount": 45000,
      "claim_reason": "Late Blight outbreak",
      "filed_date": "2026-02-05",
      "status": "UNDER_REVIEW"
    }
  ],
  "total_coverage": 120000,
  "total_premium_paid": 1800,
  "claim_eligible": true,
  "claim_reason": "HIGH/CRITICAL disease severity detected - file claim within 72 hours"
}
```

**Example Usage:**

```typescript
// Get insurance info (auto-checks for claim eligibility)
await get_insurance_info({
  farmer_id: "F002"
});
```

## Integration with Other Servers

The finance server integrates with:

### agri-weather
- **Weather alerts** → Insurance claim triggers
- RED/ORANGE severity → Automatic claim eligibility

### agri-market
- **Market prices** → Loan assessment
- Above MSP → Lower risk, higher loan eligibility

### agri-doctor
- **Disease history** → Insurance premiums
- Recent HIGH/CRITICAL disease → Premium increase

### agri-core
- **Farmer data** → Eligibility checks
- Land, bank account, aadhaar, income category

## Scheme Details

### PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)

**What it is:** ₹6,000/year direct cash transfer to farmers in 3 installments

**Eligibility:**
- ✅ Must own agricultural land (any size)
- ✅ Bank account + Aadhaar linked
- ❌ Excludes: Income taxpayers, govt employees

**Payment Schedule:**
- Q1: April-July (₹2,000)
- Q2: August-November (₹2,000)
- Q3: December-March (₹2,000)

**Portal:** https://pmkisan.gov.in

### PM Fasal Bima Yojana (Crop Insurance)

**What it is:** Subsidized crop insurance against weather, pests, diseases

**Eligibility:**
- ✅ Notified crops: Rice, Wheat, Cotton, Maize, Sugarcane, Soybean, Tomato
- ✅ Land ownership or tenancy
- ✅ Premium: 2% (Kharif), 1.5% (Rabi), 5% (Commercial)

**Coverage:** Sum insured = Crop yield × MSP

**Claim Triggers:**
- Prevented sowing (excess rain)
- Mid-season adversity (drought, flood, hail)
- Post-harvest losses (cyclone, unseasonal rain)
- Localized calamities (disease, pest attack)

**Portal:** https://pmfby.gov.in

### Kisan Credit Card (Agricultural Credit)

**What it is:** Agricultural credit at subsidized interest (4% for up to ₹3 lakh)

**Eligibility:**
- ✅ Minimum 0.5 acres land
- ✅ Bank account + credit score 600+
- ✅ No loan default history

**Loan Calculation:**
```
Loan Amount = Land (acres) × Scale of Finance × 1.5
Scale of Finance:
  - Rice: ₹40,000/acre
  - Wheat: ₹30,000/acre
  - Cotton: ₹50,000/acre
  - Maize: ₹35,000/acre
  - Tomato: ₹60,000/acre
```

**Interest:** 4% per annum, 12-month tenure

## Database Schema

```sql
-- Scheme enrollments
CREATE TABLE scheme_enrollments (
  id INTEGER PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  scheme_name TEXT NOT NULL,
  enrollment_date TEXT,
  status TEXT DEFAULT 'ACTIVE'
);

-- Payment history
CREATE TABLE payment_history (
  id INTEGER PRIMARY KEY,
  enrollment_id INTEGER NOT NULL,
  farmer_id TEXT NOT NULL,
  payment_amount REAL NOT NULL,
  payment_cycle TEXT,
  scheduled_date TEXT NOT NULL,
  actual_date TEXT,
  status TEXT NOT NULL
);

-- Insurance policies
CREATE TABLE insurance_policies (
  id INTEGER PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  season TEXT NOT NULL,
  sum_insured REAL NOT NULL,
  premium_amount REAL NOT NULL,
  premium_paid BOOLEAN,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE'
);

-- Insurance claims
CREATE TABLE insurance_claims (
  id INTEGER PRIMARY KEY,
  policy_id INTEGER,
  farmer_id TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  claim_amount REAL NOT NULL,
  claim_reason TEXT NOT NULL,
  filed_date TEXT,
  status TEXT DEFAULT 'FILED'
);

-- Farmer loans
CREATE TABLE farmer_loans (
  id INTEGER PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  loan_amount REAL NOT NULL,
  interest_rate REAL NOT NULL,
  tenure_months INTEGER NOT NULL,
  sanctioned_date TEXT,
  disbursement_date TEXT,
  status TEXT DEFAULT 'SANCTIONED'
);
```

## Synthetic Data

The server includes realistic synthetic data for 5 farmers:

- **F001** (Ramesh Patil) - Enrolled in all 3 schemes, active insurance & loan
- **F002** (Lakshmi Devi) - PM-KISAN + insurance, recent disease claim
- **F003** (Suresh Kumar) - PM-KISAN + KCC loan (repaid)
- **F004** (Priya Naik) - Not enrolled (no bank account)
- **F005** (Vijay Reddy) - All schemes, expired insurance, repaid loan

Total records:
- 10 scheme enrollments
- 20 payment history records
- 3 insurance policies
- 1 insurance claim
- 3 farmer loans

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Development mode (with auto-reload)
npm run dev
```

## Testing

```bash
# Run database verification
node test-tools.js

# Check server is running
curl http://localhost:3006/mcp

# Test eligibility check (requires MCP client)
```

## File Structure

```
agri-finance/
├── package.json
├── tsconfig.json
├── README.md
├── data/
│   ├── schemes.json               # PM-KISAN, PMFBY, KCC rules
│   ├── payment_cycles.json        # Government disbursement schedules
│   ├── insurance_plans.json       # PMFBY coverage rates by crop
│   └── synthetic_finance_data.json # 50 farmer finance records
├── src/
│   ├── index.ts                   # Main MCP server with 3 tools
│   ├── db.ts                      # Database schema & initialization
│   ├── types.ts                   # TypeScript interfaces
│   ├── queries.ts                 # Finance query functions
│   └── eligibility.ts             # Eligibility calculation logic
└── build/                         # Compiled output
```

## License

ISC

## Support

For issues or questions, contact the AgriBot development team.
