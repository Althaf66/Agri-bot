// Database query layer

import Database from 'better-sqlite3';
import type { Farmer, CropInfo, Location, CropPhase, FarmerProfile, PhaseTransitionResult } from './types.js';

// Type for the queries instance
export interface AgribotQueries {
  resolveFarmerIdentifier: (identifier: string) => string | null;
  getFarmerProfile: (identifier: string) => FarmerProfile | null;
  getCropPhaseDetails: (phaseKey: string) => CropPhase | null;
  updateCropPhase: (identifier: string, cropName: string) => PhaseTransitionResult | null;
  listFarmers: (district?: string) => Farmer[];
}

// Factory function to create query functions
export const createAgribotQueries = (db: Database.Database): AgribotQueries => {

  // Hybrid farmer lookup - accepts farmer_id OR farmer name
  const resolveFarmerIdentifier = (identifier: string): string | null => {
    // Try exact farmer_id match first (case-insensitive)
    const byId = db.prepare('SELECT id FROM farmers WHERE UPPER(id) = UPPER(?)').get(identifier) as { id: string } | undefined;
    if (byId) return byId.id;

    // Try exact name match (case-insensitive) via users table
    const byName = db.prepare(`
      SELECT f.id FROM farmers f
      JOIN users u ON f.id = u.id
      WHERE UPPER(u.name) = UPPER(?)
    `).get(identifier) as { id: string } | undefined;
    if (byName) return byName.id;

    // Try partial name match (for "Ramesh" matching "Ramesh Patil")
    const byPartialName = db.prepare(`
      SELECT f.id FROM farmers f
      JOIN users u ON f.id = u.id
      WHERE UPPER(u.name) LIKE UPPER(?)
      LIMIT 1
    `).get(`%${identifier}%`) as { id: string } | undefined;
    if (byPartialName) return byPartialName.id;

    return null;
  };

  // Get farmer profile with current crop phase context
  const getFarmerProfile = (identifier: string): FarmerProfile | null => {
    // Resolve identifier to farmer_id
    const farmerId = resolveFarmerIdentifier(identifier);
    if (!farmerId) return null;
    // Get farmer basic info
    const farmerRow = db
      .prepare(`
        SELECT * FROM farmer_summary WHERE id = ?
      `)
      .get(farmerId) as any;

    if (!farmerRow) {
      return null;
    }

    // Get crops
    const cropRows = db
      .prepare(`
        SELECT
          ct.name as crop_name,
          cv.name as variety,
          fc.phase,
          fc.sown_date
        FROM farmer_crops fc
        JOIN crop_varieties cv ON fc.crop_variety_id = cv.id
        JOIN crop_types ct ON cv.crop_type_id = ct.id
        WHERE fc.farmer_id = ?
      `)
      .all(farmerId) as any[];

    const crops: CropInfo[] = cropRows.map(row => ({
      name: row.crop_name,
      variety: row.variety,
      phase: row.phase,
      sown_date: row.sown_date
    }));

    const location: Location = {
      district: farmerRow.district,
      state: farmerRow.state,
      lat: farmerRow.lat,
      lon: farmerRow.lon
    };

    const farmer: Farmer = {
      id: farmerRow.id,
      name: farmerRow.name,
      location,
      land_acres: farmerRow.land_acres,
      crops,
      income_category: farmerRow.income_category,
      bank_account: farmerRow.bank_account === 1,
      aadhaar_linked: farmerRow.aadhaar_linked === 1,
      role: 'farmer'
    };

    // Get current phase context (from first crop)
    let profile: FarmerProfile = farmer;

    if (crops.length > 0) {
      const currentPhase = crops[0]!.phase;
      const phaseDetails = getCropPhaseDetails(currentPhase);

      if (phaseDetails) {
        profile.current_phase_context = phaseDetails;
        profile.active_agents_list = phaseDetails.active_agents;
      }
    }

    return profile;
  };

  // Get crop phase details with tools and agents
  const getCropPhaseDetails = (phaseKey: string): CropPhase | null => {
    const phaseRow = db
      .prepare(`
        SELECT * FROM crop_phases WHERE phase_key = ?
      `)
      .get(phaseKey) as any;

    if (!phaseRow) {
      return null;
    }

    const agents = db
      .prepare(`
        SELECT agent_name FROM phase_agents WHERE phase_key = ?
      `)
      .all(phaseKey) as any[];

    const tools = db
      .prepare(`
        SELECT tool_name FROM phase_tools WHERE phase_key = ?
      `)
      .all(phaseKey) as any[];

    return {
      phase_key: phaseRow.phase_key,
      display_name: phaseRow.display_name,
      active_agents: agents.map(a => a.agent_name),
      tools_activated: tools.map(t => t.tool_name),
      context_prompt: phaseRow.context_prompt,
      next_phase: phaseRow.next_phase,
      typical_duration_days: phaseRow.typical_duration_days
    };
  };

  // Update crop phase to next phase (transactional)
  const updateCropPhase = (identifier: string, cropName: string): PhaseTransitionResult | null => {
    // Resolve identifier to farmer_id
    const farmerId = resolveFarmerIdentifier(identifier);
    if (!farmerId) return null;

    const transaction = db.transaction(() => {
      // Find the crop (case-insensitive)
      const cropRow = db
        .prepare(`
          SELECT
            fc.id,
            fc.phase as current_phase,
            ct.name as crop_name
          FROM farmer_crops fc
          JOIN crop_varieties cv ON fc.crop_variety_id = cv.id
          JOIN crop_types ct ON cv.crop_type_id = ct.id
          WHERE fc.farmer_id = ? AND LOWER(ct.name) = LOWER(?)
        `)
        .get(farmerId, cropName) as any;

      if (!cropRow) {
        return null;
      }

      // Get next phase
      const phaseRow = db
        .prepare(`
          SELECT next_phase FROM crop_phases WHERE phase_key = ?
        `)
        .get(cropRow.current_phase) as any;

      if (!phaseRow) {
        return null;
      }

      const nextPhase = phaseRow.next_phase;

      // Update the crop phase
      const now = new Date().toISOString();
      db
        .prepare(`
          UPDATE farmer_crops
          SET phase = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(nextPhase, now, cropRow.id);

      // Get new active agents
      const agents = db
        .prepare(`
          SELECT agent_name FROM phase_agents WHERE phase_key = ?
        `)
        .all(nextPhase) as any[];

      const result: PhaseTransitionResult = {
        farmer_id: farmerId,
        crop_name: cropRow.crop_name,
        old_phase: cropRow.current_phase,
        new_phase: nextPhase,
        new_active_agents: agents.map(a => a.agent_name),
        updated_at: now
      };

      return result;
    });

    return transaction();
  };

  // List all farmers, optionally filtered by district
  const listFarmers = (district?: string): Farmer[] => {
    let query = `
      SELECT * FROM farmer_summary
    `;
    const params: any[] = [];

    if (district) {
      query += ` WHERE district = ?`;
      params.push(district);
    }

    const farmerRows = db.prepare(query).all(...params) as any[];

    return farmerRows.map(row => {
      // Get crops for this farmer
      const cropRows = db
        .prepare(`
          SELECT
            ct.name as crop_name,
            cv.name as variety,
            fc.phase,
            fc.sown_date
          FROM farmer_crops fc
          JOIN crop_varieties cv ON fc.crop_variety_id = cv.id
          JOIN crop_types ct ON cv.crop_type_id = ct.id
          WHERE fc.farmer_id = ?
        `)
        .all(row.id) as any[];

      const crops: CropInfo[] = cropRows.map(cropRow => ({
        name: cropRow.crop_name,
        variety: cropRow.variety,
        phase: cropRow.phase,
        sown_date: cropRow.sown_date
      }));

      const location: Location = {
        district: row.district,
        state: row.state,
        lat: row.lat,
        lon: row.lon
      };

      return {
        id: row.id,
        name: row.name,
        location,
        land_acres: row.land_acres,
        crops,
        income_category: row.income_category,
        bank_account: row.bank_account === 1,
        aadhaar_linked: row.aadhaar_linked === 1,
        role: 'farmer' as const
      };
    });
  };

  // Return public API
  return {
    resolveFarmerIdentifier,
    getFarmerProfile,
    getCropPhaseDetails,
    updateCropPhase,
    listFarmers
  };
};
