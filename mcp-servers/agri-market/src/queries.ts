// Query functions with business logic for Market MCP Server

import Database from 'better-sqlite3';
import type {
  GetMandiPricesResult,
  ComparePricesResult,
  PriceTrend,
  MandiPrice,
  MandiPriceWithDistance,
} from './types.js';

// Factory function to create query functions
export const createMarketQueries = (db: Database.Database) => {
  // Query 1: Get all mandi prices for a crop
  const getMandiPrices = (cropName: string): GetMandiPricesResult | null => {
    // Get MSP for the crop
    const cropMsp = db
      .prepare('SELECT msp_price FROM crop_msp WHERE crop_name = ?')
      .get(cropName) as { msp_price: number } | undefined;

    if (!cropMsp) {
      return null;
    }

    // Get all mandis with prices for this crop
    const mandis = db
      .prepare(`
        SELECT
          mandi_id,
          mandi_name,
          district,
          lat,
          lon,
          crop_name,
          current_price,
          msp_price,
          msp_diff,
          msp_status
        FROM mandi_price_summary
        WHERE crop_name = ?
        ORDER BY current_price DESC
      `)
      .all(cropName) as MandiPrice[];

    if (mandis.length === 0) {
      return null;
    }

    // Calculate price spread
    const highest_price = mandis[0]!.current_price;
    const lowest_price = mandis[mandis.length - 1]!.current_price;
    const price_spread = highest_price - lowest_price;
    const spread_percent = (price_spread / lowest_price) * 100;

    return {
      crop: cropName,
      msp: cropMsp.msp_price,
      mandis,
      highest_price,
      lowest_price,
      price_spread,
      spread_percent: Math.round(spread_percent * 100) / 100,
    };
  };

  // Query 2: Compare prices with distance and transport cost
  const comparePrices = (
    cropName: string,
    farmerLat: number,
    farmerLon: number,
    radiusKm?: number
  ): ComparePricesResult | null => {
    // Get transport cost per km
    const config = db
      .prepare("SELECT value FROM market_config WHERE key = 'transport_cost_per_km'")
      .get() as { value: number } | undefined;

    const transportCostPerKm = config?.value || 12;

    // Get MSP for the crop
    const cropMsp = db
      .prepare('SELECT msp_price FROM crop_msp WHERE crop_name = ?')
      .get(cropName) as { msp_price: number } | undefined;

    if (!cropMsp) {
      return null;
    }

    // Get all mandis with prices for this crop
    const mandis = db
      .prepare(`
        SELECT
          mandi_id,
          mandi_name,
          district,
          lat,
          lon,
          crop_name,
          current_price,
          msp_price,
          msp_diff,
          msp_status
        FROM mandi_price_summary
        WHERE crop_name = ?
      `)
      .all(cropName) as MandiPrice[];

    if (mandis.length === 0) {
      return null;
    }

    // Calculate distance, transport cost, and net price for each mandi
    const mandisWithDistance: MandiPriceWithDistance[] = mandis
      .map((mandi) => {
        // Haversine distance calculation (simplified for small distances)
        const latDiff = (mandi.lat - farmerLat) * 111; // 1 degree lat ≈ 111 km
        const lonDiff =
          (mandi.lon - farmerLon) *
          111 *
          Math.cos((farmerLat * Math.PI) / 180);
        const distance_km = Math.sqrt(
          latDiff * latDiff + lonDiff * lonDiff
        );

        const transport_cost = distance_km * transportCostPerKm;
        const net_price = mandi.current_price - transport_cost;

        return {
          ...mandi,
          distance_km: Math.round(distance_km * 100) / 100,
          transport_cost: Math.round(transport_cost * 100) / 100,
          net_price: Math.round(net_price * 100) / 100,
        };
      })
      .filter((mandi) => {
        // Filter by radius if provided
        if (radiusKm !== undefined) {
          return mandi.distance_km <= radiusKm;
        }
        return true;
      })
      .sort((a, b) => b.net_price - a.net_price); // Sort by net price DESC

    if (mandisWithDistance.length === 0) {
      return null;
    }

    const best_mandi = mandisWithDistance[0]!;

    // Generate recommendation
    let recommendation: string;
    if (best_mandi.net_price >= cropMsp.msp_price) {
      recommendation = `Sell at ${best_mandi.mandi_name} for best net return of Rs ${best_mandi.net_price}/qtl (after transport cost of Rs ${best_mandi.transport_cost}).`;
    } else {
      recommendation = `Warning: Best net price (Rs ${best_mandi.net_price}/qtl at ${best_mandi.mandi_name}) is below MSP (Rs ${cropMsp.msp_price}/qtl). Consider claiming MSP support through government procurement.`;
    }

    return {
      crop: cropName,
      farmer_location: { lat: farmerLat, lon: farmerLon },
      radius_km: radiusKm || null,
      mandis: mandisWithDistance,
      best_mandi,
      recommendation,
    };
  };

  // Query 3: Get price trend for a crop at a specific mandi
  const getPriceTrend = (
    cropName: string,
    mandiId: string
  ): PriceTrend | null => {
    // Get mandi name
    const mandi = db
      .prepare('SELECT name FROM mandis WHERE id = ?')
      .get(mandiId) as { name: string } | undefined;

    if (!mandi) {
      return null;
    }

    // Get 7-day price trend
    const trends = db
      .prepare(`
        SELECT price
        FROM price_trends
        WHERE mandi_id = ? AND crop_name = ?
        ORDER BY day_offset ASC
      `)
      .all(mandiId, cropName) as { price: number }[];

    if (trends.length === 0) {
      return null;
    }

    const prices_7day = trends.map((t) => t.price);
    const first_price = prices_7day[0]!;
    const last_price = prices_7day[prices_7day.length - 1]!;
    const change = last_price - first_price;
    const change_percent = (change / first_price) * 100;

    // Determine direction
    let direction: 'RISING' | 'FALLING' | 'STABLE';
    if (Math.abs(change_percent) < 1) {
      direction = 'STABLE';
    } else if (change_percent > 0) {
      direction = 'RISING';
    } else {
      direction = 'FALLING';
    }

    // Generate recommendation
    let recommendation: string;
    if (direction === 'STABLE') {
      recommendation = `Prices stable at ${mandi.name} (${Math.abs(change_percent).toFixed(1)}% change). No urgency to sell.`;
    } else if (direction === 'RISING') {
      recommendation = `Prices rising at ${mandi.name} (+${change_percent.toFixed(1)}%). Consider waiting 2-3 days for better rates.`;
    } else {
      recommendation = `Prices falling at ${mandi.name} (${change_percent.toFixed(1)}%). Sell immediately to avoid further loss.`;
    }

    return {
      mandi_id: mandiId,
      mandi_name: mandi.name,
      crop_name: cropName,
      prices_7day,
      first_price,
      last_price,
      change_percent: Math.round(change_percent * 100) / 100,
      direction,
      recommendation,
    };
  };

  return {
    getMandiPrices,
    comparePrices,
    getPriceTrend,
  };
};
