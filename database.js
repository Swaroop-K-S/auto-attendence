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
