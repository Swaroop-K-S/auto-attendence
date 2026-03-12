import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('attendance.db');

export const initDB = () => {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room_name TEXT,
        anchor_lat REAL,
        anchor_lng REAL,
        anchor_wifi_bssid TEXT
      );

      CREATE TABLE IF NOT EXISTS attendance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER,
        date TEXT,
        status TEXT,
        marked_at TEXT,
        FOREIGN KEY(class_id) REFERENCES classes(id)
      );
    `);
    
    // Seed Sample Data from the Uploaded Timetable if empty
    const count = db.getAllSync("SELECT COUNT(*) as count FROM classes")[0].count;
    if (count === 0) {
      console.log("Seeding Sapthagiri NPS Timetable...");
      db.execSync(`
        INSERT INTO classes (name, day_of_week, start_time, end_time, room_name) VALUES 
        ('Discrete Math (DMS)', 'Monday', '09:00', '10:00', 'B108'),
        ('Automata Theory (FLAT)', 'Monday', '10:00', '11:00', 'B108'),
        ('Machine Learning Lab', 'Monday', '11:15', '13:15', 'Lab B1'),
        ('Web Technology (WEB)', 'Monday', '14:15', '15:10', 'B108'),
        ('Cyber Law (CLE)', 'Monday', '15:10', '16:05', 'B108'),
        ('Software Engineering (SE)', 'Tuesday', '09:00', '10:00', 'B108'),
        ('Automata Theory (FLAT)', 'Tuesday', '10:00', '11:00', 'B108'),
        ('Web Technology (WEB)', 'Tuesday', '12:15', '13:15', 'B108'),
        ('Machine Learning (ML)', 'Tuesday', '14:15', '15:10', 'B108');
      `);
    }

    console.log("Database tables initialized successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};

export const getDBConnection = () => {
  return db;
};

/**
 * Updates a class row with its anchored GPS coordinates and Wi-Fi signature.
 * @param {string} className - The name of the class to update
 * @param {number} lat - Latitude of the anchored location
 * @param {number} lng - Longitude of the anchored location
 * @param {string} wifi - Wi-Fi IP or BSSID signature
 */
export const updateClassAnchor = (className, lat, lng, wifi) => {
  try {
    db.runSync(
      `UPDATE classes SET anchor_lat = ?, anchor_lng = ?, anchor_wifi_bssid = ? WHERE name = ?`,
      [lat, lng, wifi, className]
    );
    console.log(`Anchor saved for class: ${className} at (${lat}, ${lng})`);
  } catch (error) {
    console.error("Error updating class anchor:", error);
    throw error;
  }
};

/**
 * Finds a class that is currently active based on day and time.
 * Returns the first matching class row or null.
 * @param {string} dayOfWeek - e.g. "Monday"
 * @param {string} currentTime - e.g. "09:05" in HH:mm format
 * @returns {object|null}
 */
export const getActiveClass = (dayOfWeek, currentTime) => {
  try {
    const result = db.getFirstSync(
      `SELECT * FROM classes 
       WHERE day_of_week = ? 
       AND start_time <= ? 
       AND end_time >= ?
       AND anchor_lat IS NOT NULL 
       AND anchor_lng IS NOT NULL`,
      [dayOfWeek, currentTime, currentTime]
    );
    return result || null;
  } catch (error) {
    console.error("Error querying active class:", error);
    return null;
  }
};

/**
 * Checks if attendance has already been marked for a class today.
 * Prevents duplicate "Present" entries in the same day.
 * @param {number} classId
 * @param {string} todayDate - e.g. "2026-03-12"
 * @returns {boolean}
 */
export const isAlreadyMarked = (classId, todayDate) => {
  try {
    const result = db.getFirstSync(
      `SELECT id FROM attendance_logs WHERE class_id = ? AND date = ?`,
      [classId, todayDate]
    );
    return !!result;
  } catch (error) {
    console.error("Error checking attendance:", error);
    return false;
  }
};
