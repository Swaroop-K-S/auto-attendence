/**
 * Gemini Vision API utility for parsing timetable images.
 * Uses Google's Gemini 2.0 Flash model (free tier) to extract
 * structured class data from timetable screenshots.
 */

// ⚠️ IMPORTANT: Replace this with your actual Gemini API key
// Get one free at: https://aistudio.google.com/apikey
const GEMINI_API_KEY = 'AIzaSyC6C5Qg28eX1WS2w-a5gIDY91ogPkxBZ8o';

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const TIMETABLE_PROMPT = `You are a timetable extraction assistant. Analyze this image of a class/university timetable and extract ALL classes you can find.

Return ONLY a valid JSON array. Each object must have these exact keys:
- "name": The class/subject name (string)
- "day": The day of the week, fully spelled out like "Monday", "Tuesday", etc. (string)
- "start_time": Start time in 24-hour "HH:mm" format (string)
- "end_time": End time in 24-hour "HH:mm" format (string)  
- "room": The room number or location if visible, otherwise empty string (string)
- "type": Either "lab" or "theory" (string). Use these rules to classify:
  * "lab" — if the name contains keywords like: Lab, Practical, P-, L-, Workshop, Studio, Sessional, or if the room mentions "Lab"
  * "theory" — for all other classes (lectures, tutorials, seminars)
  * When in doubt, default to "theory"

Example output:
[
  {"name": "Computer Networks", "day": "Monday", "start_time": "09:00", "end_time": "10:00", "room": "B108", "type": "theory"},
  {"name": "Machine Learning Lab", "day": "Monday", "start_time": "11:15", "end_time": "13:15", "room": "Lab B1", "type": "lab"},
  {"name": "P-Data Structures", "day": "Tuesday", "start_time": "14:00", "end_time": "16:00", "room": "CS Lab 2", "type": "lab"}
]

IMPORTANT RULES:
1. Return ONLY the JSON array, no markdown, no explanation, no code fences.
2. If time is in 12-hour format, convert to 24-hour.
3. Extract every single class from every day visible in the timetable.
4. If a class spans multiple days, create separate entries for each day.
5. If you cannot read a field clearly, make your best guess.
6. Pay special attention to classifying labs correctly — labs typically have longer durations (2-3 hours) and contain keywords listed above.`;

/**
 * Sends a base64 image to Gemini Vision API and returns parsed timetable data.
 * @param {string} base64Image - The base64-encoded image data
 * @param {string} mimeType - The MIME type of the image (e.g., 'image/jpeg', 'image/png')
 * @returns {Array} Array of class objects
 */
export async function parseTimetableImage(base64Image, mimeType = 'image/jpeg') {
  if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('Please set your Gemini API key in geminiAPI.js. Get one free at https://aistudio.google.com/apikey');
  }

  const requestBody = {
    contents: [
      {
        parts: [
          { text: TIMETABLE_PROMPT },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
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

  // Extract the text response
  const textContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('Gemini returned an empty response. Please try with a clearer image.');
  }

  // Clean the response (remove markdown code fences if any)
  let cleanedText = textContent.trim();
  cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Parse JSON
  let classes;
  try {
    classes = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error('Raw Gemini response:', textContent);
    throw new Error('Could not parse the AI response. The image may be unclear. Try a sharper photo or use manual entry.');
  }

  // Validate the structure
  if (!Array.isArray(classes) || classes.length === 0) {
    throw new Error('No classes found in the image. Make sure the timetable is clearly visible.');
  }

  // Normalize and validate each class entry
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  // Keywords that indicate a lab/practical class
  const labKeywords = /\b(lab|practical|p-|l-|workshop|studio|sessional)\b/i;

  return classes.map((cls, index) => {
    const name = cls.name || `Class ${index + 1}`;
    const day = validDays.find(d => d.toLowerCase() === (cls.day || '').toLowerCase()) || 'Monday';
    const start_time = timeRegex.test(cls.start_time) ? cls.start_time : '09:00';
    const end_time = timeRegex.test(cls.end_time) ? cls.end_time : '10:00';
    const room = cls.room || '';

    // Determine class type: trust AI response, but validate & fallback
    let type = 'theory';
    if (cls.type === 'lab' || cls.type === 'theory') {
      type = cls.type;
    } else if (labKeywords.test(name) || labKeywords.test(room)) {
      type = 'lab';
    }

    return { name, day, start_time, end_time, room, type };
  });
}

const ACADEMIC_CALENDAR_PROMPT = `Analyze this document which is a college annual calendar. Extract every significant date, holiday, exam start date, and college fest. 

When analyzing the annual calendar, pay special attention to:
- Internals: Look for keywords like 'CIE', 'Internals', 'Mid-Term', or 'IA'.
- Semester Boundaries: Identify 'Commencement of Classes' (Semester Start) and 'Last Working Day' (Semester End).

Return Format: Ensure these are categorized in the JSON output under a "type" field using the tags: "internal_exam", "semester_start", or "semester_end". 
For other events, use "holiday", "exam", or "college_event".

Return the data as a clean JSON array: 
[
  {"title": "Diwali", "date": "2026-11-01", "type": "holiday"}, 
  {"title": "Commencement of Classes", "date": "2026-08-01", "type": "semester_start"},
  {"title": "Internal Assessment 1", "date": "2026-09-15", "type": "internal_exam"},
  {"title": "Last Working Day", "date": "2026-12-10", "type": "semester_end"}
]

IMPORTANT RULES:
1. Return ONLY the JSON array, no markdown, no explanation, no code fences.
2. Ensure dates are strictly YYYY-MM-DD. If year is not mentioned, infer it from the calendar context.
3. If it's a date range, include it as multiple single days OR just the start date if multiple days is too complex, prefer multiple individual days.`;

/**
 * Sends a base64 image of an academic calendar to Gemini Vision API and returns parsed events.
 * @param {string} base64Image - The base64-encoded image data
 * @param {string} mimeType - The MIME type of the image
 * @returns {Array} Array of event objects
 */
export async function parseAnnualCalendar(base64Image, mimeType = 'image/jpeg') {
  if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('Please set your Gemini API key in geminiAPI.js.');
  }

  const requestBody = {
    contents: [{
      parts: [
        { text: ACADEMIC_CALENDAR_PROMPT },
        { inlineData: { mimeType: mimeType, data: base64Image } }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
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

  if (!textContent) throw new Error('Gemini returned an empty response.');

  let cleanedText = textContent.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '');

  let events;
  try {
    events = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error('Raw Gemini response:', textContent);
    throw new Error('Could not parse the AI response. Please ensure the image is clear.');
  }

  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('No events found in the image. Make sure the calendar is clearly visible.');
  }

  return events;
}
