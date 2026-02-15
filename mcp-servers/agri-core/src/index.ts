#!/usr/bin/env node

// AgriBot Core MCP Server - Step 1.7 Implementation

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createAgribotDatabase } from './db.js';
import { createAgribotQueries } from './queries.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'data', 'agribot.db');

// HTTP server configuration
const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3002;

// Initialize database
const database = createAgribotDatabase(dbPath);
database.initialize();
const queries = createAgribotQueries(database.getDatabase());

// Factory function to create a new MCP server instance for each connection
function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'agri-core',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Get direct database access for insert operations
  const db = database.getDatabase();

  // Tool 1: get_farmer_profile
  server.registerTool(
  'get_farmer_profile',
  {
    description: 'Returns full farmer profile with current crop phase context and active agents list. Accepts either farmer ID (e.g., F001) or farmer name (e.g., Ramesh Patil)',
    inputSchema: z.object({
      identifier: z.string().describe('Farmer ID (e.g., F001) or farmer name (e.g., "Ramesh Patil")')
    })
  },
  async (args: { identifier: string }) => {
    const profile = queries.getFarmerProfile(args.identifier);

    if (!profile) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Farmer not found' }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(profile, null, 2)
      }]
    };
  }
);

// Tool 2: get_crop_lifecycle
server.registerTool(
  'get_crop_lifecycle',
  {
    description: 'Returns crop phase details including tools_activated and context_prompt',
    inputSchema: z.object({
      phase_key: z.string().describe('The crop phase key (e.g., pre_sowing, growing, harvest)')
    })
  },
  async (args: { phase_key: string }) => {
    const phase = queries.getCropPhaseDetails(args.phase_key);

    if (!phase) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Phase not found' }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(phase, null, 2)
      }]
    };
  }
);

// Tool 3: update_crop_phase
server.registerTool(
  'update_crop_phase',
  {
    description: 'Transitions a farmer\'s crop to the next phase and returns new active agents. Accepts either farmer ID or farmer name',
    inputSchema: z.object({
      identifier: z.string().describe('Farmer ID (e.g., F001) or farmer name (e.g., "Ramesh Patil")'),
      crop_name: z.string().describe('The crop name (e.g., Rice, Tomato)')
    })
  },
  async (args: { identifier: string; crop_name: string }) => {
    const result = queries.updateCropPhase(args.identifier, args.crop_name);

    if (!result) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Crop not found or no next phase available'
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
);

// Tool 4: list_farmers
server.registerTool(
  'list_farmers',
  {
    description: 'Returns all farmers, optionally filtered by district (for officer role)',
    inputSchema: z.object({
      district: z.string().optional().describe('Optional district filter (e.g., Dharwad)')
    })
  },
  async (args: { district?: string | undefined }) => {
    const farmers = queries.listFarmers(args.district);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          count: farmers.length,
          farmers
        }, null, 2)
      }]
    };
  }
);

// Tool 5: check_proactive_alerts (PROACTIVE MONITORING)
server.registerTool(
  'check_proactive_alerts',
  {
    description: 'Check for pending proactive alerts for a farmer (weather, price spikes, scheme deadlines). Accepts either farmer ID or farmer name',
    inputSchema: z.object({
      identifier: z.string().describe('Farmer ID (e.g., F001) or farmer name (e.g., "Ramesh Patil")')
    })
  },
  async (args: { identifier: string }) => {
    try {
      const farmer = queries.getFarmerProfile(args.identifier);
      if (!farmer) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'Farmer not found', identifier: args.identifier })
          }]
        };
      }

      const alerts: Array<{
        type: 'WEATHER' | 'PRICE_SPIKE' | 'SCHEME_DEADLINE';
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
        message: string;
        advice: string;
        action_by?: string;
      }> = [];

      // 1. Weather Alert Check (HIGH PRIORITY)
      // Mock data for demonstration - in production, would call agri-weather server
      const weatherAlerts: Record<string, { severity: string; message: string; advice: string }> = {
        'Dharwad': {
          severity: 'ORANGE',
          message: 'Heavy rainfall warning: 50-80mm expected in next 48 hours',
          advice: 'Delay fertilizer application. Ensure field drainage. Harvest mature crops immediately.'
        },
        'Belgaum': {
          severity: 'RED',
          message: 'Very heavy rainfall alert: >100mm expected. Flooding risk.',
          advice: 'Urgent: Move harvested produce to covered storage. Check field drainage. Delay all field operations.'
        }
      };

      const districtAlert = weatherAlerts[farmer.location.district];
      if (districtAlert) {
        alerts.push({
          type: 'WEATHER',
          priority: districtAlert.severity === 'RED' ? 'HIGH' : 'MEDIUM',
          message: `⚠️  ${districtAlert.severity} WEATHER ALERT: ${districtAlert.message}`,
          advice: districtAlert.advice,
          action_by: 'Next 48 hours'
        });
      }

      // 2. Price Spike Alert (MEDIUM PRIORITY)
      // Check if farmer's crop has significant price increase
      if (farmer.crops && farmer.crops.length > 0 && farmer.crops[0]) {
        const cropName = farmer.crops[0].name;

        // Mock price spike data - in production, would call agri-market server
        const priceSpikes: Record<string, { old_price: number; new_price: number; change_percent: number; best_mandi: string }> = {
          'Tomato': {
            old_price: 3200,
            new_price: 4200,
            change_percent: 31,
            best_mandi: 'Hubli APMC'
          },
          'Maize': {
            old_price: 1800,
            new_price: 2400,
            change_percent: 33,
            best_mandi: 'Gadag APMC'
          }
        };

        const priceSpike = priceSpikes[cropName];
        if (priceSpike && farmer.crops[0]) {
          const currentPhase = farmer.crops[0].phase;

          // Only alert if in harvest or post_harvest phase
          if (currentPhase === 'harvest' || currentPhase === 'post_harvest') {
            alerts.push({
              type: 'PRICE_SPIKE',
              priority: 'MEDIUM',
              message: `📈 PRICE SPIKE: ${cropName} prices up ${priceSpike.change_percent}% to ₹${priceSpike.new_price}/qtl`,
              advice: `Best mandi: ${priceSpike.best_mandi}. Consider selling immediately. Transport cost: ₹800. Net gain: ₹${(priceSpike.new_price - priceSpike.old_price) * 10 - 800} more than last week.`,
              action_by: 'Within 3-5 days (before price drops)'
            });
          }
        }
      }

      // 3. Scheme Deadline Alerts (MEDIUM PRIORITY)
      const currentDate = new Date('2026-02-11'); // Mock current date

      // PM Fasal Bima Yojana enrollment deadline (7 days after sowing)
      if (farmer.crops && farmer.crops.length > 0 && farmer.crops[0]) {
        const crop = farmer.crops[0];
        const currentPhase = crop?.phase;

        // Alert if in sowing or early growing phase and not enrolled
        if (currentPhase === 'sowing' || currentPhase === 'growing') {
          alerts.push({
            type: 'SCHEME_DEADLINE',
            priority: 'MEDIUM',
            message: '📋 PM Fasal Bima Yojana (Crop Insurance) enrollment deadline approaching',
            advice: 'Enroll within 7 days of sowing to get subsidized crop insurance. Premium: 2% of sum insured. Visit nearest bank or CSC.',
            action_by: 'Within 7 days of sowing'
          });
        }
      }

      // PM-KISAN payment cycle reminder
      alerts.push({
        type: 'SCHEME_DEADLINE',
        priority: 'LOW',
        message: '💰 PM-KISAN Q2 2026 payment scheduled',
        advice: 'Next installment (₹2,000) scheduled for August 1, 2026. Ensure bank account and Aadhaar are linked. Check eligibility if not enrolled.',
        action_by: 'August 1, 2026'
      });

      // Sort alerts by priority
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      const result = {
        farmer_id: farmer.id,
        farmer_name: farmer.name,
        location: farmer.location.district,
        crop: farmer.crops && farmer.crops.length > 0 && farmer.crops[0] ? farmer.crops[0].name : 'N/A',
        current_phase: farmer.crops && farmer.crops.length > 0 && farmer.crops[0] ? farmer.crops[0].phase : 'N/A',
        pending_alerts: alerts.length,
        alerts
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: String(error), identifier: args.identifier })
        }]
      };
    }
  }
);

// Tool 6: register_farmer (NEW - for farmer registration)
server.registerTool(
  'register_farmer',
  {
    description: 'Register a new farmer with all required information',
    inputSchema: z.object({
      name: z.string().describe('Full name of farmer (must be unique)'),
      city: z.string().describe('City/town name'),
      crop_name: z.string().describe('Primary crop being cultivated'),
      crop_variety: z.string().optional().describe('Crop variety (optional)'),
      crop_phase: z.enum(['pre_sowing', 'sowing', 'growing', 'pest_watch', 'harvest', 'post_harvest']),
      land_acres: z.number().positive().describe('Land size in acres'),
      income_category: z.enum(['marginal_farmer', 'small_farmer', 'medium_farmer', 'large_farmer']),
      bank_account: z.boolean().describe('Has bank account linked to Aadhaar?'),
      aadhaar_linked: z.boolean(),
      phone: z.string().optional(),
      password: z.string().min(6).describe('Password for login (will be hashed)')
    })
  },
  async (args: any) => {
    try {
      // 1. Check if name is unique
      const existing = db.prepare('SELECT f.id FROM farmers f JOIN users u ON f.id = u.id WHERE u.name = ?').get(args.name) as { id: string } | undefined;
      if (existing) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Farmer with this name already exists',
              suggestion: 'Please use a unique name or add middle name/village'
            })
          }]
        };
      }

      // 2. Get lat/lon from city
      const coords = db.prepare(
        'SELECT latitude, longitude, district, state FROM city_coordinates WHERE city_name = ?'
      ).get(args.city) as { latitude: number; longitude: number; district: string; state: string } | undefined;

      if (!coords) {
        const availableCities = db.prepare('SELECT city_name FROM city_coordinates ORDER BY city_name').all() as { city_name: string }[];
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'City not found',
              available_cities: availableCities.map(c => c.city_name)
            })
          }]
        };
      }

      // 3. Generate next farmer ID (F006, F007, ...)
      const maxIdRow = db.prepare('SELECT MAX(CAST(SUBSTR(id, 2) AS INTEGER)) as max_num FROM farmers').get() as { max_num: number | null } | undefined;
      const nextNum = ((maxIdRow?.max_num || 0) || 5) + 1;
      const farmerId = `F${String(nextNum).padStart(3, '0')}`;

      // 4. Start transaction
      const transaction = db.transaction(() => {
        // Insert location
        const locationResult = db.prepare(`
          INSERT INTO locations (district, state, lat, lon)
          VALUES (?, ?, ?, ?)
        `).run(coords.district, coords.state, coords.latitude, coords.longitude);

        // Insert user
        db.prepare(`
          INSERT INTO users (id, name, role)
          VALUES (?, ?, ?)
        `).run(farmerId, args.name, 'farmer');

        // Insert farmer
        db.prepare(`
          INSERT INTO farmers (id, location_id, land_acres, income_category, bank_account, aadhaar_linked, phone, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          farmerId,
          locationResult.lastInsertRowid,
          args.land_acres,
          args.income_category,
          args.bank_account ? 1 : 0,
          args.aadhaar_linked ? 1 : 0,
          args.phone || null
        );

        // Hash password and store
        const passwordHash = bcrypt.hashSync(args.password, 10);
        db.prepare('INSERT INTO farmer_credentials (farmer_id, password_hash) VALUES (?, ?)')
          .run(farmerId, passwordHash);

        // Add crop
        const cropType = db.prepare('SELECT id FROM crop_types WHERE name = ?').get(args.crop_name) as { id: number } | undefined;

        let cropTypeId: number;
        if (!cropType) {
          // Insert new crop type if it doesn't exist
          const cropTypeResult = db.prepare('INSERT INTO crop_types (name) VALUES (?)').run(args.crop_name);
          cropTypeId = cropTypeResult.lastInsertRowid as number;
        } else {
          cropTypeId = cropType.id;
        }

        // Insert crop variety
        const variety = args.crop_variety || 'Standard';
        const varietyResult = db.prepare(`
          INSERT INTO crop_varieties (crop_type_id, name) VALUES (?, ?)
          ON CONFLICT(crop_type_id, name) DO UPDATE SET name = name
        `).run(cropTypeId, variety);

        const cropVariety = db.prepare('SELECT id FROM crop_varieties WHERE crop_type_id = ? AND name = ?')
          .get(cropTypeId, variety) as { id: number } | undefined;

        if (cropVariety) {
          db.prepare(`
            INSERT INTO farmer_crops (farmer_id, crop_variety_id, phase, sown_date)
            VALUES (?, ?, ?, date('now'))
          `).run(farmerId, cropVariety.id, args.crop_phase);
        }
      });

      transaction();

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            farmer_id: farmerId,
            message: `Farmer registered successfully! Your ID is ${farmerId}`,
            login_instructions: `You can login with either your name "${args.name}" or ID "${farmerId}"`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: String(error) })
        }]
      };
    }
  }
);

// Tool 7: login_farmer (NEW - for farmer authentication)
server.registerTool(
  'login_farmer',
  {
    description: 'Authenticate farmer with name/ID and password',
    inputSchema: z.object({
      identifier: z.string().describe('Farmer name or ID (e.g., "Ramesh Patil" or "F001")'),
      password: z.string()
    })
  },
  async (args: { identifier: string; password: string }) => {
    try {
      // 1. Resolve identifier to farmer_id
      const farmerId = queries.resolveFarmerIdentifier(args.identifier);
      if (!farmerId) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'Farmer not found', identifier: args.identifier })
          }]
        };
      }

      // 2. Get password hash
      const creds = db.prepare('SELECT password_hash FROM farmer_credentials WHERE farmer_id = ?')
        .get(farmerId) as { password_hash: string } | undefined;

      if (!creds) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'No credentials found for this farmer',
              note: 'This farmer may have been created before the authentication system was implemented. Please contact support.'
            })
          }]
        };
      }

      // 3. Verify password
      const isValid = bcrypt.compareSync(args.password, creds.password_hash);

      if (!isValid) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: 'Invalid password' })
          }]
        };
      }

      // 4. Update last login
      db.prepare('UPDATE farmer_credentials SET last_login = CURRENT_TIMESTAMP WHERE farmer_id = ?')
        .run(farmerId);

      // 5. Return farmer profile
      const profile = queries.getFarmerProfile(farmerId);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            farmer: profile,
            message: `Welcome back, ${profile?.name}!`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: String(error) })
        }]
      };
    }
  }
);

  return server;
}

// Map to store transports and servers by session ID
const sessions: Record<string, { transport: StreamableHTTPServerTransport; server: McpServer }> = {};

// Helper to check if a request is an initialize request
function isInitializeRequest(body: any): boolean {
  return body && body.method === 'initialize';
}

// Start HTTP server
async function main() {
  const app = createMcpExpressApp({
    allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal', '[::1]']
  });

  // Add CORS middleware to allow frontend access
  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
    res.header('Access-Control-Expose-Headers', 'mcp-session-id');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  });

  // MCP POST endpoint - handles initialization and tool calls
  app.post('/mcp', async (req: any, res: any) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId) {
      console.error(`Received MCP request for session: ${sessionId}`);
    } else {
      console.error('Received new MCP request');
    }

    try {
      if (sessionId && sessions[sessionId]) {
        // Reuse existing transport for this session
        const { transport } = sessions[sessionId];
        await transport.handleRequest(req, res, req.body);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request - create new server and transport
        const server = createServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            console.error(`Session initialized with ID: ${newSessionId}`);
            sessions[newSessionId] = { transport, server };
          },
        });

        // Set up onclose handler to clean up session (must be set before connect)
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && sessions[sid]) {
            console.error(`Transport closed for session ${sid}`);
            delete sessions[sid];
          }
        };

        // Initialize onerror handler as well
        transport.onerror = (error: Error) => {
          console.error('Transport error:', error);
        };

        // Connect the transport to the MCP server before handling the request
        await server.connect(transport as any);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        // Invalid request - no session ID or not initialization request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }
    } catch (error) {
      console.error('Error handling MCP request:');
      console.error(error);
      if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  // MCP GET endpoint - handles SSE streams for notifications
  app.get('/mcp', async (req: any, res: any) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !sessions[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const lastEventId = req.headers['last-event-id'];
    if (lastEventId) {
      console.error(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
      console.error(`Establishing new SSE stream for session ${sessionId}`);
    }

    const { transport } = sessions[sessionId];
    await transport.handleRequest(req, res);
  });

  // MCP DELETE endpoint - handles session termination
  app.delete('/mcp', async (req: any, res: any) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !sessions[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    console.error(`Received session termination request for session ${sessionId}`);

    try {
      const { transport } = sessions[sessionId];
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling session termination:', error);
      if (!res.headersSent) {
        res.status(500).send('Error processing session termination');
      }
    }
  });

  // Start HTTP server
  app.listen(MCP_PORT, () => {
    console.error(`Agri-Core MCP server listening on port ${MCP_PORT}`);
    console.error(`Endpoint: http://localhost:${MCP_PORT}/mcp`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down server...');

    // Close all active sessions
    for (const sessionId in sessions) {
      try {
        const session = sessions[sessionId];
        if (session) {
          console.error(`Closing session ${sessionId}`);
          await session.transport.close();
          delete sessions[sessionId];
        }
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
    }

    console.error('Server shutdown complete');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
