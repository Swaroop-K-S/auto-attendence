/**
 * Gemini Vision API utility for parsing academic documents.
 * Uses Google's Gemini 2.0 Flash model (free tier) to extract
 * structured data from timetables, calendars, and fest schedules.
 *
 * Supports: image/jpeg, image/png, application/pdf
 */

// ⚠️ IMPORTANT: Replace this with your actual Gemini API key
// Get one free at: https://aistudio.google.com/apikey
const GEMINI_API_KEY = 'AIzaSyC6C5Qg28eX1WS2w-a5gIDY91ogPkxBZ8o';

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// ═══════════════════════════════════════════════════════════════════════
// MIME Type Resolution
// ═══════════════════════════════════════════════════════════════════════

/**
 * Resolves the MIME type from a file URI or picker result.
 * Supports JPEG, PNG, and PDF. Defaults to image/jpeg.
 * @param {string} uri - The file URI
 * @param {string|null} pickerMime - MIME type from the picker, if available
 * @returns {string} Resolved MIME type
 */
export function resolveMimeType(uri = '', pickerMime = null) {
  if (pickerMime && ['image/jpeg', 'image/png', 'application/pdf'].includes(pickerMime)) {
    return pickerMime;
  }
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

// ═══════════════════════════════════════════════════════════════════════
// Shared API Call Helper
// ═══════════════════════════════════════════════════════════════════════

/**
 * Core function: sends base64 data + prompt to Gemini and returns parsed JSON array.
 * @param {string} prompt - The system prompt
 * @param {string} base64Data - The base64-encoded file data
 * @param {string} mimeType - MIME type of the uploaded file
 * @param {string} errorContext - Context label for error messages
 * @returns {Array} Parsed JSON array from Gemini
 */
async function callGemini(prompt, base64Data, mimeType, errorContext = 'document') {
  if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('Please set your Gemini API key in geminiAPI.js. Get one free at https://aistudio.google.com/apikey');
  }

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error (${response.status}): ${errorData?.error?.message || 'Unknown error'}`);
  }

  const result = await response.json();
  const textContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error(`Gemini returned an empty response for ${errorContext}. Please try with a clearer image.`);
  }

  // Clean markdown fences
  let cleanedText = textContent.trim();
  cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  let parsed;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error(`Raw Gemini response (${errorContext}):`, textContent);
    throw new Error(`Could not parse the AI response for ${errorContext}. The document may be unclear.`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`No data found in the ${errorContext}. Make sure the document is clearly visible.`);
  }

  return parsed;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. TIMETABLE PARSER
// ═══════════════════════════════════════════════════════════════════════

const TIMETABLE_PROMPT = `You are a highly precise timetable extraction assistant. Analyze this academic document (which may be a screenshot, PDF page, or blurry photo) of a class/university timetable and extract ALL classes you can find.

Return ONLY a valid JSON array. Each object must have these exact keys. If a field is completely illegible due to blur or crop, mark its value as null for manual user correction later.
- "name": The class/subject name (string)
- "day": The day of the week, fully spelled out like "Monday", "Tuesday", etc. (string)
- "start_time": Start time in 24-hour "HH:mm" format (string)
- "end_time": End time in 24-hour "HH:mm" format (string)  
- "room": The room number or location if visible, otherwise empty string (string) or null if illegible
- "type": Either "lab" or "theory" (string). Use these rules to classify:
  * "lab" — if the name contains keywords like: Lab, Practical, P-, L-, Workshop, Studio, Sessional, or if the room mentions "Lab"
  * "theory" — for all other classes (lectures, tutorials, seminars)
  * When in doubt, default to "theory"

Example output:
[
  {"name": "Computer Networks", "day": "Monday", "start_time": "09:00", "end_time": "10:00", "room": "B108", "type": "theory"},
  {"name": null, "day": "Tuesday", "start_time": "14:00", "end_time": "16:00", "room": "CS Lab 2", "type": "lab"}
]

IMPORTANT RULES:
1. Return ONLY the JSON array, no markdown, no explanation, no code fences.
2. If time is in 12-hour format, convert to 24-hour.
3. Extract every single class from every day visible in the timetable.
4. If a class spans multiple days, create separate entries for each day.
5. If you cannot read a field clearly, mark it as null rather than making wild guesses.
6. Pay special attention to classifying labs correctly — labs typically have longer durations (2-3 hours) and contain keywords listed above.`;

/**
 * Parses a timetable document and returns structured class data.
 * @param {string} base64Image - The base64-encoded file data
 * @param {string} mimeType - MIME type (image/jpeg, image/png, application/pdf)
 * @returns {Array} Array of class objects { name, day, start_time, end_time, room, type }
 */
export async function parseTimetableImage(base64Image, mimeType = 'image/jpeg') {
  const classes = await callGemini(TIMETABLE_PROMPT, base64Image, mimeType, 'timetable');

  // Normalize and validate each class entry
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const labKeywords = /\b(lab|practical|p-|l-|workshop|studio|sessional)\b/i;

  return classes.map((cls, index) => {
    const name = cls.name || `Class ${index + 1}`;
    const day = validDays.find(d => d.toLowerCase() === (cls.day || '').toLowerCase()) || 'Monday';
    const start_time = timeRegex.test(cls.start_time) ? cls.start_time : '09:00';
    const end_time = timeRegex.test(cls.end_time) ? cls.end_time : '10:00';
    const room = cls.room || '';

    let type = 'theory';
    if (cls.type === 'lab' || cls.type === 'theory') {
      type = cls.type;
    } else if (labKeywords.test(name) || labKeywords.test(room)) {
      type = 'lab';
    }

    return { name, day, start_time, end_time, room, type };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 2. ACADEMIC CALENDAR PARSER (Semester dates, Exams)
// ═══════════════════════════════════════════════════════════════════════

const ACADEMIC_CALENDAR_PROMPT = `Analyze this academic document (which may be a screenshot, PDF page, or blurry photo) which represents a college annual calendar. Extract every significant date related to the ACADEMIC SCHEDULE: semester start/end, internal exams, final exams, and administrative dates.

When analyzing the annual calendar, pay special attention to:
- Internals: Look for keywords like 'CIE', 'Internals', 'Mid-Term', or 'IA'.
- Semester Boundaries: Identify 'Commencement of Classes' (Semester Start) and 'Last Working Day' (Semester End).
- Final Exams: Look for 'SEE', 'End Semester', 'University Exam'.

Return Format: Ensure these are categorized in the JSON output under a "type" field using the tags: "internal_exam", "semester_start", "semester_end", or "exam".

Return the data as a clean JSON array with high precision. If a title or specific date is completely illegible due to blur, mark it as null for manual user correction.
[
  {"title": "Commencement of Classes", "date": "2026-08-01", "type": "semester_start"},
  {"title": "Internal Assessment 1", "date": "2026-09-15", "type": "internal_exam"},
  {"title": "End Semester Exams", "date": "2026-12-01", "type": "exam"},
  {"title": null, "date": "2026-12-10", "type": "semester_end"}
]

IMPORTANT RULES:
1. Return ONLY the JSON array, no markdown, no explanation, no code fences.
2. Ensure dates are strictly YYYY-MM-DD. If year is not mentioned, infer it from the calendar context.
3. If it's a date range, include it as multiple single days OR just the start date.
4. If a field is completely illegible, set its value to null.
5. Focus on ACADEMIC milestones, not holidays or festivals (those are handled separately).`;

/**
 * Parses an academic calendar to extract semester dates, exam weeks, and milestones.
 * @param {string} base64Image - The base64-encoded file data
 * @param {string} mimeType - MIME type
 * @returns {Array} Array of academic event objects { title, date, type }
 */
export async function parseAcademicCalendar(base64Image, mimeType = 'image/jpeg') {
  const events = await callGemini(ACADEMIC_CALENDAR_PROMPT, base64Image, mimeType, 'academic calendar');

  return events.map(evt => ({
    title: evt.title || 'Unknown Academic Event',
    date: evt.date || new Date().toISOString().split('T')[0],
    type: evt.type || 'college_event',
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// 3. FEST / HOLIDAY CALENDAR PARSER
// ═══════════════════════════════════════════════════════════════════════

const FEST_HOLIDAY_PROMPT = `Analyze this academic document (which may be a screenshot, PDF page, or blurry photo) and extract ALL holidays, festivals, and college fest dates.

Focus ONLY on:
- National Holidays (Republic Day, Independence Day, Gandhi Jayanti, etc.)
- Religious Festivals (Diwali, Eid, Christmas, Holi, Ugadi, Pongal, etc.)
- College Fests and Cultural Events
- University-declared holidays

Return the data as a clean JSON array:
[
  {"title": "Republic Day", "date": "2026-01-26", "type": "holiday"},
  {"title": "Diwali", "date": "2026-11-01", "type": "holiday"},
  {"title": "College Tech Fest", "date": "2026-02-15", "type": "college_event"}
]

IMPORTANT RULES:
1. Return ONLY the JSON array, no markdown, no explanation, no code fences.
2. Ensure dates are strictly YYYY-MM-DD.
3. Use "type": "holiday" for national/religious holidays, and "type": "college_event" for fests.
4. If it's a multi-day festival, create separate entries for each day.
5. If a field is completely illegible, set its value to null.
6. Do NOT include academic milestones like semester start/end or exam dates — only holidays and fests.`;

/**
 * Parses a fest/holiday calendar to extract one-off holidays and festivals.
 * @param {string} base64Image - The base64-encoded file data
 * @param {string} mimeType - MIME type
 * @returns {Array} Array of holiday/fest objects { title, date, type }
 */
export async function parseFestCalendar(base64Image, mimeType = 'image/jpeg') {
  const events = await callGemini(FEST_HOLIDAY_PROMPT, base64Image, mimeType, 'fest/holiday calendar');

  return events.map(evt => ({
    title: evt.title || 'Unknown Holiday',
    date: evt.date || new Date().toISOString().split('T')[0],
    type: evt.type === 'college_event' ? 'college_event' : 'holiday',
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// Legacy alias — kept for backward compatibility with LoginScreen
// ═══════════════════════════════════════════════════════════════════════
export async function parseAnnualCalendar(base64Image, mimeType = 'image/jpeg') {
  // The legacy function extracts BOTH academic + holiday events from a single document
  const COMBINED_PROMPT = `Analyze this academic document (which may be a screenshot, PDF page, or blurry photo) which represents a college annual calendar. Extract every significant date, holiday, exam start date, and college fest. 

When analyzing the annual calendar, pay special attention to:
- Internals: Look for keywords like 'CIE', 'Internals', 'Mid-Term', or 'IA'.
- Semester Boundaries: Identify 'Commencement of Classes' (Semester Start) and 'Last Working Day' (Semester End).

Return Format: Ensure these are categorized in the JSON output under a "type" field using the tags: "internal_exam", "semester_start", or "semester_end". 
For other events, use "holiday", "exam", or "college_event".

Return the data as a clean JSON array with high precision. If a title or specific date is completely illegible due to blur, mark it as null for manual user correction.
[
  {"title": "Diwali", "date": "2026-11-01", "type": "holiday"}, 
  {"title": "Commencement of Classes", "date": "2026-08-01", "type": "semester_start"},
  {"title": "Internal Assessment 1", "date": "2026-09-15", "type": "internal_exam"},
  {"title": null, "date": "2026-12-10", "type": "semester_end"}
]

IMPORTANT RULES:
1. Return ONLY the JSON array, no markdown, no explanation, no code fences.
2. Ensure dates are strictly YYYY-MM-DD. If year is not mentioned, infer it from the calendar context.
3. If it's a date range, include it as multiple single days OR just the start date if multiple days is too complex, prefer multiple individual days.
4. If a field is completely illegible, set its value to null.`;

  const events = await callGemini(COMBINED_PROMPT, base64Image, mimeType, 'annual calendar');

  return events.map(evt => ({
    title: evt.title || 'Unknown Event',
    date: evt.date || new Date().toISOString().split('T')[0],
    type: evt.type || 'college_event',
  }));
}
