const { PrismaClient } = require('@prisma/client');
const geminiService = require('./geminiService');
const serperSearch = require('../mcp/serperSearch');

const prisma = new PrismaClient();
const generationStatus = new Map();

function createHttpError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function mapRoadmapTitle(onboardingAnswers) {
  const categoryTitles = {
    webdev: 'Web Development Roadmap',
    python: 'Python Roadmap',
    data: 'Data Skills Roadmap',
    mobile: 'Mobile App Development Roadmap',
    other: 'Personalized Coding Roadmap',
  };

  return categoryTitles[onboardingAnswers.goalCategory] || 'Personalized Coding Roadmap';
}

function mapRoadmapPhase(weeks) {
  return weeks?.[0]?.phase || 'Foundation';
}

function normalizeDifficulty(difficulty) {
  const value = String(difficulty || 'easy').toLowerCase();
  return ['easy', 'medium', 'hard'].includes(value) ? value : 'easy';
}

function normalizeNotebookLanguage(language) {
  const value = String(language || 'javascript').toLowerCase();
  const allowed = ['javascript', 'python', 'html', 'css', 'sql'];
  return allowed.includes(value) ? value : 'javascript';
}

async function getCompletedOnboarding(userId) {
  const onboardingAnswers = await prisma.onboardingAnswer.findFirst({
    where: {
      userId,
      completedAt: { not: null },
    },
    orderBy: { completedAt: 'desc' },
  });

  if (!onboardingAnswers) {
    throw createHttpError('Complete onboarding before generating a roadmap.', 400);
  }

  return onboardingAnswers;
}

async function enrichWeeksWithVideos(generatedWeeks) {
  const enrichedWeeks = [];

  for (const week of generatedWeeks) {
    const video = await serperSearch.findBestVideo(week.videoSearchQuery, week.weekNumber);

    enrichedWeeks.push({
      ...week,
      videoUrl: video?.embedUrl || video?.url || null,
      videoTitle: video?.title || null,
      sourceVideoUrl: video?.url || null,
    });
  }

  return enrichedWeeks;
}

async function saveRoadmap(userId, onboardingAnswers, weeks) {
  return prisma.$transaction(async (tx) => {
    const roadmap = await tx.roadmap.create({
      data: {
        userId,
        title: mapRoadmapTitle(onboardingAnswers),
        totalWeeks: weeks.length,
        currentWeek: 1,
        phase: mapRoadmapPhase(weeks),
        weeks: {
          create: weeks.map((week, index) => ({
            weekNumber: week.weekNumber || index + 1,
            phase: week.phase || 'Foundation',
            topicName: week.topicName,
            whyItMatters: week.whyItMatters,
            explanation: week.explanation,
            videoUrl: week.videoUrl,
            videoTitle: week.videoTitle,
            notebookCode: week.notebookCode,
            notebookLanguage: normalizeNotebookLanguage(week.notebookLanguage),
            miniProject: week.miniProject,
            starterCode: week.starterCode,
            estimatedHours: Number(week.estimatedHours) || onboardingAnswers.hoursPerWeek || 4,
            difficulty: normalizeDifficulty(week.difficulty),
            encouragementNote: week.encouragementNote || null,
            mobileFillBlanks: week.mobileFillBlanks || null,
            status: index === 0 ? 'ACTIVE' : 'LOCKED',
            startedAt: index === 0 ? new Date() : null,
          })),
        },
      },
      include: {
        weeks: {
          orderBy: { weekNumber: 'asc' },
        },
      },
    });

    return roadmap;
  });
}

async function generateAndSaveRoadmap(userId) {
  generationStatus.set(userId, {
    status: 'generating',
    error: null,
    updatedAt: new Date(),
  });

  const existingRoadmap = await getRoadmap(userId);

  if (existingRoadmap) {
    generationStatus.set(userId, {
      status: 'generated',
      roadmapId: existingRoadmap.id,
      error: null,
      updatedAt: new Date(),
    });
    return existingRoadmap;
  }

  try {
    const onboardingAnswers = await getCompletedOnboarding(userId);
    const generatedWeeks = await geminiService.generateRoadmap(onboardingAnswers);
    const enrichedWeeks = await enrichWeeksWithVideos(generatedWeeks);
    const roadmap = await saveRoadmap(userId, onboardingAnswers, enrichedWeeks);

    generationStatus.set(userId, {
      status: 'generated',
      roadmapId: roadmap.id,
      error: null,
      updatedAt: new Date(),
    });

    return roadmap;
  } catch (err) {
    console.error('Roadmap generation failed:', err.message);

    const failureMessage =
      err.publicMessage || err.message || 'We could not generate your roadmap right now. Please try again.';

    generationStatus.set(userId, {
      status: 'failed',
      error: failureMessage,
      updatedAt: new Date(),
    });

    if (err.status) {
      err.message = failureMessage;
      throw err;
    }

    throw createHttpError(failureMessage, 502);
  }
}

async function getRoadmapStatus(userId) {
  const roadmap = await prisma.roadmap.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (roadmap) {
    return {
      generated: true,
      generating: false,
      failed: false,
      roadmapId: roadmap.id,
    };
  }

  const status = generationStatus.get(userId);

  if (status?.status === 'failed') {
    return {
      generated: false,
      generating: false,
      failed: true,
      roadmapId: null,
      message: status.error,
    };
  }

  return {
    generated: false,
    generating: status?.status === 'generating',
    failed: false,
    roadmapId: null,
  };
}

async function getRoadmap(userId) {
  return prisma.roadmap.findUnique({
    where: { userId },
    include: {
      weeks: {
        orderBy: { weekNumber: 'asc' },
      },
    },
  });
}

async function getCurrentWeek(userId) {
  const roadmap = await prisma.roadmap.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!roadmap) {
    throw createHttpError('Roadmap not found.', 404);
  }

  const currentWeek = await prisma.roadmapWeek.findFirst({
    where: {
      roadmapId: roadmap.id,
      status: 'ACTIVE',
    },
    orderBy: { weekNumber: 'asc' },
  });

  if (!currentWeek) {
    throw createHttpError('Active week not found.', 404);
  }

  return currentWeek;
}

async function getWeekById(weekId, userId) {
  const week = await prisma.roadmapWeek.findFirst({
    where: {
      id: weekId,
      roadmap: userId ? { userId } : undefined,
    },
    include: {
      roadmap: {
        select: {
          id: true,
          userId: true,
          title: true,
          totalWeeks: true,
          currentWeek: true,
        },
      },
    },
  });

  if (!week) {
    throw createHttpError('Week not found.', 404);
  }

  return week;
}

module.exports = {
  generateAndSaveRoadmap,
  getRoadmap,
  getRoadmapStatus,
  getCurrentWeek,
  getWeekById,
};
