#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createFinanceDatabase } from './db.js';
import { createFinanceQueries } from './queries.js';
import { checkPMKisanEligibility, checkFasalBimaEligibility, checkKCCEligibility } from './eligibility.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', '..', 'agri-core', 'data', 'agribot.db');

// Load schemes data
const schemesPath = join(__dirname, '..', 'data', 'schemes.json');
const schemes = JSON.parse(readFileSync(schemesPath, 'utf-8'));

// HTTP server configuration
const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3006;

// Initialize database
const database = createFinanceDatabase(dbPath);
database.initialize();
const queries = createFinanceQueries(database.getDatabase());

// Factory function to create server
function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'agri-finance',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // TOOL 1: check_scheme_eligibility (PRIMARY TOOL)
  server.registerTool(
    'check_scheme_eligibility',
    {
      description: 'Checks farmer eligibility for Indian agricultural schemes (PM-KISAN, PM Fasal Bima Yojana, Kisan Credit Card) with real criteria. Returns eligibility status, score, detailed factors, and enrollment steps.',
      inputSchema: z.object({
        farmer_id: z.string().describe('Farmer ID (e.g., F001)'),
        scheme_name: z.enum(['PM-KISAN', 'PM Fasal Bima Yojana', 'Kisan Credit Card']).describe('Scheme name to check'),
        crop_name: z.string().optional().describe('Crop name (required for insurance/loan schemes)')
      })
    },
    async (args: {
      farmer_id: string;
      scheme_name: 'PM-KISAN' | 'PM Fasal Bima Yojana' | 'Kisan Credit Card';
      crop_name?: string | undefined;
    }) => {
      try {
        const farmerData = queries.getFarmerData(args.farmer_id);

        if (!farmerData) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                error: 'Farmer not found',
                farmer_id: args.farmer_id
              }, null, 2)
            }]
          };
        }

        let result;

        if (args.scheme_name === 'PM-KISAN') {
          result = checkPMKisanEligibility(farmerData, schemes);
        } else if (args.scheme_name === 'PM Fasal Bima Yojana') {
          if (!args.crop_name) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  error: 'crop_name is required for insurance eligibility check',
                  farmer_id: args.farmer_id
                }, null, 2)
              }]
            };
          }

          const weatherRisk = queries.getWeatherRisk(farmerData.location.district);
          const diseaseRisk = queries.getDiseaseRisk(args.farmer_id);

          result = checkFasalBimaEligibility(
            farmerData,
            args.crop_name,
            schemes,
            weatherRisk,
            diseaseRisk
          );
        } else if (args.scheme_name === 'Kisan Credit Card') {
          if (!args.crop_name) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  error: 'crop_name is required for KCC eligibility check',
                  farmer_id: args.farmer_id
                }, null, 2)
              }]
            };
          }

          const marketPrice = queries.getMarketPrice(args.crop_name);

          result = checkKCCEligibility(
            farmerData,
            args.crop_name,
            schemes,
            marketPrice
          );
        }

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
            text: JSON.stringify({
              error: String(error),
              farmer_id: args.farmer_id
            }, null, 2)
          }]
        };
      }
    }
  );

  // TOOL 2: get_payment_status (PAYMENT TRACKING)
  server.registerTool(
    'get_payment_status',
    {
      description: 'Returns payment status for enrolled schemes with real disbursement schedules. Shows payment history, total received, and next scheduled payment.',
      inputSchema: z.object({
        farmer_id: z.string().describe('Farmer ID'),
        scheme_name: z.string().optional().describe('Filter by scheme name (optional, default: all schemes)')
      })
    },
    async (args: { farmer_id: string; scheme_name?: string | undefined }) => {
      try {
        const paymentStatus = queries.getPaymentStatus(args.farmer_id, args.scheme_name);

        if (paymentStatus.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                farmer_id: args.farmer_id,
                message: 'No enrolled schemes found or no payment history available',
                schemes: []
              }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              farmer_id: args.farmer_id,
              total_schemes: paymentStatus.length,
              payment_status: paymentStatus
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: String(error),
              farmer_id: args.farmer_id
            }, null, 2)
          }]
        };
      }
    }
  );

  // TOOL 3: get_insurance_info (INSURANCE MANAGEMENT)
  server.registerTool(
    'get_insurance_info',
    {
      description: 'Returns insurance policies, claims, and auto-detects claim eligibility from weather/disease alerts. Shows active coverage, premium paid, and recommended actions.',
      inputSchema: z.object({
        farmer_id: z.string().describe('Farmer ID')
      })
    },
    async (args: { farmer_id: string }) => {
      try {
        const insuranceInfo = queries.getInsuranceInfo(args.farmer_id);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(insuranceInfo, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: String(error),
              farmer_id: args.farmer_id
            }, null, 2)
          }]
        };
      }
    }
  );

  return server;
}

// Session management (same pattern as other servers)
const sessions: Record<string, { transport: StreamableHTTPServerTransport; server: McpServer }> = {};

function isInitializeRequest(body: any): boolean {
  return body && body.method === 'initialize';
}

// Start HTTP server
async function main() {
  const app = createMcpExpressApp({
    allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal', '[::1]']
  });

  app.post('/mcp', async (req: any, res: any) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      if (sessionId && sessions[sessionId]) {
        const { transport } = sessions[sessionId];
        await transport.handleRequest(req, res, req.body);
      } else if (!sessionId && isInitializeRequest(req.body)) {
        const server = createServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            sessions[newSessionId] = { transport, server };
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && sessions[sid]) delete sessions[sid];
        };

        transport.onerror = (error: Error) => {
          console.error('Transport error:', error);
        };

        await server.connect(transport as any);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request' },
          id: null,
        });
        return;
      }
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (req: any, res: any) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    const { transport } = sessions[sessionId];
    await transport.handleRequest(req, res);
  });

  app.delete('/mcp', async (req: any, res: any) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    const { transport } = sessions[sessionId];
    await transport.handleRequest(req, res);
  });

  app.listen(MCP_PORT, () => {
    console.error(`Agri-Finance MCP server listening on port ${MCP_PORT}`);
    console.error(`Endpoint: http://localhost:${MCP_PORT}/mcp`);
  });

  process.on('SIGINT', async () => {
    console.error('Shutting down server...');
    for (const sessionId in sessions) {
      try {
        const session = sessions[sessionId];
        if (session) {
          await session.transport.close();
          delete sessions[sessionId];
        }
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
