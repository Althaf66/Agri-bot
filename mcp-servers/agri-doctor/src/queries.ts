import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  DiagnosisHistoryRecord,
  TreatmentProtocol,
  GetTreatmentDetailsResult
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load treatments from JSON file
let treatmentsData: { treatments: TreatmentProtocol[] };
try {
  const treatmentsPath = join(__dirname, '..', 'data', 'treatments.json');
  treatmentsData = JSON.parse(readFileSync(treatmentsPath, 'utf-8'));
} catch (error) {
  console.warn('Warning: treatments.json not found, using empty data');
  treatmentsData = { treatments: [] };
}

export const createDoctorQueries = (db: Database.Database) => {

  // Save diagnosis to history
  const saveDiagnosis = (
    farmerId: string,
    cropName: string,
    diseaseDetected: string,
    confidenceScore: number,
    symptomsObserved: string[],
    treatmentRecommended: string,
    imageUrl?: string
  ): number => {
    const insert = db.prepare(`
      INSERT INTO diagnosis_history
      (farmer_id, crop_name, image_url, disease_detected, confidence_score, symptoms_observed, treatment_recommended)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      farmerId,
      cropName,
      imageUrl || null,
      diseaseDetected,
      confidenceScore,
      JSON.stringify(symptomsObserved),
      treatmentRecommended
    );

    return result.lastInsertRowid as number;
  };

  // Get diagnosis history for a farmer
  const getDiagnosisHistory = (farmerId: string, limit: number = 10): DiagnosisHistoryRecord[] => {
    const query = db.prepare(`
      SELECT * FROM diagnosis_history
      WHERE farmer_id = ?
      ORDER BY diagnosis_date DESC
      LIMIT ?
    `);

    const records = query.all(farmerId, limit) as any[];

    return records.map(r => ({
      ...r,
      symptoms_observed: JSON.parse(r.symptoms_observed)
    }));
  };

  // Get treatment details for a disease
  const getTreatmentDetails = (diseaseName: string): GetTreatmentDetailsResult | null => {
    // Find exact match
    const treatment = treatmentsData.treatments.find(
      t => t.disease_name.toLowerCase() === diseaseName.toLowerCase()
    );

    if (!treatment) {
      // Try finding by common name
      const matchByCommonName = treatmentsData.treatments.find(t =>
        t.common_names.some(cn => cn.toLowerCase().includes(diseaseName.toLowerCase()))
      );

      if (!matchByCommonName) return null;

      return {
        disease_name: matchByCommonName.disease_name,
        treatment: matchByCommonName,
        related_diseases: []
      };
    }

    // Find related diseases (same crop type)
    const related_diseases = treatmentsData.treatments
      .filter(t =>
        t.disease_name !== treatment.disease_name &&
        t.crop_types.some(ct => treatment.crop_types.includes(ct))
      )
      .map(t => t.disease_name)
      .slice(0, 3);

    return {
      disease_name: treatment.disease_name,
      treatment,
      related_diseases
    };
  };

  return {
    saveDiagnosis,
    getDiagnosisHistory,
    getTreatmentDetails
  };
};
