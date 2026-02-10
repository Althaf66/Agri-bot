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

  // Tool 1: get_farmer_profile
  server.registerTool(
  'get_farmer_profile',
  {
    description: 'Returns full farmer profile with current crop phase context and active agents list',
    inputSchema: z.object({
      farmer_id: z.string().describe('The unique ID of the farmer (e.g., F001)')
    })
  },
  async (args: { farmer_id: string }) => {
    const profile = queries.getFarmerProfile(args.farmer_id);

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
    description: 'Transitions a farmer\'s crop to the next phase and returns new active agents',
    inputSchema: z.object({
      farmer_id: z.string().describe('The farmer ID'),
      crop_name: z.string().describe('The crop name (e.g., Rice, Tomato)')
    })
  },
  async (args: { farmer_id: string; crop_name: string }) => {
    const result = queries.updateCropPhase(args.farmer_id, args.crop_name);

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
