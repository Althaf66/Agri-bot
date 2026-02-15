// Gemini API Types
export interface GeminiDiagnosisRequest {
  image_base64?: string;
  image_url?: string;
  crop_hint?: string;  // Optional hint to improve accuracy
}

export interface GeminiDiagnosisResponse {
  disease_name: string;
  confidence: number;  // 0-100 scale
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  symptoms_observed: string[];
  treatment_recommendation: string;
  organic_alternative?: string;
  expected_recovery_days?: number;
}

// Database Types
export interface DiagnosisHistoryRecord {
  id: number;
  farmer_id: string;
  crop_name: string;
  image_url?: string;
  disease_detected: string;
  confidence_score: number;
  symptoms_observed: string[];
  treatment_recommended: string;
  diagnosis_date: string;
}

export interface TreatmentProtocol {
  disease_name: string;
  common_names: string[];
  crop_types: string[];
  symptoms: string[];
  organic_treatment: string;
  chemical_treatment: string;
  dosage: string;
  application_method: string;
  prevention_tips: string[];
}

// Tool Response Types
export interface AnalyzeCropImageResult {
  diagnosis: GeminiDiagnosisResponse;
  saved_to_history: boolean;
  diagnosis_id?: number;
}

export interface GetTreatmentDetailsResult {
  disease_name: string;
  treatment: TreatmentProtocol;
  related_diseases: string[];
}
