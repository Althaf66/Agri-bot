import axios from 'axios';
import { WPIDataPoint } from './prediction-algorithm.js';

const MOSPI_SERVER_URL = process.env.MOSPI_MCP_SERVER || 'http://localhost:8000';

/**
 * Mapping of crop names to WPI indicator codes
 * These codes should match the actual MOSPI WPI indicators
 */
const CROP_TO_WPI_CODE: Record<string, string> = {
  'rice': 'WPI_FOOD_CEREALS_RICE',
  'wheat': 'WPI_FOOD_CEREALS_WHEAT',
  'tomato': 'WPI_FOOD_VEGETABLES_TOMATO',
  'onion': 'WPI_FOOD_VEGETABLES_ONION',
  'potato': 'WPI_FOOD_VEGETABLES_POTATO',
  'maize': 'WPI_FOOD_CEREALS_MAIZE',
  'cotton': 'WPI_FIBRES_COTTON',
  'sugarcane': 'WPI_FOOD_SUGARCANE',
};

/**
 * Mock WPI data generator for development/demo
 * In production, this would fetch real data from MOSPI MCP server
 */
function generateMockWPIData(crop: string, days: number): WPIDataPoint[] {
  const baseWPI: Record<string, number> = {
    'rice': 124.5,
    'wheat': 118.2,
    'tomato': 132.8,
    'onion': 126.4,
    'potato': 121.7,
    'maize': 116.9,
    'cotton': 128.3,
    'sugarcane': 119.5,
  };

  const base = baseWPI[crop.toLowerCase()] || 125.0;
  const data: WPIDataPoint[] = [];
  const today = new Date();

  // Generate daily WPI data with realistic trend
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // WPI has lower variance than market prices (typically 0.1-0.5% daily change)
    const dailyChange = (Math.random() - 0.5) * 0.8; // ±0.4% daily
    const trend = (days - i) * 0.05; // Slight upward trend (0.05% per day)
    const wpiIndex = base + trend + dailyChange;

    data.push({
      date: date.toISOString().split('T')[0], // YYYY-MM-DD format
      wpi_index: Math.round(wpiIndex * 10) / 10 // 1 decimal precision
    });
  }

  return data;
}

/**
 * Fetches WPI historical data from MOSPI MCP server
 * @param crop Crop name (lowercase)
 * @param days Number of days of historical data
 * @returns Array of WPI data points
 */
export async function fetchMOSPIWPIData(crop: string, days: number): Promise<WPIDataPoint[]> {
  const indicatorCode = CROP_TO_WPI_CODE[crop.toLowerCase()];

  if (!indicatorCode) {
    throw new Error(
      `No WPI data available for crop: ${crop}. Supported crops: ${Object.keys(CROP_TO_WPI_CODE).join(', ')}`
    );
  }

  try {
    // Attempt to fetch real MOSPI data
    // The MOSPI MCP server expects 4 sequential tool calls:
    // 1. know_about_mospi_api()
    // 2. get_indicators(dataset)
    // 3. get_metadata(dataset, indicator_code)
    // 4. get_data(dataset, filters)

    // For now, use mock data as a fallback
    // In production with Archestra integration, this would call the actual MOSPI tools
    console.log(`[MOSPI Client] Fetching WPI data for ${crop} (${indicatorCode}) - last ${days} days`);

    // TODO: Implement actual MOSPI MCP integration via Archestra
    // This requires calling the MOSPI tools through Archestra's MCP gateway
    const mockData = generateMockWPIData(crop, days);

    return mockData;
  } catch (error) {
    console.error('[MOSPI Client] Error fetching WPI data:', error);
    // Fallback to mock data
    console.log('[MOSPI Client] Using mock WPI data as fallback');
    return generateMockWPIData(crop, days);
  }
}

/**
 * Fetches weather forecast to assess risk
 * @param days Number of days ahead to forecast
 * @returns Weather risk assessment
 */
export async function fetchWeatherRisk(days: number): Promise<{
  rainProbability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}> {
  // This would integrate with agri-weather MCP server
  // For now, return mock data
  const rainProb = Math.random() * 100;

  return {
    rainProbability: Math.round(rainProb),
    riskLevel: rainProb > 60 ? 'HIGH' : rainProb > 30 ? 'MEDIUM' : 'LOW',
    description: rainProb > 60
      ? 'High probability of rain - spoilage risk for stored crops'
      : rainProb > 30
      ? 'Moderate weather risk'
      : 'Favorable weather conditions'
  };
}

/**
 * Gets supported crops for WPI prediction
 */
export function getSupportedCrops(): string[] {
  return Object.keys(CROP_TO_WPI_CODE);
}
