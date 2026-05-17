const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = 8000;
const TEMPERATURE = 0.3;
const MAX_PARSE_ATTEMPTS = 2;

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

function buildRoadmapPrompt(answers) {
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
1. Calculate realistic total weeks:
   - Beginner + 3-5hrs/week = 20-24 weeks
   - Beginner + 10-15hrs/week = 14-18 weeks
   - Intermediate + 5-10hrs/week = 12-16 weeks
   - Intermediate + 15+hrs/week = 8-12 weeks

2. Each week = ONE focused topic

3. Every week MUST have a mini project with VISIBLE output
   - Not "practice variables" → "Build a tip calculator"
   - Not "learn loops" → "Build a times table generator"
   - User must be able to screenshot the result

4. Difficulty increases gradually — never jump too fast

5. Weeks 3-5 are the danger zone where most people quit
   - Add extra encouragement notes there
   - Make those weeks slightly easier

6. If user quit before due to something being hard:
   - Add a support week before that topic
   - Include alternative explanation

7. All explanations in simple, beginner-friendly English
   - Assume zero prior knowledge
   - Use analogies and real-world examples
   - Avoid jargon unless you explain it

8. Mobile-friendly projects
   - 60% of users are on phones
   - Projects must work in browser, no complex setup

9. Include fill-in-the-blanks version for mobile users

RETURN ONLY VALID JSON ARRAY (no markdown, no explanation):

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

function parseRoadmapJson(text) {
  const cleaned = stripJsonWrappers(text);
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    const error = new Error('Gemini roadmap response must be a JSON array.');
    error.status = 502;
    error.publicMessage = 'The AI returned an invalid roadmap format. Please try again.';
    throw error;
  }

  validateRoadmap(parsed);

  return parsed;
}

function validateRoadmap(roadmap) {
  if (roadmap.length < 8 || roadmap.length > 24) {
    const error = new Error('Gemini roadmap response must include 8 to 24 weeks.');
    error.status = 502;
    error.publicMessage = 'The AI returned a roadmap with an invalid length. Please try again.';
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

async function generateRoadmap(onboardingAnswers) {
  const prompt = buildRoadmapPrompt(onboardingAnswers);
  let lastError;

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt += 1) {
    try {
      const responseText = await callGemini(prompt);
      return parseRoadmapJson(responseText);
    } catch (err) {
      lastError = toPublicGeminiError(err);

      if (!isRetryableGenerationError(lastError) || attempt >= MAX_PARSE_ATTEMPTS) {
        break;
      }

      console.warn(`Gemini roadmap parse failed on attempt ${attempt}. Retrying once.`);
    }
  }

  console.error('Gemini roadmap generation failed:', lastError.message);

  const error = new Error(lastError.publicMessage || 'Roadmap generation failed. Please try again.');
  error.status = lastError.status || 502;
  throw error;
}

module.exports = {
  generateRoadmap,
};
