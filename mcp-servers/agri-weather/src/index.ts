#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fetchOpenMeteoForecast, getAlertsFromDB, getSoilMoistureFromDB } from './weather.js';
import { initializeWeatherTables } from './db.js';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// HTTP server configuration
const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3003;

// Connect to existing agribot.db
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Path to agri-core database (one level up, then into agri-core)
const dbPath = join(__dirname, '..', '..', 'agri-core', 'data', 'agribot.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize weather tables if needed
initializeWeatherTables(db);

// Factory function to create a new MCP server instance for each connection
function createServer(): McpServer {
  const server = new McpServer(
    { name: 'agri-weather', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Tool 1: get_forecast
  server.registerTool(
    'get_forecast',
    {
      description: 'Get 7-day weather forecast with rainfall analysis and irrigation recommendations',
      inputSchema: z.object({
        latitude: z.number().describe('Location latitude'),
        longitude: z.number().describe('Location longitude')
      })
    },
    async (args) => {
      try {
        const forecast = await fetchOpenMeteoForecast(args.latitude, args.longitude);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(forecast, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in get_forecast:', error);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Failed to fetch weather forecast',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );

  // Tool 2: get_alerts
  server.registerTool(
    'get_alerts',
    {
      description: 'Get active weather alerts for a district (IMD advisories)',
      inputSchema: z.object({
        district: z.string().describe('District name (e.g., Dharwad, Belgaum)')
      })
    },
    async (args) => {
      try {
        const alerts = getAlertsFromDB(db, args.district);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(alerts, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in get_alerts:', error);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Failed to fetch weather alerts',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );

  // Tool 3: get_soil_moisture
  server.registerTool(
    'get_soil_moisture',
    {
      description: 'Get soil moisture reading with irrigation recommendations based on crop type',
      inputSchema: z.object({
        latitude: z.number().describe('Sensor location latitude'),
        longitude: z.number().describe('Sensor location longitude'),
        crop_type: z.string().optional().describe('Crop type (Rice, Wheat, Tomato, Maize, Cotton)')
      })
    },
    async (args) => {
      try {
        const moisture = getSoilMoistureFromDB(
          db,
          args.latitude,
          args.longitude,
          args.crop_type
        );

        if (!moisture) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: 'No soil moisture sensor found within 1km of this location',
                suggestion: 'Try a location near: Dharwad (15.46, 75.01), Belgaum (15.85, 74.50), or Hubli (15.36, 75.12)'
              }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(moisture, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in get_soil_moisture:', error);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Failed to fetch soil moisture data',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
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

// Start server
async function main() {
  const app = createMcpExpressApp({
    allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal', '[::1]']
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

        // Set up onclose handler to clean up session
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && sessions[sid]) {
            console.error(`Transport closed for session ${sid}`);
            delete sessions[sid];
          }
        };

        // Initialize onerror handler
        transport.onerror = (error: Error) => {
          console.error('Transport error:', error);
        };

        // Connect the transport to the MCP server before handling the request
        await server.connect(transport as any);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        // Invalid request
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
    console.error(`Agri-Weather MCP server listening on port ${MCP_PORT}`);
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
