const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = 16384;
const TEMPERATURE = 0.2;
const MAX_PARSE_ATTEMPTS = 3;
const MIN_WEEKS = 8;
const MAX_WEEKS = 10;

function isQuotaError(err) {
  const message = String(err?.message || '');
  return (
    err?.status === 429 ||
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('Quota exceeded') ||
    message.includes('RESOURCE_EXHAUSTED')
  );
}

function isRetryableGenerationError(err) {
  if (isQuotaError(err)) {
    return false;
  }

  if (err?.status === 401 || err?.status === 403 || err?.status === 500) {
    return false;
  }

  return true;
}

function toPublicGeminiError(err) {
  if (isQuotaError(err)) {
    const error = new Error(
      'AI quota reached for this API key. Wait a few minutes, switch GEMINI_MODEL in .env (e.g. gemini-2.5-flash), or use a new key from Google AI Studio.'
    );
    error.status = 429;
    error.publicMessage = error.message;
    return error;
  }

  if (String(err?.message || '').includes('API key')) {
    const error = new Error('Gemini API key is missing or invalid.');
    error.status = 401;
    error.publicMessage = 'Roadmap generation is not configured. Check GEMINI_API_KEY in the backend .env file.';
    return error;
  }

  return err;
}

function getTargetWeekCount(answers) {
  const hours = Number(answers.hoursPerWeek || answers.hours_per_week || 5);
  const level = String(answers.currentLevel || answers.current_level || 'beginner').toLowerCase();

  if (level.includes('intermediate') && hours >= 10) {
    return MAX_WEEKS;
  }

  return MIN_WEEKS;
}

function buildRoadmapPrompt(answers, weekCount) {
  const preferredDays = Array.isArray(answers.preferredDays)
    ? answers.preferredDays.join(', ')
    : answers.preferredDays || 'Not specified';

  return `You are Pathio's Learn Agent — an AI mentor that builds personalized coding roadmaps.

USER PROFILE:
- Goal: ${answers.goal || 'Not specified'}
- Current level: ${answers.currentLevel || answers.current_level || 'beginner'}
- Hours per week: ${answers.hoursPerWeek || answers.hours_per_week || 'Not specified'}
- Preferred days: ${preferredDays}
- Previous quit reason: ${answers.previousStop || answers.previous_stop || 'Not specified'}
- Motivation: ${answers.motivation || 'Not specified'}

GENERATE A PERSONALIZED ROADMAP:

STRICT RULES:
1. Return EXACTLY ${weekCount} weeks (weekNumber 1 through ${weekCount}). No more, no less.

2. Each week = ONE focused topic aligned to the user's goal.

3. Every week MUST have a mini project with VISIBLE output in the browser.

4. Difficulty increases gradually. Weeks 3-5: add encouragementNote (short string).

5. Use simple beginner-friendly English. Keep explanation under 280 characters.

6. notebookCode and starterCode: max 12 lines, escape newlines as \\n, no unescaped quotes inside strings.

7. mobileFillBlanks must be a small object with template, blanks (array), explanation.

8. difficulty must be one of: easy, medium, hard

9. encouragementNote is null unless weeks 3-5, then a short string.

CRITICAL JSON RULES:
- Output ONLY a raw JSON array. No markdown fences.
- All string values must use double quotes with proper escaping.
- Do not truncate the response — complete all ${weekCount} weeks.

RETURN ONLY VALID JSON ARRAY:

[
  {
    "weekNumber": 1,
    "phase": "Foundation",
    "topicName": "HTML Structure",
    "whyItMatters": "Every website is built on HTML. Master this and you can build any page you see online.",
    "explanation": "HTML is the skeleton of a webpage. Think of it like building a house: HTML is the frame that holds everything up. CSS adds the paint and decoration (we'll learn that next week), and JavaScript makes things move (week 5). For now, we're just learning the structure.",
    "videoSearchQuery": "HTML basics for beginners visual tutorial 2024",
    "notebookCode": "<!DOCTYPE html>\\n<html>\\n<head>\\n  <title>My First Page</title>\\n</head>\\n<body>\\n  <h1>Hello World</h1>\\n  <p>This is my first webpage!</p>\\n</body>\\n</html>",
    "notebookLanguage": "html",
    "miniProject": "Build a personal bio page with your name, a photo placeholder, and 3 facts about yourself. Must be visible in a browser.",
    "starterCode": "<!DOCTYPE html>\\n<html>\\n<body>\\n  <!-- Add your bio here -->\\n</body>\\n</html>",
    "estimatedHours": 4,
    "difficulty": "easy",
    "encouragementNote": null,
    "mobileFillBlanks": {
      "template": "<__>Hello World</__>",
      "blanks": ["h1", "h1"],
      "explanation": "H1 creates the biggest heading on a page"
    }
  }
]`;
}

function buildRepairPrompt(answers, weekCount) {
  return `${buildRoadmapPrompt(answers, weekCount)}

IMPORTANT: Your previous response was invalid JSON. Regenerate from scratch.
Return exactly ${weekCount} complete week objects. Keep every string short. Valid JSON only.`;
}

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('Gemini API key is not configured.');
    error.status = 500;
    error.publicMessage = 'Roadmap generation is not configured yet. Please try again later.';
    throw error;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
    },
  });
}

function extractResponseText(result) {
  const text = result?.response?.text?.();

  if (!text || typeof text !== 'string') {
    const error = new Error('Gemini returned an empty roadmap response.');
    error.status = 502;
    error.publicMessage = 'The AI could not generate your roadmap. Please try again.';
    throw error;
  }

  return text;
}

function stripJsonWrappers(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  const firstArray = trimmed.indexOf('[');
  const lastArray = trimmed.lastIndexOf(']');

  if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
    return trimmed.slice(firstArray, lastArray + 1);
  }

  return trimmed;
}

function salvageWeekObjects(text) {
  const weeks = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        const chunk = text.slice(start, i + 1);
        if (chunk.includes('"weekNumber"')) {
          try {
            weeks.push(JSON.parse(chunk));
          } catch (_) {
            /* skip broken chunk */
          }
        }
        start = -1;
      }
    }
  }

  return weeks.length >= MIN_WEEKS ? weeks : null;
}

function parseRoadmapJson(text, expectedWeekCount) {
  const cleaned = stripJsonWrappers(text);
  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    parsed = salvageWeekObjects(cleaned);

    if (!parsed) {
      const error = new Error(parseErr.message);
      error.status = 502;
      error.publicMessage =
        'The AI returned incomplete data. Click Try again — generation usually succeeds on retry.';
      throw error;
    }

    console.warn(`Salvaged ${parsed.length} weeks from malformed Gemini JSON.`);
  }

  if (!Array.isArray(parsed)) {
    const error = new Error('Gemini roadmap response must be a JSON array.');
    error.status = 502;
    error.publicMessage = 'The AI returned an invalid roadmap format. Please try again.';
    throw error;
  }

  validateRoadmap(parsed, expectedWeekCount);

  return parsed;
}

function validateRoadmap(roadmap, expectedWeekCount) {
  if (roadmap.length < MIN_WEEKS || roadmap.length > MAX_WEEKS) {
    const error = new Error(`Gemini roadmap must include ${MIN_WEEKS} to ${MAX_WEEKS} weeks.`);
    error.status = 502;
    error.publicMessage = `The AI returned ${roadmap.length} weeks instead of ${expectedWeekCount}. Please try again.`;
    throw error;
  }

  roadmap.forEach((week, index) => {
    const requiredFields = [
      'weekNumber',
      'phase',
      'topicName',
      'whyItMatters',
      'explanation',
      'videoSearchQuery',
      'notebookCode',
      'notebookLanguage',
      'miniProject',
      'starterCode',
      'estimatedHours',
      'difficulty',
      'mobileFillBlanks',
    ];

    const missingField = requiredFields.find((field) => week[field] === undefined || week[field] === null);

    if (missingField) {
      const error = new Error(`Gemini roadmap week ${index + 1} is missing ${missingField}.`);
      error.status = 502;
      error.publicMessage = 'The AI returned an incomplete roadmap. Please try again.';
      throw error;
    }

    if (week.weekNumber !== index + 1) {
      const error = new Error(`Gemini roadmap week numbers must be sequential. Expected ${index + 1}.`);
      error.status = 502;
      error.publicMessage = 'The AI returned roadmap weeks out of order. Please try again.';
      throw error;
    }
  });
}

async function callGemini(prompt) {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    return extractResponseText(result);
  } catch (err) {
    throw toPublicGeminiError(err);
  }
}

function isJsonParseError(err) {
  const message = String(err?.message || '');
  return (
    message.includes('JSON') ||
    message.includes('Unexpected token') ||
    message.includes('Unterminated string')
  );
}

async function generateRoadmap(onboardingAnswers) {
  const weekCount = getTargetWeekCount(onboardingAnswers);
  let lastError;

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt += 1) {
    try {
      const prompt =
        attempt === 1
          ? buildRoadmapPrompt(onboardingAnswers, weekCount)
          : buildRepairPrompt(onboardingAnswers, weekCount);
      const responseText = await callGemini(prompt);
      return parseRoadmapJson(responseText, weekCount);
    } catch (err) {
      lastError = toPublicGeminiError(err);

      if (!isRetryableGenerationError(lastError) && !isJsonParseError(lastError)) {
        break;
      }

      if (attempt >= MAX_PARSE_ATTEMPTS) {
        break;
      }

      console.warn(`Gemini roadmap failed on attempt ${attempt}: ${lastError.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  console.error('Gemini roadmap generation failed:', lastError.message);

  const error = new Error(
    lastError.publicMessage || 'Roadmap generation failed. Please try again in a moment.'
  );
  error.status = lastError.status || 502;
  throw error;
}

module.exports = {
  generateRoadmap,
};
