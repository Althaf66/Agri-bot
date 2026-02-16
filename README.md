# AgriBot: Multi-Agent Agricultural Assistant

AgriBot is an AI-powered agricultural operations platform that provides Indian farmers and traders with real-time, phase-aware crop guidance through 7 specialized MCP agents. Features include RBAC-enforced role-based dashboards, government statistics integration, WPI-based price prediction, Dual LLM security, and agent-to-agent communication — all orchestrated through Archestra.

---

## Architecture


## Key Features

### Role-Based Dashboards (RBAC)
| Role | Dashboard | Access | Theme |
|------|-----------|--------|-------|
| **Farmer** | Full dashboard + all tools | All 6 servers, own data | Green |
| **Trader** | Market + Weather + WPI only | 3 servers, public data only | Amber |

### Dual LLM Security
External API responses (weather, market, government data) pass through a quarantine LLM before processing:
1. Primary LLM requests data from external API
2. Data is inspected by Quarantine LLM (no tools, no context)
3. Quarantine responds: 0 (safe) / 1 (suspicious) / 2 (dangerous)
4. Dangerous data is rejected, incidents are logged

### Agent-to-Agent Communication
When agri-doctor diagnoses HIGH severity disease → automatically calls agri-finance for insurance eligibility. One response = diagnosis + treatment + insurance claim instructions.

### Hybrid Farmer Identification
Farmers can be identified using ANY of:
- **Farmer ID**: "F001", "F002"
- **Full Name**: "Ramesh Patil", "Lakshmi Devi" (case-insensitive)
- **Partial Name**: "Ramesh", "Lakshmi" (auto-completes)

### Proactive Alerts System
System automatically checks and notifies farmers about:
- **Weather alerts**: Rain/storm warnings
- **Price alerts**: Market price changes
- **Scheme deadlines**: PM-KISAN, insurance enrollment
- **Phase transitions**: Crop lifecycle stage changes
- Priority levels: HIGH → MEDIUM → LOW

### WPI-Based Price Prediction
Uses NSO India's Wholesale Price Index for price forecasting:
- **Linear Regression**: Predicts WPI index 7, 14, or 30 days ahead
- **Profit Scenarios**: Compares "sell now" vs "wait 7/14 days" with storage costs
- **Confidence Scoring**: HIGH/MEDIUM/LOW based on WPI variance
- **8 Supported Crops**: Rice, wheat, tomato, onion, potato, maize, cotton, sugarcane
- **Government Data**: Authoritative NSO India statistics via eSankhyiki MCP

### Phase-Aware Intelligence
6 crop lifecycle phases with context-specific responses:
- **Pre-sowing**: Soil prep, weather planning
- **Sowing**: Seed selection, spacing
- **Growing**: Irrigation, fertilization
- **Pest-watch**: Disease monitoring, treatment
- **Harvest**: Timing, quality checks
- **Post-harvest**: Storage, price prediction, market timing

## What Makes AgriBot Unique

1. **Phase-Aware Intelligence**: Not just generic advice—responses adapt to the farmer's current crop lifecycle stage (pre-sowing, growing, harvest, etc.)

2. **Government Data Integration**: Direct integration with NSO India's official statistics via eSankhyiki MCP for authoritative WPI data and economic indicators

3. **Transparent Price Prediction**: Uses simple, explainable linear regression on WPI data with confidence scores (HIGH/MEDIUM/LOW) instead of black-box AI

4. **Agent-to-Agent Communication**: Diagnosis of severe crop disease automatically triggers insurance eligibility check—seamless cross-server intelligence

5. **Dual LLM Security**: External API responses pass through a quarantine LLM to detect prompt injection attempts before reaching the main system

6. **Hybrid Farmer Identification**: Farmers don't need to remember IDs—works with names, partial names, or IDs interchangeably

7. **Role-Based Everything**: Separate dashboards, color themes, and tool access for farmers (green), traders (amber), and officers

8. **Proactive Alert System**: System checks for weather warnings, price changes, and scheme deadlines on farmer login—not just reactive Q&A

## Archestra Features (7 Total)

| # | Feature | Purpose | Config File |
|---|---------|---------|-------------|
| 1 | MCP Gateway | Centralized routing + audit for 6 servers | `archestra-config/mcp-gateway.json` |
| 2 | Dual LLM | Prompt injection protection | `archestra-config/dual-llm-config.json` |
| 3 | RBAC | 3-persona permission model | `archestra-config/rbac-policies.json` |
| 4 | Observability | Prometheus metrics + dashboard | `archestra-config/observability.json` |
| 5 | LLM Proxy | Cost optimization (Haiku vs Sonnet) | `archestra-config/llm-proxy.json` |
| 6 | MCP Registry | eSankhyiki government data | `archestra-config/esankhyiki-integration.json` |
| 7 | A2A Communication | Doctor → Finance auto-insurance | Gateway policies |

## MCP Servers

### agri-core — 7 tools
- `get_farmer_profile(identifier)` — Hybrid lookup (ID/name/partial)
- `register_farmer(...)` — Auto-generated IDs
- `login_farmer(identifier, password)` — Bcrypt authentication
- `check_proactive_alerts(identifier)` — Weather/price/scheme alerts
- `update_crop_phase(identifier, crop_name)` — Phase transitions
- `get_crop_lifecycle(phase_key)` — Phase details
- `list_farmers(district?)` — Officer-only listing

### agri-weather — 3 tools
- `get_forecast(lat, lon)` — 7-day weather via OpenMeteo
- `get_alerts(district)` — IMD weather alerts
- `get_soil_moisture(lat, lon, crop_type?)` — Soil moisture data

### agri-doctor — 3 tools
- `analyze_crop_image(image_data, ...)` — Gemini Vision AI diagnosis + A2A insurance check
- `get_treatment_details(disease_name)` — Chemical + organic treatments
- `get_diagnosis_history(farmer_id, limit?)` — Past diagnoses

### agri-finance — 3 tools
- `check_scheme_eligibility(identifier, scheme)` — PM-KISAN, PM Fasal Bima, KCC
- `get_payment_status(identifier, scheme?)` — Payment history
- `get_insurance_info(identifier)` — Insurance policies + claim eligibility

### agri-price-prediction — 3 tools
- `predict_wpi_index(crop, days_ahead)` — WPI forecasting using linear regression
- `analyze_profit_scenarios(crop, quantity, current_price)` — 3-scenario profit analysis
- `calculate_storage_costs(crop, days, quantity)` — Storage cost calculator

### eSankhyiki — 4 tools (NSO India)
- `1_know_about_mospi_api()` — Dataset overview
- `2_get_indicators(dataset)` — Available metrics
- `3_get_metadata(dataset, indicator)` — Valid filter codes
- `4_get_data(dataset, filters)` — Actual statistical data

## How It Works: Example Workflow

### Scenario: Farmer Ramesh has spotted yellow spots on rice leaves

1. **Login**: Ramesh opens dashboard, says "I'm Ramesh" (no need for F001 ID)

2. **Proactive Alerts**: System automatically checks alerts:
   - 🔔 "You have 2 alerts: Heavy rain forecast tomorrow, PM-KISAN deadline in 3 days"

3. **Query**: "I see yellow spots on my rice leaves"

4. **Phase Check**: System calls `get_farmer_profile("Ramesh")`:
   - Current phase: `growing`
   - Activated tools: irrigation, pest-watch, diagnosis

5. **Diagnosis**: System calls `analyze_crop_image()`:
   - Gemini Vision AI identifies: "Bacterial Leaf Blight (HIGH severity)"
   - Treatment: Copper oxychloride spray
   - **A2A Communication**: Auto-calls `get_insurance_info("Ramesh")`

6. **Single Response**:
   ```
   🩺 Diagnosis: Bacterial Leaf Blight (HIGH severity)

   Treatment:
   - Spray copper oxychloride (500g/acre)
   - Remove infected plants
   - Apply in 2-3 days before rain

   💰 Insurance: You're eligible for PM Fasal Bima Yojana
   - Coverage: ₹50,000
   - Claim process: Visit APMC with this diagnosis report
   ```

7. **Price Prediction** (post-treatment): "Should I sell my 50 quintals now at ₹3,200?"
   - System calls `analyze_profit_scenarios()`
   - Fetches 90-day WPI data from eSankhyiki
   - Predicts: +3.8% increase in 7 days (HIGH confidence)
   - Recommendation: "Wait 7 days → ₹6,100 extra profit (storage cost: ₹500)"

### Behind the Scenes

```
User Query
    ↓
Archestra Gateway (RBAC check: farmer role)
    ↓
agri-core: get_farmer_profile("Ramesh") → Phase: growing
    ↓
agri-doctor: analyze_crop_image() → HIGH severity
    ↓ (A2A trigger)
agri-finance: get_insurance_info("Ramesh") → Eligible
    ↓
Response with diagnosis + treatment + insurance
```

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker (for Archestra - optional)
- Gemini API key (optional, for crop diagnosis)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Optional: Gemini API for crop diagnosis
GEMINI_API_KEY=your_gemini_api_key_here

# Server ports (defaults shown)
AGRI_CORE_PORT=3002
AGRI_WEATHER_PORT=3003
AGRI_MARKET_PORT=3004
AGRI_DOCTOR_PORT=3005
AGRI_FINANCE_PORT=3006
AGRI_PRICE_PREDICTION_PORT=8004
ESANKHYIKI_PORT=8000

# Archestra configuration
ARCHESTRA_URL=http://localhost:3000

# MOSPI API (eSankhyiki uses NSO India public API)
MOSPI_MCP_SERVER
```

**Note**: The system works without Gemini API key—crop diagnosis will use fallback mode.

### 1. Install & Build

```bash
# Backend (6 custom MCP servers)
cd mcp-servers/agri-core && npm install && npm run build
cd ../agri-weather && npm install && npm run build
cd ../agri-market && npm install && npm run build
cd ../agri-doctor && npm install && npm run build
cd ../agri-finance && npm install && npm run build
cd ../agri-price-prediction && npm install && npm run build

# eSankhyiki (NSO India server)
cd ../esankhyiki-mcp
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../../dashboard-app && npm install
```

### 2. Start All Servers

```bash
# Terminal 1-6: Custom MCP servers
cd mcp-servers/agri-core && npm start                # Port 3002
cd mcp-servers/agri-weather && npm start             # Port 3003
cd mcp-servers/agri-market && npm start              # Port 3004
cd mcp-servers/agri-doctor && npm start              # Port 3005
cd mcp-servers/agri-finance && npm start             # Port 3006
cd mcp-servers/agri-price-prediction && npm start    # Port 8004


# Terminal 9: Dashboard
cd dashboard-app && npm run dev  # Port 5173
```

### 3. Open Dashboard
- **Farmer Dashboard**: http://localhost:5173 → Login with F001-F005 or use name "Ramesh Patil"
  - Green theme, full tool access
  - Features: Profile, crop phases, weather, price prediction, market intelligence, alerts
- **Trader Dashboard**: http://localhost:5173 → Click "Trader" → T001 / trader123
  - Amber theme, market tools only
  - Features: Price trends, WPI forecasts, mandi prices, weather data

## API Endpoints

All MCP servers expose a `/mcp` endpoint for tool invocation via Archestra:

| Server | Port | Endpoint | Protocol |
|--------|------|----------|----------|
| agri-core | 3002 | http://localhost:3002/mcp | SSE/HTTP |
| agri-weather | 3003 | http://localhost:3003/mcp | SSE/HTTP |
| agri-market | 3004 | http://localhost:3004/mcp | SSE/HTTP |
| agri-doctor | 3005 | http://localhost:3005/mcp | SSE/HTTP |
| agri-finance | 3006 | http://localhost:3006/mcp | SSE/HTTP |
| agri-price-prediction | 8004 | http://localhost:8004/mcp | SSE/HTTP |
| Dashboard | 5173 | http://localhost:5173 | HTTP |

## Data Persistence

**SQLite Database**: `mcp-servers/agri-core/data/agribot.db`
- **Farmers table**: Profile, crops, location, current phase
- **Diagnoses table**: Crop disease history
- **Alerts table**: Weather, price, scheme notifications
- **Schemes table**: Government program eligibility
- **Cities table**: Karnataka district coordinates

**JSON Data Files**:
- `mcp-servers/agri-core/data/farmers.json`: Sample farmer profiles
- `mcp-servers/agri-core/data/crop_phases.json`: Lifecycle definitions

**Note**: Database auto-initializes on first run with sample data from JSON files

## Statistics

- **MCP Servers**: 7 (6 custom + 1 government)
- **Tools**: 26 (7 core + 3 weather + 3 market + 3 doctor + 3 finance + 3 price prediction + 4 government)
- **User Roles**: 3 (farmer, officer, trader)
- **Crop Phases**: 6 (pre-sowing, sowing, growing, pest-watch, harvest, post-harvest)
- **Dashboard Pages**: 6 (login, farmer dashboard, trader dashboard, trader login, observability, chat)
- **Archestra Features**: 7 (MCP Gateway, Dual LLM, RBAC, Observability, LLM Proxy, MCP Registry, A2A Communication)
- **Supported Crops**: 8 (rice, wheat, tomato, onion, potato, maize, cotton, sugarcane)
- **Database**: SQLite with 13 tables

## Tech Stack

**Backend**:
- TypeScript, Node.js 18+
- MCP SDK (@modelcontextprotocol/sdk)
- SQLite (better-sqlite3) for farmer data
- Bcrypt for authentication
- Zod for validation
- Gemini Vision API for crop diagnosis
- Regression library for price prediction

**Frontend**:
- React 19 with TypeScript
- Vite build tool
- Tailwind CSS v4
- Recharts for data visualization
- React Router for navigation
- React Query (@tanstack/react-query) for data fetching

**AI Gateway**:
- Archestra (Docker)

**Government Data**:
- eSankhyiki MCP (Python, NSO India)
- MOSPI API integration

**Security**:
- Dual LLM Pattern for prompt injection protection
- RBAC via Archestra
- Bcrypt password hashing
- Role-based dashboard access

## Project Structure

```
E:\Agribot\
├── dashboard-app/                    # React frontend
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx             # Farmer/Trader role toggle
│       │   ├── Dashboard.tsx         # Farmer dashboard (green)
│       │   ├── TraderDashboard.tsx   # Trader dashboard (amber)
│       │   ├── TraderLogin.tsx       # Trader login page
│       │   ├── ObservabilityDashboard.tsx  # Prometheus metrics
│       │   └── ChatPage.tsx          # Archestra chat
│       ├── components/               # PhaseTimeline, PriceChart, etc.
│       └── api/
│           ├── mcpClient.ts          # MCP client (multi-server)
├── mcp-servers/
│   ├── agri-core/                    # Port 3002 — 7 tools (farmer profiles, auth, alerts)
│   ├── agri-weather/                 # Port 3003 — 3 tools (forecasts, soil moisture)
│   ├── agri-market/                  # Port 3004 — 3 tools (prices, mandis, trends)
│   ├── agri-doctor/                  # Port 3005 — 3 tools (crop diagnosis, A2A)
│   ├── agri-finance/                 # Port 3006 — 3 tools (schemes, insurance)
│   ├── agri-price-prediction/        # Port 8004 — 3 tools (WPI forecasting, profit analysis)
├── DEMO_SCRIPT.md                    # 10-min demo guide
├── TESTING.md                        # 26 test cases
└── README.md                         # This file
```

## Key Capabilities Summary

### For Farmers
- **Phase-aware guidance** through all 6 crop lifecycle stages
- **Crop disease diagnosis** using Gemini Vision AI with photo upload
- **WPI-based price prediction** with profit scenario analysis (sell now vs wait 7/14 days)
- **Weather forecasts** and soil moisture monitoring
- **Government scheme eligibility** (PM-KISAN, PM Fasal Bima, KCC)
- **Insurance claim assistance** with automatic eligibility checks
- **Proactive alerts** for weather, prices, and scheme deadlines
- **Hybrid identification** using ID, name, or partial name

### For Traders
- **Market intelligence** dashboard with amber theme
- **WPI price trends** and predictions
- **Weather data** for procurement planning
- **Mandi price comparisons** across Karnataka
- **Access to 3 servers**: weather, market, eSankhyiki only

## Implementation Highlights

- **SQLite database** with 13 tables (farmers, crops, diagnoses, alerts, etc.)
- **Linear regression** algorithm for WPI forecasting
- **Agent-to-agent communication** (doctor → finance for auto-insurance)
- **Dual LLM security** for external API response validation
- **React 19** dashboard with Tailwind CSS v4
- **Government data integration** via MOSPI API

---

**Built for Farmers — From Seed to Sale**

*7 MCP servers, 26 tools, 3 roles, production security — powered by Archestra and MCP*
