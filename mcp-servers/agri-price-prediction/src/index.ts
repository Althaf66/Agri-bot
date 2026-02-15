#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import {
  predictWPIIndex,
  applyWPIChangeToPrice,
  calculateStorageCost,
  WPIPrediction
} from './prediction-algorithm.js';
import {
  fetchMOSPIWPIData,
  fetchWeatherRisk,
  getSupportedCrops
} from './mospi-client.js';

// HTTP server configuration
const MCP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3008;

// Factory function to create a new MCP server instance for each connection
function createServer(): McpServer {
  const server = new McpServer(
    { name: 'agri-price-prediction', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Tool 1: predict_wpi_index
  server.registerTool(
    'predict_wpi_index',
    {
      description: 'Predicts future Wholesale Price Index (WPI) for a crop based on NSO India historical data. Uses 90-day linear regression to forecast WPI trends.',
      inputSchema: z.object({
        crop: z.string().describe(`Crop name (lowercase). Supported: ${getSupportedCrops().join(', ')}`),
        days_ahead: z.enum(['7', '14', '30']).transform(Number).or(z.number().refine(n => [7, 14, 30].includes(n)))
          .describe('Number of days to predict ahead (7, 14, or 30)')
      })
    },
    async (args) => {
      try {
        const { crop, days_ahead } = args;

        // Fetch 90 days of historical WPI data
        const historicalWPI = await fetchMOSPIWPIData(crop, 90);

        // Run prediction algorithm
        const prediction: WPIPrediction = predictWPIIndex(historicalWPI, days_ahead as number);

        const result = {
          crop,
          days_ahead,
          current_wpi: prediction.currentWPI,
          predicted_wpi: prediction.predictedWPI,
          percent_change: prediction.percentChange,
          confidence_score: prediction.confidence,
          trend_direction: prediction.trendDirection,
          variance: prediction.variance,
          data_source: 'NSO India (MOSPI) Wholesale Price Index',
          note: 'Prediction based on 90-day linear regression of national WPI data'
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        console.error('Error in predict_wpi_index:', error);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: true,
              message: error.message || 'Failed to predict WPI index',
              supported_crops: getSupportedCrops()
            }, null, 2)
          }]
        };
      }
    }
  );

  // Tool 2: analyze_profit_scenarios
  server.registerTool(
    'analyze_profit_scenarios',
    {
      description: 'Analyzes profit for 3 scenarios: sell now, wait 7 days, wait 14 days. Combines WPI predictions, storage costs, and weather risk to provide actionable recommendations.',
      inputSchema: z.object({
        crop: z.string().describe(`Crop name (lowercase). Supported: ${getSupportedCrops().join(', ')}`),
        quantity_quintals: z.number().describe('Quantity to sell in quintals (1 quintal = 100 kg)'),
        current_market_price: z.number().describe('Current market price in ₹ per quintal')
      })
    },
    async (args) => {
      try {
        const { crop, quantity_quintals, current_market_price } = args;

        // Get WPI predictions for 7-day and 14-day
        const historicalWPI = await fetchMOSPIWPIData(crop, 90);
        const wpi7Day = predictWPIIndex(historicalWPI, 7);
        const wpi14Day = predictWPIIndex(historicalWPI, 14);

        // Convert WPI % change to absolute price predictions
        const predicted7DayPrice = applyWPIChangeToPrice(current_market_price, wpi7Day.percentChange);
        const predicted14DayPrice = applyWPIChangeToPrice(current_market_price, wpi14Day.percentChange);

        // Get weather risk
        const weatherRisk = await fetchWeatherRisk(14);

        // Calculate storage costs
        const storage7Day = calculateStorageCost(crop, 7, quantity_quintals);
        const storage14Day = calculateStorageCost(crop, 14, quantity_quintals);

        // Scenario 1: Sell now
        const sellNow = {
          action: "Sell immediately at current price",
          price_per_quintal: current_market_price,
          revenue: current_market_price * quantity_quintals,
          costs: 0,
          net_profit: current_market_price * quantity_quintals,
          risk: "None",
          confidence: "CERTAIN"
        };

        // Scenario 2: Wait 7 days
        const wait7Days = {
          action: `Wait 7 days (WPI forecast: ${wpi7Day.trendDirection})`,
          price_per_quintal: predicted7DayPrice,
          revenue: predicted7DayPrice * quantity_quintals,
          costs: storage7Day.totalCost,
          net_profit: (predicted7DayPrice * quantity_quintals) - storage7Day.totalCost,
          profit_vs_now: (predicted7DayPrice - current_market_price) * quantity_quintals - storage7Day.totalCost,
          risk: weatherRisk.riskLevel === 'LOW' ? 'Low weather risk' : `${weatherRisk.riskLevel} weather risk`,
          confidence: wpi7Day.confidence,
          wpi_change_percent: wpi7Day.percentChange
        };

        // Scenario 3: Wait 14 days
        const wait14Days = {
          action: `Wait 14 days (WPI forecast: ${wpi14Day.trendDirection})`,
          price_per_quintal: predicted14DayPrice,
          revenue: predicted14DayPrice * quantity_quintals,
          costs: storage14Day.totalCost,
          net_profit: (predicted14DayPrice * quantity_quintals) - storage14Day.totalCost,
          profit_vs_now: (predicted14DayPrice - current_market_price) * quantity_quintals - storage14Day.totalCost,
          risk: `${weatherRisk.riskLevel} weather risk + longer market uncertainty`,
          confidence: wpi14Day.confidence,
          wpi_change_percent: wpi14Day.percentChange
        };

        // Determine recommendation (highest net profit with acceptable confidence)
        const scenarios = [sellNow, wait7Days, wait14Days];
        const viableScenarios = scenarios.filter(s => s.confidence !== 'LOW');
        const recommended = viableScenarios.reduce((best, curr) =>
          curr.net_profit > best.net_profit ? curr : best
        );

        const result = {
          crop,
          quantity_quintals,
          current_market_price,
          scenarios: [sellNow, wait7Days, wait14Days],
          recommendation: recommended.action,
          weather_forecast: weatherRisk.description,
          wpi_source: 'NSO India (MOSPI)',
          note: 'Prices predicted using national WPI trends. Local mandi prices may vary ±5-10%.'
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        console.error('Error in analyze_profit_scenarios:', error);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: true,
              message: error.message || 'Failed to analyze profit scenarios'
            }, null, 2)
          }]
        };
      }
    }
  );

  // Tool 3: calculate_storage_costs
  server.registerTool(
    'calculate_storage_costs',
    {
      description: 'Calculates storage costs for storing crops. Standard rate: ₹50/quintal/week.',
      inputSchema: z.object({
        crop: z.string().describe('Crop name'),
        days: z.number().describe('Number of days to store'),
        quantity_quintals: z.number().describe('Quantity to store in quintals')
      })
    },
    async (args) => {
      try {
        const { crop, days, quantity_quintals } = args;

        const result = calculateStorageCost(crop, days, quantity_quintals);

        const output = {
          crop,
          days,
          quantity_quintals,
          total_cost: result.totalCost,
          rate_per_quintal_per_week: result.ratePerQuintalPerWeek,
          duration_weeks: result.durationWeeks,
          breakdown: result.breakdown,
          note: 'Standard storage rates. Actual costs may vary by facility and location.'
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(output, null, 2)
          }]
        };
      } catch (error: any) {
        console.error('Error in calculate_storage_costs:', error);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: true,
              message: error.message || 'Failed to calculate storage costs'
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
    console.error(`Agri-Price-Prediction MCP server listening on port ${MCP_PORT}`);
    console.error(`Endpoint: http://localhost:${MCP_PORT}/mcp`);
    console.error(`Supported crops: ${getSupportedCrops().join(', ')}`);
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
