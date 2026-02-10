# AgriBot Weather MCP Server

Multi-agent weather intelligence for Karnataka farmers. Part of the AgriBot platform (2 Fast 2 MCP Hackathon).

## Overview

The `agri-weather` MCP server provides weather forecasting, alerts, and soil moisture monitoring for agricultural operations. It integrates with the shared AgriBot database and uses real-time weather APIs.

## Features

### 3 MCP Tools

#### 1. `get_forecast`
Get 7-day weather forecast with rainfall analysis and irrigation recommendations.

**Input:**
```json
{
  "latitude": 15.46,
  "longitude": 75.01
}
```

**Output:**
- Daily temperature (max/min)
- Rainfall predictions
- Humidity levels
- Wind speed
- Summary analysis (dry spells, heavy rain, irrigation needs)

**Data Source:** OpenMeteo API (real-time, free, no API key required)

#### 2. `get_alerts`
Get active weather alerts for a district (IMD-style advisories).

**Input:**
```json
{
  "district": "Dharwad"
}
```

**Output:**
- Alert type (HEAVY_RAIN, HIGH_HUMIDITY, DRY_SPELL, FROST, HEATWAVE)
- Severity (Yellow/Orange/Red)
- Valid dates
- Farming-specific advice

**Data Source:** SQLite database (mock IMD alerts)

#### 3. `get_soil_moisture`
Get soil moisture reading with crop-specific irrigation recommendations.

**Input:**
```json
{
  "latitude": 15.46,
  "longitude": 75.01,
  "crop_type": "Rice"
}
```

**Output:**
- Current moisture percentage
- Optimal range for crop
- Status (LOW/ADEQUATE/HIGH)
- Irrigation recommendation

**Data Source:** SQLite database (mock IoT sensors)

## Installation

```bash
cd mcp-servers/agri-weather
npm install
npm run build
```

## Running

```bash
npm start
# or
node build/index.js
```

## Database

Connects to shared database: `../agri-core/data/agribot.db`

### Weather Tables

**weather_alerts:**
- 6 active alerts across Dharwad, Belgaum, Hubli, Gadag
- Sorted by severity (Red → Orange → Yellow)

**soil_moisture_readings:**
- 12 sensor readings across 4 districts
- Multiple readings per sensor to show history
- Range: 25-75% moisture

**crop_moisture_ranges:**
- Optimal ranges for 8 crop types
- Rice: 60-80%, Wheat: 50-70%, Cotton: 40-60%, etc.

## Testing

```bash
# Integration test (both agri-core and agri-weather)
cd mcp-servers
node test-integration.js

# Manual MCP test
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js
```

## Architecture

```
agri-weather/
├── src/
│   ├── index.ts      # MCP server implementation
│   ├── weather.ts    # Weather data fetching & DB queries
│   ├── db.ts         # Database initialization
│   └── types.ts      # TypeScript interfaces
├── build/            # Compiled JavaScript
└── package.json
```

## Cross-Agent Queries

After Archestra registration (Step 1.9), these queries work:

- "Get weather forecast for farmer F001's location"
- "Check alerts for all farmers in Belgaum"
- "Is irrigation needed for Ramesh's rice field?"

The system automatically routes queries across both servers.

## API Details

### OpenMeteo Integration

- **Endpoint:** `https://api.open-meteo.com/v1/forecast`
- **Timezone:** Asia/Kolkata
- **Metrics:** Temperature, rainfall, humidity, wind speed
- **Forecast Days:** 7
- **Rate Limit:** 10,000 requests/day (free tier)
- **Documentation:** https://open-meteo.com/en/docs

### Irrigation Logic

- **Dry Spell:** 3+ consecutive days with <2mm rainfall
- **Heavy Rain:** Any day with >30mm rainfall
- **Irrigation Recommended:** Dry spell detected OR total weekly rainfall <10mm

### Haversine Distance

Finds nearest soil moisture sensor within 1km radius using geographic distance calculation.

## Development

```bash
# Build TypeScript
npm run build

# Watch mode (if configured)
npm run dev

# Type checking
tsc --noEmit
```

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `better-sqlite3` - SQLite database access
- `node-fetch` - OpenMeteo API calls
- `zod` - Input validation

## Configuration

- **ES Modules:** `"type": "module"` in package.json
- **TypeScript:** Strict mode with exact optional properties
- **Database:** WAL mode, foreign keys enabled

## Error Handling

- API failures return fallback forecast data
- No sensor found: Helpful error with nearby locations
- Invalid district: Returns empty alerts array
- All errors logged to stderr
- Server remains stable after errors

## Future Enhancements

- Real IMD API integration
- Real IoT sensor data ingestion
- Satellite imagery analysis
- Pest risk predictions based on weather
- Crop yield forecasts

## License

MIT

## Contributing

Part of AgriBot hackathon submission. See main README for project details.

---

**Status:** ✅ Step 1.8 Complete
**Next:** Step 1.9 - Register both servers in Archestra
