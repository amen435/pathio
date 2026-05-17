require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const API_BASE_URL = process.env.PATHIO_API_BASE_URL || 'http://localhost:5000/api';
const TOKEN = process.env.PATHIO_TEST_TOKEN;

function log(message) {
  console.log(`[Pathio onboarding test] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  assert(parts.length >= 2, 'PATHIO_TEST_TOKEN is not a valid JWT.');

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${body.message || response.statusText}`);
  }

  return body;
}

async function answer(questionNum, value) {
  return apiFetch('/onboarding/answer', {
    method: 'POST',
    body: JSON.stringify({
      questionNum,
      answer: value,
    }),
  });
}

async function runFlow({ label, goal, expectedQ2, expectedCategory }) {
  log(`${label}: starting onboarding`);
  const started = await apiFetch('/onboarding/start', { method: 'POST' });

  assert(started.success === true, `${label}: start response should be successful.`);
  assert(started.data.question.questionNum === 1, `${label}: start should return Q1.`);
  assert(
    started.data.question.question === "What do you want to be able to do in 6 months that you can't do today?",
    `${label}: Q1 text did not match.`
  );
  log(`${label}: Q1 returned`);

  log(`${label}: answering Q1`);
  const q1 = await answer(1, goal);

  assert(q1.success === true, `${label}: Q1 answer should save.`);
  assert(q1.data.completed === false, `${label}: Q1 should not complete onboarding.`);
  assert(q1.data.nextQuestion.questionNum === 2, `${label}: Q1 should return Q2.`);
  assert(q1.data.nextQuestion.question === expectedQ2, `${label}: Q2 was not dynamic as expected.`);
  assert(q1.data.nextQuestion.goalCategory === expectedCategory, `${label}: Q2 goalCategory did not match.`);
  log(`${label}: dynamic Q2 verified`);

  log(`${label}: answering Q2`);
  const q2 = await answer(2, 'Tried a tutorial or two');
  assert(q2.data.nextQuestion.questionNum === 3, `${label}: Q2 should return Q3.`);

  log(`${label}: answering Q3`);
  const q3 = await answer(3, '5-10 hours');
  assert(q3.data.nextQuestion.questionNum === 4, `${label}: Q3 should return Q4.`);

  log(`${label}: answering Q4`);
  const q4 = await answer(4, 'I got stuck and had no one to ask.');
  assert(q4.data.nextQuestion.questionNum === 5, `${label}: Q4 should return Q5.`);

  log(`${label}: answering Q5`);
  const q5 = await answer(5, {
    preferredDays: ['monday', 'thursday'],
    preferredTime: 'evening',
    timezone: 'Africa/Nairobi',
  });

  assert(q5.success === true, `${label}: Q5 answer should save.`);
  assert(q5.data.completed === true, `${label}: Q5 should complete onboarding.`);
  assert(q5.data.onboarding.id, `${label}: completed response should include onboarding id.`);
  assert(q5.data.roadmapGeneration.status === 'pending', `${label}: roadmap generation stub should be pending.`);
  log(`${label}: onboarding completed`);

  const record = await prisma.onboardingAnswer.findUnique({
    where: { id: q5.data.onboarding.id },
  });

  assert(record, `${label}: onboarding_answers record not found in database.`);
  assert(record.userId === userId, `${label}: database userId did not match JWT userId.`);
  assert(record.goal === goal, `${label}: database goal did not match.`);
  assert(record.goalCategory === expectedCategory, `${label}: database goalCategory did not match.`);
  assert(record.currentLevel === 'beginner', `${label}: database currentLevel should map tutorial experience to beginner.`);
  assert(record.hoursPerWeek === 10, `${label}: database hoursPerWeek should map 5-10 hours to 10.`);
  assert(record.preferredDays.includes('monday'), `${label}: database preferredDays should include monday.`);
  assert(record.preferredDays.includes('thursday'), `${label}: database preferredDays should include thursday.`);
  assert(record.preferredTime === 'evening', `${label}: database preferredTime did not match.`);
  assert(record.timezone === 'Africa/Nairobi', `${label}: database timezone did not match.`);
  assert(record.previousStop === 'I got stuck and had no one to ask.', `${label}: database previousStop did not match.`);
  assert(record.completedAt instanceof Date, `${label}: completedAt should be a timestamp.`);
  log(`${label}: database record verified`);

  return record;
}

let userId;

async function main() {
  log('Preparing test');

  assert(TOKEN, 'Set PATHIO_TEST_TOKEN to a valid logged-in user JWT before running this test.');

  const payload = decodeJwtPayload(TOKEN);
  userId = payload.userId;
  assert(userId, 'JWT payload must include userId.');

  log(`Using API: ${API_BASE_URL}`);
  log(`Using userId from JWT: ${userId}`);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  assert(user, 'JWT userId was not found in the database.');
  log(`Database user found: ${user.email}`);

  const onboardingPagePath = path.join(__dirname, '..', 'onboarding.html');
  const onboardingPage = fs.readFileSync(onboardingPagePath, 'utf8');
  assert(
    onboardingPage.includes("window.location.href = 'roadmap.html'"),
    'onboarding.html should redirect to roadmap.html after completion.'
  );
  log('Frontend roadmap redirect verified in onboarding.html');

  await runFlow({
    label: 'Web dev path',
    goal: 'I want to build websites with HTML, CSS, and JavaScript.',
    expectedQ2: 'Have you written any HTML or CSS before?',
    expectedCategory: 'webdev',
  });

  await runFlow({
    label: 'Python path',
    goal: 'I want to learn Python for data and AI projects.',
    expectedQ2: 'Have you written any Python before?',
    expectedCategory: 'python',
  });

  log('All onboarding end-to-end tests passed.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[Pathio onboarding test] FAILED');
    console.error(err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
