// Type definitions for AgriBot data models

export interface Location {
  district: string;
  state: string;
  lat: number;
  lon: number;
}

export interface CropInfo {
  name: string;
  variety: string;
  phase: string;
  sown_date: string | null;
}

export interface Farmer {
  id: string;
  name: string;
  location: Location;
  land_acres: number;
  crops: CropInfo[];
  income_category: string;
  bank_account: boolean;
  aadhaar_linked: boolean;
  role: 'farmer';
}

export interface Officer {
  id: string;
  name: string;
  block: string;
  role: 'officer';
}

export interface Trader {
  id: string;
  name: string;
  mandi: string;
  role: 'trader';
}

export interface CropPhase {
  phase_key: string;
  display_name: string;
  active_agents: string[];
  tools_activated: string[];
  context_prompt: string;
  next_phase: string;
  typical_duration_days: number;
}

export interface FarmerProfile extends Farmer {
  current_phase_context?: CropPhase;
  active_agents_list?: string[];
}

export interface PhaseTransitionResult {
  farmer_id: string;
  crop_name: string;
  old_phase: string;
  new_phase: string;
  new_active_agents: string[];
  updated_at: string;
}
