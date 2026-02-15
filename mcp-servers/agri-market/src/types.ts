// TypeScript interfaces for Market MCP Server

export interface CropMSP {
  crop_name: string;
  msp_price: number;
  unit: string;
}

export interface Mandi {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
}

export interface MandiPrice {
  mandi_id: string;
  mandi_name: string;
  district: string;
  lat: number;
  lon: number;
  crop_name: string;
  current_price: number;
  msp_price: number;
  msp_diff: number;
  msp_status: 'ABOVE_MSP' | 'BELOW_MSP';
}

export interface MandiPriceWithDistance extends MandiPrice {
  distance_km: number;
  transport_cost: number;
  net_price: number;
}

export interface PriceTrend {
  mandi_id: string;
  mandi_name: string;
  crop_name: string;
  prices_7day: number[];
  first_price: number;
  last_price: number;
  change_percent: number;
  direction: 'RISING' | 'FALLING' | 'STABLE';
  recommendation: string;
}

export interface GetMandiPricesResult {
  crop: string;
  msp: number;
  mandis: MandiPrice[];
  highest_price: number;
  lowest_price: number;
  price_spread: number;
  spread_percent: number;
}

export interface ComparePricesResult {
  crop: string;
  farmer_location: { lat: number; lon: number };
  radius_km: number | null;
  mandis: MandiPriceWithDistance[];
  best_mandi: MandiPriceWithDistance;
  recommendation: string;
}
