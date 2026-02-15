import regression from 'regression';

export interface WPIDataPoint {
  date: string;
  wpi_index: number;
}

export interface WPIPrediction {
  currentWPI: number;
  predictedWPI: number;
  percentChange: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  trendDirection: 'RISING' | 'FALLING' | 'STABLE';
  variance: number;
}

/**
 * Predicts future WPI index using simple linear regression
 * @param historicalWPI Array of historical WPI data points
 * @param daysAhead Number of days to predict ahead
 * @returns Prediction with confidence score
 */
export function predictWPIIndex(
  historicalWPI: WPIDataPoint[],
  daysAhead: number
): WPIPrediction {
  if (historicalWPI.length < 7) {
    throw new Error('Need at least 7 days of historical WPI data for prediction');
  }

  // Step 1: Convert to [x, y] points for regression (x = day index, y = WPI value)
  const points: [number, number][] = historicalWPI.map((d, i) => [i, d.wpi_index]);

  // Step 2: Calculate linear regression using npm regression package
  const result = regression.linear(points);
  const slope = result.equation[0];
  const intercept = result.equation[1];

  // Step 3: Predict future WPI index
  const currentIndex = historicalWPI.length - 1;
  const futureIndex = currentIndex + daysAhead;
  const currentWPI = historicalWPI[currentIndex].wpi_index;
  const predictedWPI = slope * futureIndex + intercept;

  // Step 4: Calculate % change
  const percentChange = ((predictedWPI - currentWPI) / currentWPI) * 100;

  // Step 5: Confidence based on WPI variance (WPI is more stable than prices)
  const variance = calculateVariance(historicalWPI.map(d => d.wpi_index));
  const confidence = variance < 5 ? 'HIGH' : variance < 15 ? 'MEDIUM' : 'LOW';

  // Step 6: Trend direction
  const trendDirection =
    percentChange > 1 ? 'RISING' :
    percentChange < -1 ? 'FALLING' :
    'STABLE';

  return {
    currentWPI,
    predictedWPI: Math.round(predictedWPI * 10) / 10, // 1 decimal
    percentChange: Math.round(percentChange * 100) / 100, // 2 decimals
    confidence,
    trendDirection,
    variance: Math.round(variance * 100) / 100
  };
}

/**
 * Calculates variance of a dataset (measure of volatility)
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((a, b) => a + b) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b) / values.length;
}

/**
 * Helper to convert WPI % change to absolute price prediction
 * @param currentPrice Current market price (₹/quintal)
 * @param wpiPercentChange WPI % change from prediction
 * @returns Predicted price
 */
export function applyWPIChangeToPrice(
  currentPrice: number,
  wpiPercentChange: number
): number {
  return Math.round(currentPrice * (1 + wpiPercentChange / 100));
}

/**
 * Calculates storage costs for a given duration
 * @param crop Crop name
 * @param days Number of days to store
 * @param quantityQuintals Quantity in quintals
 * @returns Storage cost breakdown
 */
export function calculateStorageCost(
  crop: string,
  days: number,
  quantityQuintals: number
): {
  totalCost: number;
  ratePerQuintalPerWeek: number;
  durationWeeks: number;
  breakdown: string;
} {
  const ratePerQuintalPerWeek = 50; // ₹50/quintal/week
  const weeks = days / 7;
  const totalCost = Math.round(ratePerQuintalPerWeek * weeks * quantityQuintals);

  return {
    totalCost,
    ratePerQuintalPerWeek,
    durationWeeks: Math.round(weeks * 10) / 10,
    breakdown: `₹${ratePerQuintalPerWeek} × ${weeks.toFixed(1)} weeks × ${quantityQuintals} quintals`
  };
}
