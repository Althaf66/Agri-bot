# AgriBot Core MCP Server

Core data layer for the AgriBot multi-agent agricultural platform. Provides farmer profiles, crop lifecycle management, and phase transitions through 4 MCP tools.

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Or run in development mode
npm run dev
```

## MCP Tools

### 1. get_farmer_profile
Returns full farmer profile with current crop phase context and active agents.

```json
{
  "farmer_id": "F001"
}
```

### 2. get_crop_lifecycle
Returns crop phase details with tools and context prompt.

```json
{
  "phase_key": "growing"
}
```

### 3. update_crop_phase
Transitions a crop to the next phase (transactional).

```json
{
  "farmer_id": "F001",
  "crop_name": "Rice"
}
```

### 4. list_farmers
Lists all farmers, optionally filtered by district.

```json
{
  "district": "Dharwad"
}
```

## Testing

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector node build/index.js

# Test with custom script
node test-tools.cjs

# Test tools/list command
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js
```

## Database

**Location**: `data/agribot.db`

**Schema**:
- 11 normalized tables for data integrity
- 1 denormalized view for fast queries
- SQLite with WAL mode and foreign keys

**Data**:
- 5 farmers (F001-F005)
- 1 officer (O001)
- 1 trader (T001)
- 6 crop phases (pre_sowing → sowing → growing → pest_watch → harvest → post_harvest)

## Architecture

```
src/
├── index.ts      # MCP server with 4 tools
├── db.ts         # Database initialization & migration
├── queries.ts    # Query layer with prepared statements
└── types.ts      # TypeScript interfaces

data/
├── agribot.db         # SQLite database (generated)
├── farmers.json       # Source data (preserved)
└── crop_phases.json   # Source data (preserved)
```

## Integration

Add to Claude Desktop config (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agri-core": {
      "command": "node",
      "args": ["E:\\Agribot\\mcp-servers\\agri-core\\build\\index.js"]
    }
  }
}
```

## Development

- TypeScript with ES modules
- MCP SDK v1.26.0 (McpServer API)
- Zod schemas for validation
- better-sqlite3 for database

## Implementation Status

✅ Step 1.7 Complete - Checkpoint 2 Passed
- All 4 tools implemented and tested
- SQLite migration successful
- Ready for Step 1.8 (Weather Server)

See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for detailed verification results.
