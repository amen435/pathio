const { validationResult } = require('express-validator');
const onboardingService = require('../services/onboardingService');

async function start(req, res, next) {
  try {
    const userId = req.user.userId;
    const result = await onboardingService.startOnboarding(userId);

    return res.status(200).json({
      success: true,
      message: 'Onboarding started',
      data: result,
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function answer(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const userId = req.user.userId;
    const { questionNum, answer: userAnswer } = req.body;

    const savedAnswer = await onboardingService.saveAnswer(userId, questionNum, userAnswer);

    if (Number(questionNum) === 5) {
      onboardingService.completeOnboarding(userId).catch((err) => {
        console.error('Background roadmap generation failed:', err.message);
      });

      return res.status(200).json({
        success: true,
        message: 'Roadmap is being generated',
        data: {
          completed: true,
          onboarding: savedAnswer,
          roadmapGeneration: {
            status: 'generating',
            message: 'Roadmap is being generated',
          },
        },
      });
    }

    const nextQuestion = await onboardingService.getNextQuestion(userId, questionNum, userAnswer);

    return res.status(200).json({
      success: true,
      message: 'Answer saved',
      data: {
        completed: false,
        onboarding: savedAnswer,
        nextQuestion,
      },
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function status(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const result = await onboardingService.getStatus(req.user.userId, req.params.userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

module.exports = {
  start,
  answer,
  status,
};
