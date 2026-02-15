// Metrics Client for fetching Prometheus/observability data

export interface ToolCallMetric {
  tool_name: string;
  server: string;
  total_calls: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number;
}

export interface TokenUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface CostMetric {
  model: string;
  cost_usd: number;
  token_count: number;
}

export interface SecurityEvent {
  verdict: 'safe' | 'suspicious' | 'dangerous';
  count: number;
  server: string;
  tool: string;
  timestamp?: string;
}

export interface RBACEvent {
  role: string;
  tool_name: string;
  denial_count: number;
  last_denied?: string;
}

export interface ObservabilityData {
  summary: {
    total_tool_calls: number;
    avg_response_time_ms: number;
    error_rate_percent: number;
    security_events: number;
    active_sessions: number;
    uptime_hours: number;
  };
  tool_calls: ToolCallMetric[];
  token_usage: TokenUsage[];
  cost: {
    today_usd: number;
    week_usd: number;
    month_usd: number;
    by_model: CostMetric[];
  };
  security: {
    dual_llm_verdicts: SecurityEvent[];
    total_safe: number;
    total_suspicious: number;
    total_dangerous: number;
  };
  rbac: {
    denials: RBACEvent[];
    total_denials: number;
  };
  error_rate_history: Array<{
    timestamp: string;
    rate: number;
  }>;
}

const PROMETHEUS_URL = 'http://localhost:9090';

class MetricsClient {
  private baseUrl: string;

  constructor(prometheusUrl: string = import.meta.env.VITE_PROMETHEUS_URL || 'http://localhost:9090') {
    this.baseUrl = prometheusUrl;
    console.log(`MetricsClient initialized with Prometheus URL: ${this.baseUrl}`);
  }

  /**
   * Query Prometheus via PromQL
   */
  private async queryPrometheus(query: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error(`Prometheus query failed: ${response.status}`);
      const data = await response.json();
      return data.data?.result || [];
    } catch (error) {
      console.error(`Prometheus query failed for: ${query}`, error);
      throw new Error(`Prometheus connection failed. Ensure Prometheus is running at ${this.baseUrl}`);
    }
  }

  /**
   * Get all observability data from Prometheus
   */
  async getObservabilityData(): Promise<ObservabilityData> {
    try {
      // Fetch all metrics in parallel
      const [toolCalls, tokenUsage, costData, securityData, rbacData, errorHistory, activeSessions, uptime] =
        await Promise.all([
          this.getToolCallMetrics(),
          this.getTokenUsage(),
          this.getCostMetrics(),
          this.getSecurityEvents(),
          this.getRBACEvents(),
          this.getErrorRateHistory(),
          this.getActiveSessions(),
          this.getUptimeHours(),
        ]);

      // Calculate summary metrics
      const totalCalls = toolCalls.reduce((sum, t) => sum + t.total_calls, 0);
      const totalErrors = toolCalls.reduce((sum, t) => sum + t.error_count, 0);
      const avgLatency = toolCalls.length > 0
        ? Math.round(toolCalls.reduce((sum, t) => sum + t.avg_latency_ms, 0) / toolCalls.length)
        : 0;

      return {
        summary: {
          total_tool_calls: totalCalls,
          avg_response_time_ms: avgLatency,
          error_rate_percent: totalCalls > 0 ? parseFloat(((totalErrors / totalCalls) * 100).toFixed(2)) : 0,
          security_events: securityData.reduce((sum, e) => sum + e.count, 0),
          active_sessions: activeSessions,
          uptime_hours: uptime,
        },
        tool_calls: toolCalls,
        token_usage: tokenUsage,
        cost: costData,
        security: {
          dual_llm_verdicts: securityData,
          total_safe: securityData.filter(e => e.verdict === 'safe').reduce((s, e) => s + e.count, 0),
          total_suspicious: securityData.filter(e => e.verdict === 'suspicious').reduce((s, e) => s + e.count, 0),
          total_dangerous: securityData.filter(e => e.verdict === 'dangerous').reduce((s, e) => s + e.count, 0),
        },
        rbac: {
          denials: rbacData,
          total_denials: rbacData.reduce((sum, e) => sum + e.denial_count, 0),
        },
        error_rate_history: errorHistory,
      };
    } catch (error) {
      console.error('Failed to fetch observability data:', error);
      throw error; // Propagate to component for error UI
    }
  }

  /**
   * Merge AgriBot tool calls + Archestra MCP tool calls
   */
  private async getToolCallMetrics(): Promise<ToolCallMetric[]> {
    try {
      const [agribotCalls, archestraCalls, latencies] = await Promise.all([
        this.queryPrometheus('sum by (tool_name, server, status) (agribot_tool_calls_total)'),
        this.queryPrometheus('sum by (tool_name, server) (mcp_tool_calls_total)'),
        this.queryPrometheus(
          'sum by (tool_name, server) (rate(mcp_tool_call_duration_seconds_sum[5m])) / ' +
          'sum by (tool_name, server) (rate(mcp_tool_call_duration_seconds_count[5m]))'
        ),
      ]);

      const latencyMap = new Map<string, number>();
      latencies.forEach((r: any) => {
        const key = `${r.metric.tool_name || 'unknown'}:${r.metric.server || 'unknown'}`;
        latencyMap.set(key, Math.round((parseFloat(r.value[1]) || 0) * 1000));
      });

      const metricsMap = new Map<string, ToolCallMetric>();

      // Process AgriBot metrics
      agribotCalls.forEach((r: any) => {
        const toolName = r.metric.tool_name || 'unknown';
        const server = r.metric.server || 'unknown';
        const key = `${toolName}:${server}`;
        const calls = parseFloat(r.value[1]) || 0;

        if (!metricsMap.has(key)) {
          metricsMap.set(key, {
            tool_name: toolName,
            server: server,
            total_calls: 0,
            success_count: 0,
            error_count: 0,
            avg_latency_ms: latencyMap.get(key) || 0,
          });
        }

        const metric = metricsMap.get(key)!;
        metric.total_calls += calls;
        if (r.metric.status === 'success') metric.success_count += calls;
        if (r.metric.status === 'error') metric.error_count += calls;
      });

      // Merge Archestra Platform metrics
      archestraCalls.forEach((r: any) => {
        const toolName = r.metric.tool_name || 'unknown';
        const server = r.metric.server || 'unknown';
        const key = `${toolName}:${server}`;
        const calls = parseFloat(r.value[1]) || 0;

        if (!metricsMap.has(key)) {
          metricsMap.set(key, {
            tool_name: toolName,
            server: server,
            total_calls: calls,
            success_count: 0,
            error_count: 0,
            avg_latency_ms: latencyMap.get(key) || 0,
          });
        } else {
          metricsMap.get(key)!.total_calls += calls;
        }
      });

      return Array.from(metricsMap.values())
        .sort((a, b) => b.total_calls - a.total_calls)
        .slice(0, 10); // Top 10 tools
    } catch (error) {
      console.warn('Tool call metrics unavailable:', error);
      return [];
    }
  }

  /**
   * Get token usage from Archestra Platform LLM metrics (authoritative source)
   */
  private async getTokenUsage(): Promise<TokenUsage[]> {
    try {
      const [inputTokens, outputTokens] = await Promise.all([
        this.queryPrometheus('sum by (model) (llm_tokens_total{direction="input"})'),
        this.queryPrometheus('sum by (model) (llm_tokens_total{direction="output"})'),
      ]);

      const modelMap = new Map<string, TokenUsage>();

      inputTokens.forEach((r: any) => {
        const model = r.metric.model || 'unknown';
        modelMap.set(model, {
          model,
          input_tokens: Math.round(parseFloat(r.value[1])) || 0,
          output_tokens: 0,
          total_tokens: 0,
        });
      });

      outputTokens.forEach((r: any) => {
        const model = r.metric.model || 'unknown';
        const output = Math.round(parseFloat(r.value[1])) || 0;

        if (modelMap.has(model)) {
          modelMap.get(model)!.output_tokens = output;
        } else {
          modelMap.set(model, {
            model,
            input_tokens: 0,
            output_tokens: output,
            total_tokens: 0,
          });
        }
      });

      const result: TokenUsage[] = [];
      modelMap.forEach(usage => {
        usage.total_tokens = usage.input_tokens + usage.output_tokens;
        result.push(usage);
      });

      return result.sort((a, b) => b.total_tokens - a.total_tokens);
    } catch (error) {
      console.warn('Token usage metrics unavailable:', error);
      return [];
    }
  }

  /**
   * Get cost metrics from Archestra Platform (authoritative source)
   */
  private async getCostMetrics(): Promise<ObservabilityData['cost']> {
    try {
      const [costByModel, costToday, costWeek, costMonth, tokens] = await Promise.all([
        this.queryPrometheus('sum by (model) (llm_cost_total)'),
        this.queryPrometheus('sum(increase(llm_cost_total[24h]))'),
        this.queryPrometheus('sum(increase(llm_cost_total[7d]))'),
        this.queryPrometheus('sum(increase(llm_cost_total[30d]))'),
        this.queryPrometheus('sum by (model) (llm_tokens_total)'),
      ]);

      const tokenMap = new Map<string, number>();
      tokens.forEach((r: any) => {
        tokenMap.set(r.metric.model, Math.round(parseFloat(r.value[1])) || 0);
      });

      const by_model: CostMetric[] = costByModel.map((r: any) => ({
        model: r.metric.model || 'unknown',
        cost_usd: parseFloat((parseFloat(r.value[1]) || 0).toFixed(4)),
        token_count: tokenMap.get(r.metric.model) || 0,
      }));

      return {
        today_usd: parseFloat((costToday[0]?.value[1] || 0).toFixed(4)),
        week_usd: parseFloat((costWeek[0]?.value[1] || 0).toFixed(4)),
        month_usd: parseFloat((costMonth[0]?.value[1] || 0).toFixed(4)),
        by_model,
      };
    } catch (error) {
      console.warn('Cost metrics unavailable:', error);
      return {
        today_usd: 0,
        week_usd: 0,
        month_usd: 0,
        by_model: [],
      };
    }
  }

  /**
   * Get security events from AgriBot dual-LLM quarantine
   */
  private async getSecurityEvents(): Promise<SecurityEvent[]> {
    try {
      const results = await this.queryPrometheus('sum by (verdict, server, tool) (agribot_dual_llm_verdicts_total)');

      return results.map((r: any) => ({
        verdict: r.metric.verdict || 'safe',
        count: parseFloat(r.value[1]) || 0,
        server: r.metric.server || 'unknown',
        tool: r.metric.tool || 'unknown',
      }));
    } catch (error) {
      console.warn('Security metrics unavailable:', error);
      return [];
    }
  }

  /**
   * Get RBAC denial events from AgriBot
   */
  private async getRBACEvents(): Promise<RBACEvent[]> {
    try {
      const results = await this.queryPrometheus('sum by (role, tool_name) (agribot_rbac_denials_total)');

      return results
        .map((r: any) => ({
          role: r.metric.role || 'unknown',
          tool_name: r.metric.tool_name || 'unknown',
          denial_count: parseFloat(r.value[1]) || 0,
        }))
        .sort((a, b) => b.denial_count - a.denial_count)
        .slice(0, 5);
    } catch (error) {
      console.warn('RBAC metrics unavailable:', error);
      return [];
    }
  }

  /**
   * Get error rate history (placeholder for now)
   */
  private async getErrorRateHistory(): Promise<Array<{ timestamp: string; rate: number }>> {
    // TODO: Implement with Prometheus range query
    // For now, return empty array - chart will show "No data"
    return [];
  }

  /**
   * Get active sessions gauge
   */
  private async getActiveSessions(): Promise<number> {
    try {
      const results = await this.queryPrometheus('sum(agribot_active_sessions)');
      return Math.round(parseFloat(results[0]?.value[1]) || 0);
    } catch {
      return 0;
    }
  }

  /**
   * Get system uptime from Archestra Platform
   */
  private async getUptimeHours(): Promise<number> {
    try {
      const results = await this.queryPrometheus('(time() - process_start_time_seconds{job="archestra-platform"})');
      if (results.length === 0) return 0;

      const uptimeSeconds = parseFloat(results[0].value[1]) || 0;
      return parseFloat((uptimeSeconds / 3600).toFixed(1));
    } catch {
      return 0;
    }
  }

}

export const metricsClient = new MetricsClient();
export default metricsClient;
export type { ObservabilityData, ToolCallMetric, TokenUsage, CostMetric, SecurityEvent, RBACEvent };
