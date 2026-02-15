// Direct MOSPI eSankhyiki API Integration
// Fetches real Wholesale Price Index data from Government of India

export interface WPIRecord {
  commodity: string;
  wpi_index: number;
  year: number;
  month?: number;
  change_percent?: number;
}

export interface WPIResponse {
  success: boolean;
  data: WPIRecord[];
  metadata?: {
    base_year: string;
    source: string;
  };
}

// Crop name mapping to WPI commodity search terms
const CROP_TO_COMMODITY: Record<string, string> = {
  Rice: 'Rice',
  Wheat: 'Wheat',
  Tomato: 'Tomato',
  Maize: 'Maize',
  Cotton: 'Cotton',
  Pulses: 'Pulses',
  Vegetables: 'Vegetables',
  Fruits: 'Fruits',
  Oilseeds: 'Oilseeds',
};

/**
 * Fetch WPI data directly from MOSPI eSankhyiki API
 * @param crops - Array of crop names to fetch WPI data for
 * @param year - Year for which to fetch data (default: current year)
 * @returns WPI response with commodity data
 */
export async function fetchWPIData(
  crops: string[] = ['Rice', 'Wheat', 'Pulses', 'Vegetables', 'Fruits', 'Oilseeds'],
  year: number = new Date().getFullYear()
): Promise<WPIResponse> {
  try {
    // MOSPI API endpoint
    const url = new URL('https://api.mospi.gov.in/api/wpi/getWpiRecords');

    // Set query parameters
    url.searchParams.append('year', year.toString());
    url.searchParams.append('group_code', 'PRIMARY_ARTICLES'); // Agricultural commodities
    url.searchParams.append('limit', '1000');
    url.searchParams.append('Format', 'JSON');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`MOSPI API error: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.json();

    // Transform and filter for requested crops
    const filteredData: WPIRecord[] = [];

    // Process the response data
    // Note: Actual API response structure may vary - adjust as needed
    if (Array.isArray(rawData.data)) {
      for (const item of rawData.data) {
        const commodityName = item.commodity_name || item.item_name || '';

        // Check if this commodity matches any of our crops
        for (const crop of crops) {
          const searchTerm = CROP_TO_COMMODITY[crop];
          if (commodityName.toLowerCase().includes(searchTerm.toLowerCase())) {
            filteredData.push({
              commodity: crop,
              wpi_index: parseFloat(item.index_value || item.wpi || 0),
              year: parseInt(item.year || year.toString()),
              month: item.month ? parseInt(item.month) : undefined,
              change_percent: item.change_percent ? parseFloat(item.change_percent) : undefined,
            });
            break; // Found match, move to next item
          }
        }
      }
    }

    // If we have data, aggregate by crop
    const aggregatedData = aggregateByCrop(filteredData, crops);

    return {
      success: true,
      data: aggregatedData,
      metadata: {
        base_year: '2011-12',
        source: 'National Statistics Office (NSO), Ministry of Statistics and Programme Implementation (MOSPI)',
      },
    };
  } catch (error) {
    console.error('Failed to fetch WPI data from MOSPI:', error);
    // Return empty success response to trigger fallback
    return {
      success: false,
      data: [],
    };
  }
}

/**
 * Aggregate WPI records by crop (averaging if multiple records per crop)
 * @param data - Array of WPI records
 * @param crops - Array of crop names to include
 * @returns Aggregated WPI records
 */
function aggregateByCrop(data: WPIRecord[], crops: string[]): WPIRecord[] {
  const cropMap = new Map<string, WPIRecord[]>();

  // Group by crop
  for (const record of data) {
    const existing = cropMap.get(record.commodity) || [];
    existing.push(record);
    cropMap.set(record.commodity, existing);
  }

  // Aggregate (average if multiple records per crop)
  const result: WPIRecord[] = [];
  for (const crop of crops) {
    const records = cropMap.get(crop) || [];
    if (records.length > 0) {
      const avgIndex = records.reduce((sum, r) => sum + r.wpi_index, 0) / records.length;
      const avgChange =
        records.filter((r) => r.change_percent !== undefined).length > 0
          ? records.reduce((sum, r) => sum + (r.change_percent || 0), 0) /
            records.filter((r) => r.change_percent !== undefined).length
          : undefined;

      result.push({
        commodity: crop,
        wpi_index: Math.round(avgIndex * 10) / 10,
        year: records[0].year,
        month: records[0].month,
        change_percent: avgChange !== undefined ? Math.round(avgChange * 10) / 10 : undefined,
      });
    }
  }

  return result;
}
