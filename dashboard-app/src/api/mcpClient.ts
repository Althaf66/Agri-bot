// MCP Client for communicating with AgriBot backend servers

export interface MCPResponse {
  success?: boolean;
  error?: string;
  [key: string]: any;
}

class MCPClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private weatherUrl: string;
  private marketUrl: string;
  private doctorUrl: string;
  private financeUrl: string;
  private priceUrl: string;
  private mospiUrl: string;
  private weatherSessionId: string | null = null;
  private marketSessionId: string | null = null;
  private priceSessionId: string | null = null;
  private mospiSessionId: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3002/mcp') {
    this.baseUrl = baseUrl;
    this.weatherUrl = 'http://localhost:3003/mcp';
    this.marketUrl = 'http://localhost:3004/mcp';
    this.doctorUrl = 'http://localhost:3005/mcp';
    this.financeUrl = 'http://localhost:3006/mcp';
    this.priceUrl = 'http://localhost:3008/mcp';
    this.mospiUrl = 'https://mcp.mospi.gov.in';
  }

  /**
   * Parse SSE (Server-Sent Events) response
   */
  private async parseSSEResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';

    // If it's JSON, parse as JSON
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    // If it's SSE, parse the SSE format
    if (contentType.includes('text/event-stream')) {
      const text = await response.text();

      // Parse SSE format: "event: message\ndata: {...}\n\n"
      const lines = text.split('\n');
      let jsonData = '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          jsonData = line.substring(6); // Remove "data: " prefix
          break;
        }
      }

      if (jsonData) {
        return JSON.parse(jsonData);
      }

      throw new Error('No data found in SSE response');
    }

    // Fallback: try to parse as JSON
    return await response.json();
  }

  /**
   * Initialize MCP session for a given server URL
   */
  private async initializeSession(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'AgriBot Dashboard',
              version: '1.0.0'
            }
          },
          id: 1
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await this.parseSSEResponse(response);

      if (data.error) {
        throw new Error(data.error.message || 'Failed to initialize MCP session');
      }

      const sessionIdHeader = response.headers.get('mcp-session-id');
      return sessionIdHeader || '';
    } catch (error) {
      console.error('MCP initialization error:', error);
      throw error;
    }
  }

  /**
   * Initialize MCP session
   */
  async initialize(): Promise<string> {
    if (this.sessionId) {
      return this.sessionId;
    }

    this.sessionId = await this.initializeSession(this.baseUrl);
    return this.sessionId;
  }

  /**
   * Call an MCP tool on a specific server
   */
  private async callToolOnServer(
    url: string,
    sessionId: string | null,
    toolName: string,
    args: Record<string, any>
  ): Promise<{ result: MCPResponse; newSessionId: string | null }> {
    let sid = sessionId;
    if (!sid) {
      sid = await this.initializeSession(url);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'mcp-session-id': sid || ''
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          },
          id: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await this.parseSSEResponse(response);

      if (data.error) {
        return {
          result: { success: false, error: data.error.message || 'Tool call failed' },
          newSessionId: sid
        };
      }

      if (data.result?.content?.[0]?.text) {
        try {
          const result = JSON.parse(data.result.content[0].text);
          return { result, newSessionId: sid };
        } catch {
          return {
            result: { success: false, error: 'Failed to parse response' },
            newSessionId: sid
          };
        }
      }

      return {
        result: { success: false, error: 'Invalid response format' },
        newSessionId: sid
      };
    } catch (error) {
      console.error('MCP tool call error:', error);
      return {
        result: { success: false, error: String(error) },
        newSessionId: sid
      };
    }
  }

  /**
   * Call an MCP tool (on agri-core by default)
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<MCPResponse> {
    if (!this.sessionId) {
      await this.initialize();
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'mcp-session-id': this.sessionId || ''
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          },
          id: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await this.parseSSEResponse(response);

      if (data.error) {
        return {
          success: false,
          error: data.error.message || 'Tool call failed'
        };
      }

      // Parse the result content
      if (data.result?.content?.[0]?.text) {
        try {
          const result = JSON.parse(data.result.content[0].text);
          return result;
        } catch (e) {
          return {
            success: false,
            error: 'Failed to parse response'
          };
        }
      }

      return {
        success: false,
        error: 'Invalid response format'
      };
    } catch (error) {
      console.error('MCP tool call error:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Get farmer profile (accepts ID or name)
   */
  async getFarmerProfile(identifier: string) {
    return this.callTool('get_farmer_profile', { identifier });
  }

  /**
   * Register a new farmer
   */
  async registerFarmer(farmerData: {
    name: string;
    city: string;
    crop_name: string;
    crop_variety?: string;
    crop_phase: string;
    land_acres: number;
    income_category: string;
    bank_account: boolean;
    aadhaar_linked: boolean;
    phone?: string;
    password: string;
  }) {
    return this.callTool('register_farmer', farmerData);
  }

  /**
   * Login a farmer
   */
  async loginFarmer(identifier: string, password: string) {
    return this.callTool('login_farmer', { identifier, password });
  }

  /**
   * Check proactive alerts for a farmer
   */
  async checkProactiveAlerts(identifier: string) {
    return this.callTool('check_proactive_alerts', { identifier });
  }

  /**
   * Update crop phase
   */
  async updateCropPhase(identifier: string, cropName: string) {
    return this.callTool('update_crop_phase', { identifier, crop_name: cropName });
  }

  /**
   * List farmers (optionally filtered by district)
   */
  async listFarmers(district?: string) {
    return this.callTool('list_farmers', { district });
  }

  // ─── Market-specific methods (agri-market server) ───

  /**
   * Get mandi prices for a crop
   */
  async getMandiPrices(cropName: string): Promise<MCPResponse> {
    const { result, newSessionId } = await this.callToolOnServer(
      this.marketUrl, this.marketSessionId, 'get_mandi_prices', { crop_name: cropName }
    );
    this.marketSessionId = newSessionId;
    return result;
  }

  /**
   * Get 7-day price trend for a crop at a specific mandi
   */
  async getPriceTrend(crop: string, mandiId: string): Promise<MCPResponse> {
    const { result, newSessionId } = await this.callToolOnServer(
      this.marketUrl, this.marketSessionId, 'get_price_trend', { crop, mandi_id: mandiId }
    );
    this.marketSessionId = newSessionId;
    return result;
  }

  /**
   * Compare prices across nearby mandis
   */
  async comparePrices(crop: string, lat: number, lon: number, radiusKm?: number): Promise<MCPResponse> {
    const { result, newSessionId } = await this.callToolOnServer(
      this.marketUrl, this.marketSessionId, 'compare_prices',
      { crop, farmer_lat: lat, farmer_lon: lon, radius_km: radiusKm || 100 }
    );
    this.marketSessionId = newSessionId;
    return result;
  }

  // ─── Weather methods (agri-weather server) ───

  /**
   * Get weather alerts for a district
   */
  async getWeatherAlerts(district: string): Promise<MCPResponse> {
    const { result, newSessionId } = await this.callToolOnServer(
      this.weatherUrl, this.weatherSessionId, 'get_alerts', { district }
    );
    this.weatherSessionId = newSessionId;
    return result;
  }

  /**
   * Get 7-day weather forecast from OpenMeteo API
   */
  async getForecast(lat: number, lon: number, days?: number): Promise<MCPResponse> {
    const { result, newSessionId } = await this.callToolOnServer(
      this.weatherUrl, this.weatherSessionId, 'get_forecast',
      { latitude: lat, longitude: lon }
    );
    this.weatherSessionId = newSessionId;
    return result;
  }

  // ─── MOSPI/eSankhyiki methods (Government Statistics) ───

  /**
   * Get WPI (Wholesale Price Index) data from NSO India
   */
  async getWPIData(filters?: Record<string, string>): Promise<MCPResponse> {
    const { result, newSessionId } = await this.callToolOnServer(
      this.mospiUrl, this.mospiSessionId, '4_get_data',
      {
        dataset: 'WPI',
        filters: filters || { limit: '50' }
      }
    );
    this.mospiSessionId = newSessionId;
    return result;
  }

  // ─── Price Prediction methods (agri-price-prediction server) ───

  /**
   * Get WPI prediction for a crop
   */
  async getWPIPrediction(crop: string, daysAhead: 7 | 14 | 30): Promise<MCPResponse> {
    const { result, newSessionId } = await this.callToolOnServer(
      this.priceUrl, this.priceSessionId, 'predict_wpi_index',
      { crop, days_ahead: daysAhead }
    );
    this.priceSessionId = newSessionId;
    return result;
  }

  /**
   * Analyze profit scenarios for selling decisions
   */
  async analyzeProfitScenarios(
    crop: string,
    quantityQuintals: number,
    currentMarketPrice: number
  ): Promise<MCPResponse> {
    const { result, newSessionId } = await this.callToolOnServer(
      this.priceUrl, this.priceSessionId, 'analyze_profit_scenarios',
      { crop, quantity_quintals: quantityQuintals, current_market_price: currentMarketPrice }
    );
    this.priceSessionId = newSessionId;
    return result;
  }

  /**
   * Calculate storage costs
   */
  async calculateStorageCosts(crop: string, days: number, quantityQuintals: number): Promise<MCPResponse> {
    const { result, newSessionId } = await this.callToolOnServer(
      this.priceUrl, this.priceSessionId, 'calculate_storage_costs',
      { crop, days, quantity_quintals: quantityQuintals }
    );
    this.priceSessionId = newSessionId;
    return result;
  }

  // ─── RBAC demonstration methods ───

  /**
   * Attempt to access doctor tools (will be denied for trader role)
   */
  async attemptDoctorAccess(): Promise<MCPResponse> {
    return {
      success: false,
      error: 'RBAC_DENIED',
      message: 'Access Denied: Crop diagnosis tools require Farmer or Officer role. [Archestra RBAC Policy]',
      role: 'trader',
      policy: 'Archestra RBAC v1.0'
    };
  }

  /**
   * Attempt to access finance tools (will be denied for trader role)
   */
  async attemptFinanceAccess(): Promise<MCPResponse> {
    return {
      success: false,
      error: 'RBAC_DENIED',
      message: 'Access Denied: Financial tools require Farmer or Officer role. [Archestra RBAC Policy]',
      role: 'trader',
      policy: 'Archestra RBAC v1.0'
    };
  }
}

// Export a singleton instance
export const mcpClient = new MCPClient();
export default mcpClient;
