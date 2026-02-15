#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createDoctorDatabase } from './db.js';
import { createDoctorQueries } from './queries.js';
import { analyzeCropWithGemini } from './gemini.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', '..', 'agri-core', 'data', 'agribot.db');

// HTTP server configuration
const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3005;

// Initialize database
const database = createDoctorDatabase(dbPath);
database.initialize();
const queries = createDoctorQueries(database.getDatabase());

// Factory function to create server
function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'agri-doctor',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Tool 1: analyze_crop_image (PRIMARY TOOL)
  server.registerTool(
    'analyze_crop_image',
    {
      description: 'Analyzes crop image for disease detection using AI vision. Returns disease name, confidence, symptoms, and treatment recommendations.',
      inputSchema: z.object({
        image_data: z.string().describe('Image as Base64 string or URL'),
        is_base64: z.boolean().default(true).describe('True if image_data is Base64, false if URL'),
        crop_hint: z.string().optional().describe('Optional crop type hint (e.g., "Tomato", "Rice") to improve accuracy'),
        farmer_id: z.string().optional().describe('Optional farmer ID to save diagnosis to history'),
        crop_name: z.string().optional().describe('Crop name for history tracking')
      })
    },
    async (args: {
      image_data: string;
      is_base64: boolean;
      crop_hint?: string | undefined;
      farmer_id?: string | undefined;
      crop_name?: string | undefined;
    }) => {
      try {
        // Call Gemini API for diagnosis
        const diagnosis = await analyzeCropWithGemini(
          args.image_data,
          args.is_base64,
          args.crop_hint
        );

        // Optionally save to history
        let diagnosisId: number | undefined;
        let savedToHistory = false;

        if (args.farmer_id && args.crop_name) {
          try {
            diagnosisId = queries.saveDiagnosis(
              args.farmer_id,
              args.crop_name,
              diagnosis.disease_name,
              diagnosis.confidence,
              diagnosis.symptoms_observed,
              diagnosis.treatment_recommendation,
              args.is_base64 ? undefined : args.image_data
            );
            savedToHistory = true;
          } catch (error) {
            console.error('Failed to save diagnosis to history:', error);
          }
        }

        // A2A Communication: If severity is HIGH/critical, auto-check insurance via agri-finance
        let insuranceInfo = null;
        if (
          args.farmer_id &&
          diagnosis.severity &&
          ['HIGH', 'critical', 'severe'].some(s =>
            String(diagnosis.severity || '').toLowerCase().includes(s.toLowerCase()) ||
            String(diagnosis.confidence || '').toLowerCase().includes('high')
          )
        ) {
          try {
            console.error(`[A2A] HIGH severity diagnosis for ${args.farmer_id} — checking insurance via agri-finance`);
            const financeUrl = process.env.FINANCE_URL || 'http://localhost:3006/mcp';

            // Initialize session with agri-finance
            const initRes = await fetch(financeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'initialize',
                params: {
                  protocolVersion: '2024-11-05',
                  capabilities: {},
                  clientInfo: { name: 'agri-doctor-a2a', version: '1.0.0' }
                },
                id: 1
              })
            });

            const initData = await initRes.json();
            const financeSessionId = initRes.headers.get('mcp-session-id');

            if (financeSessionId && !initData.error) {
              // Call get_insurance_info
              const insRes = await fetch(financeUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json, text/event-stream',
                  'mcp-session-id': financeSessionId
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'tools/call',
                  params: {
                    name: 'get_insurance_info',
                    arguments: { identifier: args.farmer_id }
                  },
                  id: 2
                })
              });

              const insData = await insRes.json();
              if (insData.result?.content?.[0]?.text) {
                insuranceInfo = JSON.parse(insData.result.content[0].text);
                console.error(`[A2A] Insurance info retrieved for ${args.farmer_id}`);
              }
            }
          } catch (a2aError) {
            console.error('[A2A] Failed to reach agri-finance (graceful degradation):', a2aError);
            // Graceful degradation: return diagnosis without insurance info
          }
        }

        const result: Record<string, any> = {
          diagnosis,
          saved_to_history: savedToHistory,
          diagnosis_id: diagnosisId
        };

        if (insuranceInfo) {
          result.a2a_insurance = {
            source: 'agri-finance (auto-checked via A2A)',
            data: insuranceInfo,
            note: 'Insurance information automatically retrieved due to HIGH severity diagnosis.'
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2)
          }]
        };

      } catch (error) {
        console.error('Error in analyze_crop_image:', error);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Failed to analyze crop image',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );

  // Tool 2: get_treatment_details
  server.registerTool(
    'get_treatment_details',
    {
      description: 'Returns detailed treatment protocol for a specific disease, including organic alternatives and prevention tips.',
      inputSchema: z.object({
        disease_name: z.string().describe('Disease name (e.g., "Tomato Late Blight")')
      })
    },
    async (args: { disease_name: string }) => {
      const result = queries.getTreatmentDetails(args.disease_name);

      if (!result) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Treatment not found',
              disease_searched: args.disease_name,
              suggestion: 'Try searching with a more specific disease name or check the diagnosis result'
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  // Tool 3: get_diagnosis_history
  server.registerTool(
    'get_diagnosis_history',
    {
      description: 'Returns diagnosis history for a farmer, useful for tracking recurring diseases and crop health patterns.',
      inputSchema: z.object({
        farmer_id: z.string().describe('Farmer ID'),
        limit: z.number().optional().default(10).describe('Number of records to return (default: 10)')
      })
    },
    async (args: { farmer_id: string; limit?: number }) => {
      const history = queries.getDiagnosisHistory(args.farmer_id, args.limit);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            farmer_id: args.farmer_id,
            total_records: history.length,
            history
          }, null, 2)
        }]
      };
    }
  );

  return server;
}

// Session management (same pattern as other servers)
const sessions: Record<string, { transport: StreamableHTTPServerTransport; server: McpServer }> = {};

function isInitializeRequest(body: any): boolean {
  return body && body.method === 'initialize';
}

// Start HTTP server (same pattern as other servers)
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
    console.error(`Agri-Doctor MCP server listening on port ${MCP_PORT}`);
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
