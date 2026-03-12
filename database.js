import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('attendance.db');

export const initDB = () => {
  try {
    // ─── Core Tables ───────────────────────────────────────────────────
    db.execSync(`
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT 'local_user',
        name TEXT NOT NULL,
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        class_type TEXT DEFAULT 'theory',
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
        session_end_status TEXT DEFAULT 'Completed',
        last_verified_at TEXT,
        FOREIGN KEY(class_id) REFERENCES classes(id)
      );
    `);

    // ─── Migration: Add new columns if upgrading from old schema ──────
    try { db.execSync(`ALTER TABLE classes ADD COLUMN user_id TEXT DEFAULT 'local_user'`); } catch(e) {}
    try { db.execSync(`ALTER TABLE classes ADD COLUMN class_type TEXT DEFAULT 'theory'`); } catch(e) {}
    try { db.execSync(`ALTER TABLE attendance_logs ADD COLUMN session_end_status TEXT DEFAULT 'Completed'`); } catch(e) {}
    try { db.execSync(`ALTER TABLE attendance_logs ADD COLUMN last_verified_at TEXT`); } catch(e) {}

    // ─── Seed Sample Data ─────────────────────────────────────────────
    const count = db.getAllSync("SELECT COUNT(*) as count FROM classes")[0].count;
    if (count === 0) {
      console.log("Seeding Sapthagiri NPS Timetable...");
      db.execSync(`
        INSERT INTO classes (name, day_of_week, start_time, end_time, room_name, class_type) VALUES 
        ('Discrete Math (DMS)', 'Monday', '09:00', '10:00', 'B108', 'theory'),
        ('Automata Theory (FLAT)', 'Monday', '10:00', '11:00', 'B108', 'theory'),
        ('Machine Learning Lab', 'Monday', '11:15', '13:15', 'Lab B1', 'lab'),
        ('Web Technology (WEB)', 'Monday', '14:15', '15:10', 'B108', 'theory'),
        ('Cyber Law (CLE)', 'Monday', '15:10', '16:05', 'B108', 'theory'),
        ('Software Engineering (SE)', 'Tuesday', '09:00', '10:00', 'B108', 'theory'),
        ('Automata Theory (FLAT)', 'Tuesday', '10:00', '11:00', 'B108', 'theory'),
        ('Web Technology (WEB)', 'Tuesday', '12:15', '13:15', 'B108', 'theory'),
        ('Machine Learning (ML)', 'Tuesday', '14:15', '15:10', 'B108', 'theory');
      `);
    }

    console.log("Database tables initialized successfully.");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};

// ═══════════════════════════════════════════════════════════════════════
// Core Access
// ═══════════════════════════════════════════════════════════════════════

export const getDBConnection = () => {
  return db;
};

// ═══════════════════════════════════════════════════════════════════════
// Class Management
// ═══════════════════════════════════════════════════════════════════════

/**
 * Saves a new class for a specific user, including class type.
 * @param {object} classData - { name, day_of_week, start_time, end_time, room_name, class_type }
 * @param {string} userId - The authenticated user's ID (defaults to 'local_user')
 */
export const saveUserClass = (classData, userId = 'local_user') => {
  try {
    const { name, day_of_week, start_time, end_time, room_name, class_type } = classData;
    db.runSync(
      `INSERT INTO classes (user_id, name, day_of_week, start_time, end_time, room_name, class_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, day_of_week, start_time, end_time, room_name || '', class_type || 'theory']
    );
    console.log(`Class "${name}" saved for user ${userId}`);
  } catch (error) {
    console.error("Error saving user class:", error);
    throw error;
  }
};

/**
 * Fetches all classes for a specific user, optionally filtered by day.
 * @param {string} userId - The user's ID
 * @param {string|null} day - Optional day filter (e.g. "Monday")
 * @returns {Array}
 */
export const getClassesByUser = (userId = 'local_user', day = null) => {
  try {
    if (day) {
      return db.getAllSync(
        `SELECT * FROM classes WHERE user_id = ? AND day_of_week = ? ORDER BY start_time`,
        [userId, day]
      );
    }
    return db.getAllSync(
      `SELECT * FROM classes WHERE user_id = ? ORDER BY day_of_week, start_time`,
      [userId]
    );
  } catch (error) {
    console.error("Error fetching classes by user:", error);
    return [];
  }
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

// ═══════════════════════════════════════════════════════════════════════
// Attendance Queries
// ═══════════════════════════════════════════════════════════════════════

/**
 * Finds a class that is currently active based on day and time.
 * Only considers classes that have an anchor set.
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
 * Prevents duplicate entries in the same day.
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

// ═══════════════════════════════════════════════════════════════════════
// Early Leave Detection
// ═══════════════════════════════════════════════════════════════════════

/**
 * Updates an attendance log's session exit status and last verification time.
 * Used when a student leaves a class before it ends.
 * @param {number} logId - The attendance_log ID to update
 * @param {string} status - 'Completed' or 'Left Early'
 */
export const updateAttendanceExitStatus = (logId, status) => {
  try {
    const now = new Date().toISOString();
    db.runSync(
      `UPDATE attendance_logs SET session_end_status = ?, last_verified_at = ? WHERE id = ?`,
      [status, now, logId]
    );
    console.log(`Attendance log ${logId} updated: ${status}`);
  } catch (error) {
    console.error("Error updating exit status:", error);
    throw error;
  }
};

/**
 * Updates the last_verified_at timestamp for an attendance log.
 * Called periodically by the background engine during ongoing classes.
 * @param {number} logId - The attendance_log ID
 */
export const updateLastVerified = (logId) => {
  try {
    const now = new Date().toISOString();
    db.runSync(
      `UPDATE attendance_logs SET last_verified_at = ? WHERE id = ?`,
      [now, logId]
    );
  } catch (error) {
    console.error("Error updating last verified:", error);
  }
};

/**
 * Gets the most recent attendance log for a class on a given date.
 * @param {number} classId
 * @param {string} date
 * @returns {object|null}
 */
export const getAttendanceLog = (classId, date) => {
  try {
    return db.getFirstSync(
      `SELECT * FROM attendance_logs WHERE class_id = ? AND date = ? ORDER BY id DESC`,
      [classId, date]
    ) || null;
  } catch (error) {
    console.error("Error fetching attendance log:", error);
    return null;
  }
};
