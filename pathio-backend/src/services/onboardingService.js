const { PrismaClient } = require('@prisma/client');
const roadmapService = require('./roadmapService');

const prisma = new PrismaClient();

const EXPERIENCE_OPTIONS = [
  'Never touched code',
  'Tried a tutorial or two',
  'Know some basics',
  'Built something small',
];

const HOUR_OPTIONS = ['3-5 hours', '5-10 hours', '10-15 hours', '15+ hours'];
const DAY_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME_OPTIONS = ['morning', 'afternoon', 'evening', 'night'];

function buildQuestion(questionNum, overrides = {}) {
  const questions = {
    1: {
      questionNum: 1,
      key: 'goal',
      type: 'text',
      question: "What do you want to be able to do in 6 months that you can't do today?",
    },
    3: {
      questionNum: 3,
      key: 'hours_per_week',
      type: 'single_choice',
      question: "How many hours per week can you realistically dedicate to learning? Be honest — we'll build your plan around this.",
      options: HOUR_OPTIONS,
    },
    4: {
      questionNum: 4,
      key: 'previous_stop',
      type: 'text',
      question: 'Have you tried learning to code before? If yes, what made you stop?',
      placeholder: 'Example: Got stuck and had no one to ask',
    },
    5: {
      questionNum: 5,
      key: 'schedule',
      type: 'schedule',
      question: 'What days and times work best for you to learn?',
      days: DAY_OPTIONS,
      times: TIME_OPTIONS,
    },
  };

  return { ...questions[questionNum], ...overrides };
}

function detectGoalCategory(goal = '') {
  const normalizedGoal = String(goal).toLowerCase();

  if (/\b(web|website|html|css|frontend|front-end|javascript|react)\b/.test(normalizedGoal)) {
    return 'webdev';
  }

  if (/\b(python|data|ai|machine learning|ml|analytics)\b/.test(normalizedGoal)) {
    return 'python';
  }

  if (/\b(app|mobile|android|ios|flutter|react native)\b/.test(normalizedGoal)) {
    return 'mobile';
  }

  return 'other';
}

function buildDynamicQuestionTwo(goal) {
  const category = detectGoalCategory(goal);
  const questionByCategory = {
    webdev: 'Have you written any HTML or CSS before?',
    python: 'Have you written any Python before?',
    mobile: 'Have you built any app before?',
    other: 'Have you written any code before?',
  };

  return {
    questionNum: 2,
    key: 'current_level',
    type: 'single_choice',
    question: questionByCategory[category],
    options: EXPERIENCE_OPTIONS,
    goalCategory: category,
  };
}

function mapExperienceToLevel(answer) {
  const normalizedAnswer = String(answer).toLowerCase();

  if (normalizedAnswer.includes('built something')) {
    return 'advanced';
  }

  if (normalizedAnswer.includes('know some')) {
    return 'intermediate';
  }

  return 'beginner';
}

function mapHoursToNumber(answer) {
  const normalizedAnswer = String(answer).toLowerCase().trim();

  if (normalizedAnswer.includes('15+')) return 20;
  if (normalizedAnswer.includes('10-15')) return 15;
  if (normalizedAnswer.includes('5-10')) return 10;
  if (normalizedAnswer.includes('3-5')) return 5;

  const parsed = Number.parseInt(normalizedAnswer, 10);
  if ([5, 10, 15, 20].includes(parsed)) return parsed;

  const error = new Error('Choose a valid weekly time option.');
  error.status = 400;
  throw error;
}

function normalizeSchedule(answer) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
    const error = new Error('Schedule answer must include preferredDays and preferredTime.');
    error.status = 400;
    throw error;
  }

  const preferredDays = Array.isArray(answer.preferredDays) ? answer.preferredDays : [];
  const normalizedDays = preferredDays.map((day) => String(day).toLowerCase().trim());
  const invalidDay = normalizedDays.find((day) => !DAY_OPTIONS.includes(day));

  if (normalizedDays.length === 0 || invalidDay) {
    const error = new Error('Choose at least one valid learning day.');
    error.status = 400;
    throw error;
  }

  const preferredTime = String(answer.preferredTime || '').toLowerCase().trim();
  if (!TIME_OPTIONS.includes(preferredTime)) {
    const error = new Error('Choose a valid preferred learning time.');
    error.status = 400;
    throw error;
  }

  return {
    preferredDays: normalizedDays,
    preferredTime,
    timezone: answer.timezone || 'UTC',
  };
}

async function getLatestOnboarding(userId) {
  return prisma.onboardingAnswer.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

async function getDraftOnboarding(userId) {
  return prisma.onboardingAnswer.findFirst({
    where: {
      userId,
      completedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function startOnboarding(userId) {
  const existingDraft = await getDraftOnboarding(userId);

  return {
    session: existingDraft
      ? { id: existingDraft.id, status: 'in_progress' }
      : { id: null, status: 'not_started' },
    question: buildQuestion(1),
  };
}

async function saveAnswer(userId, questionNum, answer) {
  switch (Number(questionNum)) {
    case 1: {
      const goal = String(answer || '').trim();
      if (!goal) {
        const error = new Error('Goal is required.');
        error.status = 400;
        throw error;
      }

      const category = detectGoalCategory(goal);
      const existingDraft = await getDraftOnboarding(userId);

      if (existingDraft) {
        return prisma.onboardingAnswer.update({
          where: { id: existingDraft.id },
          data: {
            goal,
            goalCategory: category,
          },
        });
      }

      return prisma.onboardingAnswer.create({
        data: {
          userId,
          goal,
          goalCategory: category,
          currentLevel: 'beginner',
          hoursPerWeek: 5,
          preferredDays: [],
          preferredTime: 'evening',
          timezone: 'UTC',
        },
      });
    }

    case 2: {
      const draft = await getDraftOrThrow(userId);
      return prisma.onboardingAnswer.update({
        where: { id: draft.id },
        data: {
          goalCategory: detectGoalCategory(draft.goal),
          currentLevel: mapExperienceToLevel(answer),
        },
      });
    }

    case 3: {
      const draft = await getDraftOrThrow(userId);
      return prisma.onboardingAnswer.update({
        where: { id: draft.id },
        data: { hoursPerWeek: mapHoursToNumber(answer) },
      });
    }

    case 4: {
      const draft = await getDraftOrThrow(userId);
      return prisma.onboardingAnswer.update({
        where: { id: draft.id },
        data: { previousStop: String(answer || '').trim() || null },
      });
    }

    case 5: {
      const draft = await getDraftOrThrow(userId);
      const schedule = normalizeSchedule(answer);

      return prisma.onboardingAnswer.update({
        where: { id: draft.id },
        data: schedule,
      });
    }

    default: {
      const error = new Error('questionNum must be between 1 and 5.');
      error.status = 400;
      throw error;
    }
  }
}

async function getDraftOrThrow(userId) {
  const draft = await getDraftOnboarding(userId);

  if (!draft) {
    const error = new Error('Start onboarding before answering this question.');
    error.status = 400;
    throw error;
  }

  return draft;
}

async function getNextQuestion(userId, currentQuestionNum, currentAnswer) {
  const questionNum = Number(currentQuestionNum);

  if (questionNum === 1) {
    return buildDynamicQuestionTwo(currentAnswer);
  }

  if (questionNum >= 2 && questionNum <= 4) {
    return buildQuestion(questionNum + 1);
  }

  if (questionNum === 5) {
    return null;
  }

  const error = new Error('questionNum must be between 1 and 5.');
  error.status = 400;
  throw error;
}

async function completeOnboarding(userId) {
  const draft = await getDraftOrThrow(userId);

  const completed = await prisma.onboardingAnswer.update({
    where: { id: draft.id },
    data: { completedAt: new Date() },
  });

  try {
    const roadmap = await roadmapService.generateAndSaveRoadmap(userId);

    return {
      onboarding: completed,
      roadmapGeneration: {
        status: 'generated',
        roadmapId: roadmap.id,
        message: 'Roadmap generated successfully.',
      },
    };
  } catch (err) {
    console.error('Roadmap generation failed after onboarding completion:', err.message);

    const error = new Error('Onboarding is complete, but roadmap generation failed. Please retry.');
    error.status = err.status || 502;
    error.onboarding = completed;
    error.roadmapGeneration = {
      status: 'failed',
      message: 'Roadmap generation failed. Please try again.',
    };
    throw error;
  }
}

async function getStatus(requestingUserId, targetUserId) {
  if (requestingUserId !== targetUserId) {
    const error = new Error('You can only view your own onboarding status.');
    error.status = 403;
    throw error;
  }

  const onboarding = await getLatestOnboarding(targetUserId);

  if (!onboarding) {
    return {
      started: false,
      completed: false,
      currentQuestionNum: 1,
      question: buildQuestion(1),
    };
  }

  const completed = Boolean(onboarding.completedAt);

  return {
    started: true,
    completed,
    onboardingId: onboarding.id,
    currentQuestionNum: completed ? null : inferCurrentQuestionNum(onboarding),
    completedAt: onboarding.completedAt,
  };
}

function inferCurrentQuestionNum(onboarding) {
  if (!onboarding.goal) return 1;
  if (!onboarding.currentLevel) return 2;
  if (!onboarding.hoursPerWeek) return 3;
  if (!onboarding.previousStop) return 4;
  if (!onboarding.preferredDays.length || !onboarding.preferredTime) return 5;
  return 5;
}

module.exports = {
  startOnboarding,
  saveAnswer,
  getNextQuestion,
  completeOnboarding,
  getStatus,
};
