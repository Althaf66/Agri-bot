# AgriBot Market MCP Server

Market intelligence server providing mandi price data, transport cost optimization, and price trend analysis for Karnataka farmers.

## Overview

The **agri-market** server provides 3 specialized tools for market intelligence:

1. **get_mandi_prices**: Returns all mandi prices for a crop with MSP comparison
2. **compare_prices**: Calculates transport costs and recommends best mandi by net price
3. **get_price_trend**: Analyzes 7-day price trends (RISING/FALLING/STABLE)

## Features

- ✅ **10 Mandis** across Karnataka districts
- ✅ **5 Crops**: Rice, Wheat, Maize, Tomato, Cotton
- ✅ **MSP Integration**: Government Minimum Support Price comparison
- ✅ **Transport Cost Model**: Rs 12/km (realistic for Karnataka)
- ✅ **Haversine Distance**: Accurate distance calculation
- ✅ **7-Day Price Trends**: Historical analysis with recommendations
- ✅ **Shared Database**: Extends agri-core's SQLite database

## Database Schema

### Tables Created
- `crop_msp`: MSP prices for each crop
- `mandis`: Market center locations (10 mandis)
- `mandi_prices`: Current prices (50 records: 10 mandis × 5 crops)
- `price_trends`: 7-day history (105 records: 3 mandis × 5 crops × 7 days)
- `market_config`: Configuration (transport_cost_per_km)

### Views
- `mandi_price_summary`: Pre-joined view with mandis + prices + MSP

## Installation

```bash
cd E:/Agribot/mcp-servers/agri-market
npm install
npm run build
npm start
```

## Server Configuration

- **Port**: 3004
- **Database**: `E:/Agribot/mcp-servers/agri-core/data/agribot.db` (shared)
- **Endpoint**: `http://localhost:3004/mcp`

## Tool Usage Examples

### Tool 1: get_mandi_prices

**Query**: "What are tomato prices today?"

**Response**:
```json
{
  "crop": "Tomato",
  "msp": 3500,
  "mandis": [
    {
      "mandi_id": "M001",
      "mandi_name": "Hubli APMC",
      "current_price": 4200,
      "msp_status": "ABOVE_MSP",
      "msp_diff": 700
    }
    // ... more mandis
  ],
  "highest_price": 4200,
  "lowest_price": 3350,
  "price_spread": 850,
  "spread_percent": 25.37
}
```

### Tool 2: compare_prices

**Query**: "Compare rice prices near Dharwad (15.46, 75.01)"

**Response**:
```json
{
  "crop": "Rice",
  "farmer_location": { "lat": 15.46, "lon": 75.01 },
  "mandis": [
    {
      "mandi_name": "Dharwad APMC",
      "distance_km": 0,
      "transport_cost": 0,
      "current_price": 2420,
      "net_price": 2420
    }
    // ... sorted by net_price DESC
  ],
  "best_mandi": {
    "mandi_name": "Dharwad APMC",
    "net_price": 2420
  },
  "recommendation": "Sell at Dharwad APMC for best net return of Rs 2420/qtl"
}
```

### Tool 3: get_price_trend

**Query**: "Price trend for tomato at Hubli APMC"

**Response**:
```json
{
  "mandi_id": "M001",
  "mandi_name": "Hubli APMC",
  "crop_name": "Tomato",
  "prices_7day": [3900, 3950, 4000, 4050, 4100, 4150, 4200],
  "first_price": 3900,
  "last_price": 4200,
  "change_percent": 7.69,
  "direction": "RISING",
  "recommendation": "Prices rising at Hubli APMC (+7.7%). Consider waiting 2-3 days for better rates."
}
```

## Demo Scenarios

### Scenario 1: Rising Prices (Wait Strategy)
- **Mandi**: Hubli APMC
- **Crop**: Tomato
- **Trend**: RISING (+7.7%)
- **Recommendation**: Wait for better rates

### Scenario 2: Falling Prices (Urgency)
- **Mandi**: Bellary APMC
- **Crop**: Tomato
- **Trend**: FALLING (-8.2%)
- **Recommendation**: Sell immediately

### Scenario 3: Stable Prices (No Urgency)
- **Mandi**: Bagalkot APMC
- **Crop**: Tomato
- **Trend**: STABLE (0% change)
- **Recommendation**: No urgency to sell

## Verification

Run comprehensive tests:

```bash
node test-tools.js
```

All tests should pass:
- ✅ get_mandi_prices returns sorted prices with MSP comparison
- ✅ compare_prices calculates distances and net prices correctly
- ✅ get_price_trend analyzes trends and generates recommendations
- ✅ Error handling works for invalid inputs
- ✅ Radius filtering works correctly

## Architecture

### Factory Pattern
- `createServer()`: Creates MCP server instance per session
- `createMarketDatabase()`: Database initialization with idempotent migration
- `createMarketQueries()`: Query functions with business logic

### Key Design Decisions

1. **Shared Database**: Uses agri-core's SQLite DB for cross-server queries
2. **View-Based Queries**: Pre-joined `mandi_price_summary` for performance
3. **Idempotent Init**: Safe to restart server without data duplication
4. **Haversine Distance**: Accurate for distances < 100 km
5. **Type Safety**: TypeScript interfaces ensure data integrity

## Integration with AgriBot

The market server extends the shared database, enabling:
- Cross-referencing farmer locations with nearby mandis
- Weather impact analysis on market prices (future)
- Crop lifecycle integration with selling recommendations (future)

## Production Notes

- **Port**: 3004 (different from agri-core:3002, agri-weather:3003)
- **Transport Cost**: Rs 12/km (configurable in `market_config` table)
- **Price Updates**: Currently static data; production would use live feeds
- **MSP Values**: 2026 estimates; update annually

## Next Steps

After market server is complete:
- Day 3: Implement agri-finance server (loans, subsidies)
- Day 4: Implement agri-doctor server (pest detection, AI diagnosis)
- Day 5: Build master orchestrator with Claude Computer Use

---

**Status**: ✅ Implementation Complete (Steps 2.1 & 2.2)
**Server**: Running on port 3004
**Tools**: 3/3 working
**Tests**: All passing
