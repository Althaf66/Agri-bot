import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiDiagnosisResponse } from './types.js';

// Initialize Gemini API
const API_KEY = process.env.GEMINI_API_KEY || '';
if (!API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY not set. AI diagnosis will use fallback data.');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

// Structured prompt for disease diagnosis
const DIAGNOSIS_PROMPT = `You are an expert plant pathologist. Analyze this crop image and provide a JSON response with the following structure:

{
  "disease_name": "Specific disease name (e.g., 'Tomato Late Blight') or 'Healthy Crop'",
  "confidence": 85,
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "symptoms_observed": ["symptom 1", "symptom 2", "symptom 3"],
  "treatment_recommendation": "Detailed treatment steps",
  "organic_alternative": "Organic treatment option (if available)",
  "expected_recovery_days": 7
}

Important:
- If no disease is detected, use disease_name: "Healthy Crop"
- Confidence should be 0-100 (percentage)
- Provide actionable treatment recommendations
- Include both chemical and organic options when possible
- Return ONLY the JSON object, no markdown formatting`;

// Helper function to detect MIME type from base64 data URL
function detectMimeType(imageData: string): string {
  const match = imageData.match(/^data:image\/(\w+);base64,/);
  if (match && match[1]) {
    const format = match[1].toLowerCase();
    // Map common formats to MIME types
    const mimeTypeMap: Record<string, string> = {
      'jpeg': 'image/jpeg',
      'jpg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff',
      'tif': 'image/tiff',
    };
    return mimeTypeMap[format] || 'image/jpeg'; // Default to JPEG if unknown
  }
  return 'image/jpeg'; // Default if no prefix found
}

// Helper function to validate image size
function validateImageSize(base64Data: string, maxSizeMB: number = 20): { valid: boolean; sizeMB?: number; error?: string } {
  try {
    // Calculate size: base64 string length * 0.75 (base64 encoding overhead)
    const sizeBytes = (base64Data.length * 3) / 4;
    const sizeMB = sizeBytes / (1024 * 1024);

    if (sizeMB > maxSizeMB) {
      return {
        valid: false,
        sizeMB: parseFloat(sizeMB.toFixed(2)),
        error: `Image too large (${sizeMB.toFixed(1)}MB). Maximum allowed: ${maxSizeMB}MB`
      };
    }

    return { valid: true, sizeMB: parseFloat(sizeMB.toFixed(2)) };
  } catch (error) {
    return { valid: false, error: 'Failed to validate image size' };
  }
}

export async function analyzeCropWithGemini(
  imageData: string,
  isBase64: boolean,
  cropHint?: string
): Promise<GeminiDiagnosisResponse> {
  try {
    // Prepare image part
    let imagePart: any;
    let mimeType = 'image/jpeg';

    if (isBase64) {
      // Auto-detect MIME type from data URL
      mimeType = detectMimeType(imageData);

      // Remove data URL prefix if present
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

      // Validate image size (max 20MB)
      const sizeValidation = validateImageSize(base64Data);
      if (!sizeValidation.valid) {
        throw new Error(sizeValidation.error || 'Image size validation failed');
      }

      console.error(`Image validation: ${sizeValidation.sizeMB}MB, MIME: ${mimeType}`);

      imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      };
    } else {
      // URL-based image
      const response = await fetch(imageData);
      const buffer = await response.arrayBuffer();

      // Detect MIME type from response headers
      const contentType = response.headers.get('content-type');
      mimeType = contentType?.startsWith('image/') ? contentType : 'image/jpeg';

      // Validate size (max 20MB)
      const sizeMB = buffer.byteLength / (1024 * 1024);
      if (sizeMB > 20) {
        throw new Error(`Image too large (${sizeMB.toFixed(1)}MB). Maximum allowed: 20MB`);
      }

      const base64 = Buffer.from(buffer).toString('base64');
      imagePart = {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      };
    }

    // Add crop hint to prompt if provided
    const enhancedPrompt = cropHint
      ? `${DIAGNOSIS_PROMPT}\n\nCrop type hint: ${cropHint}`
      : DIAGNOSIS_PROMPT;

    // Call Gemini API
    const result = await model.generateContent([enhancedPrompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response (handle potential markdown formatting)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from Gemini response');
    }

    const diagnosis = JSON.parse(jsonMatch[0]) as GeminiDiagnosisResponse;

    // Validate response structure
    if (!diagnosis.disease_name || diagnosis.confidence === undefined) {
      throw new Error('Invalid diagnosis structure from Gemini');
    }

    return diagnosis;

  } catch (error) {
    console.error('Error calling Gemini API:', error);

    // Graceful fallback: return generic diagnosis
    return {
      disease_name: 'Diagnosis Failed',
      confidence: 0,
      severity: 'MEDIUM',
      symptoms_observed: ['Unable to analyze image'],
      treatment_recommendation: 'Please consult a local agricultural expert or retry with a clearer image. Ensure the image shows affected plant parts with good lighting.',
      organic_alternative: 'N/A'
    };
  }
}
