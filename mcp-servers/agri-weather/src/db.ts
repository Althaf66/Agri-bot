import Database from 'better-sqlite3';

export const initializeWeatherTables = (db: Database.Database): void => {
  // Check if weather tables already exist
  const weatherTableExists = db
    .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='weather_alerts'")
    .get() as { cnt: number };

  if (weatherTableExists.cnt > 0) {
    console.error('Weather tables already initialized');
    return;
  }

  console.error('Adding weather tables to agribot.db...');

  // Create weather_alerts table
  db.exec(`
    CREATE TABLE weather_alerts (
      id TEXT PRIMARY KEY,
      district TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('HEAVY_RAIN', 'HIGH_HUMIDITY', 'DRY_SPELL', 'FROST', 'HEATWAVE')),
      severity TEXT NOT NULL CHECK(severity IN ('Yellow', 'Orange', 'Red')),
      issued_at TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      message TEXT NOT NULL,
      advice TEXT NOT NULL
    );

    CREATE INDEX idx_alerts_district ON weather_alerts(district);
    CREATE INDEX idx_alerts_valid ON weather_alerts(valid_until);
  `);

  // Create soil_moisture_readings table
  db.exec(`
    CREATE TABLE soil_moisture_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      moisture_percent REAL NOT NULL,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_readings_location ON soil_moisture_readings(latitude, longitude);
    CREATE INDEX idx_readings_timestamp ON soil_moisture_readings(timestamp);
  `);

  // Create crop_moisture_ranges table
  db.exec(`
    CREATE TABLE crop_moisture_ranges (
      crop_type TEXT PRIMARY KEY,
      min_percent REAL NOT NULL,
      max_percent REAL NOT NULL
    );
  `);

  console.error('Seeding weather data...');
  seedWeatherData(db);
  console.error('Weather tables initialized successfully');
};

const seedWeatherData = (db: Database.Database): void => {
  const transaction = db.transaction(() => {
    // Seed weather alerts
    const insertAlert = db.prepare(`
      INSERT INTO weather_alerts (id, district, type, severity, issued_at, valid_until, message, advice)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Dharwad alerts
    insertAlert.run(
      'IMD-KAR-DWD-001', 'Dharwad', 'HIGH_HUMIDITY', 'Yellow', '2026-02-08', '2026-02-12',
      'Relative humidity expected to remain above 85% for next 3 days',
      'High risk of fungal diseases. Monitor crops for early signs. Avoid irrigation in late evening.'
    );
    insertAlert.run(
      'IMD-KAR-DWD-002', 'Dharwad', 'DRY_SPELL', 'Yellow', '2026-02-07', '2026-02-14',
      'No significant rainfall expected for next 7 days',
      'Plan irrigation schedule. Monitor soil moisture. Consider mulching to reduce water loss.'
    );

    // Belgaum alerts
    insertAlert.run(
      'IMD-KAR-BLG-001', 'Belgaum', 'HEAVY_RAIN', 'Orange', '2026-02-09', '2026-02-11',
      'Heavy rainfall (50-100mm) expected over next 48 hours',
      'Delay fertilizer application. Ensure drainage in low-lying fields. Harvest ripe crops if possible.'
    );
    insertAlert.run(
      'IMD-KAR-BLG-002', 'Belgaum', 'HIGH_HUMIDITY', 'Yellow', '2026-02-08', '2026-02-13',
      'High humidity levels (>80%) expected due to rainfall',
      'Watch for signs of fungal infection. Apply preventive fungicides if needed.'
    );

    // Hubli alerts
    insertAlert.run(
      'IMD-KAR-HBL-001', 'Hubli', 'HEATWAVE', 'Orange', '2026-02-09', '2026-02-12',
      'Maximum temperatures expected to reach 38-40°C',
      'Increase irrigation frequency. Provide shade for sensitive crops. Avoid midday field work.'
    );

    // Gadag alerts
    insertAlert.run(
      'IMD-KAR-GDG-001', 'Gadag', 'DRY_SPELL', 'Orange', '2026-02-08', '2026-02-15',
      'Extended dry period with no rainfall for 10+ days',
      'Critical irrigation needed. Prioritize high-value crops. Check soil moisture regularly.'
    );

    // Seed soil moisture readings
    const insertReading = db.prepare(`
      INSERT INTO soil_moisture_readings (sensor_id, latitude, longitude, moisture_percent, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Dharwad sensors (multiple readings for same sensor to show history)
    insertReading.run('SENS-DWD-001', 15.46, 75.01, 45, '2026-02-09 08:00:00');
    insertReading.run('SENS-DWD-001', 15.46, 75.01, 42, '2026-02-09 14:00:00');
    insertReading.run('SENS-DWD-002', 15.44, 75.03, 55, '2026-02-09 08:00:00');
    insertReading.run('SENS-DWD-002', 15.44, 75.03, 52, '2026-02-09 14:00:00');

    // Belgaum sensors (higher moisture due to recent rain)
    insertReading.run('SENS-BLG-001', 15.85, 74.50, 72, '2026-02-09 08:00:00');
    insertReading.run('SENS-BLG-001', 15.85, 74.50, 75, '2026-02-09 14:00:00');
    insertReading.run('SENS-BLG-002', 15.87, 74.52, 68, '2026-02-09 08:00:00');

    // Hubli sensors (lower moisture due to heat)
    insertReading.run('SENS-HBL-001', 15.36, 75.12, 35, '2026-02-09 08:00:00');
    insertReading.run('SENS-HBL-001', 15.36, 75.12, 32, '2026-02-09 14:00:00');
    insertReading.run('SENS-HBL-002', 15.38, 75.14, 38, '2026-02-09 08:00:00');

    // Gadag sensors (very low due to dry spell)
    insertReading.run('SENS-GDG-001', 15.43, 75.63, 28, '2026-02-09 08:00:00');
    insertReading.run('SENS-GDG-001', 15.43, 75.63, 25, '2026-02-09 14:00:00');

    // Seed crop moisture ranges
    const insertRange = db.prepare(`
      INSERT INTO crop_moisture_ranges (crop_type, min_percent, max_percent)
      VALUES (?, ?, ?)
    `);

    insertRange.run('Rice', 60, 80);
    insertRange.run('Wheat', 50, 70);
    insertRange.run('Tomato', 60, 75);
    insertRange.run('Maize', 50, 65);
    insertRange.run('Cotton', 40, 60);
    insertRange.run('Sugarcane', 65, 85);
    insertRange.run('Soybean', 50, 70);
    insertRange.run('Default', 50, 70);
  });

  transaction();
};
