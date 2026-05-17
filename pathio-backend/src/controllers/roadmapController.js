const { validationResult } = require('express-validator');
const roadmapService = require('../services/roadmapService');

async function generate(req, res, next) {
  try {
    const roadmap = await roadmapService.generateAndSaveRoadmap(req.user.userId);

    return res.status(200).json({
      success: true,
      data: {
        roadmapId: roadmap.id,
        roadmap,
      },
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function getRoadmap(req, res, next) {
  try {
    const roadmap = await roadmapService.getRoadmap(req.user.userId);

    if (!roadmap) {
      return res.status(404).json({
        success: false,
        message: 'Roadmap not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: { roadmap },
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function getStatus(req, res, next) {
  try {
    const status = await roadmapService.getRoadmapStatus(req.user.userId);

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function getCurrentWeek(req, res, next) {
  try {
    const week = await roadmapService.getCurrentWeek(req.user.userId);

    return res.status(200).json({
      success: true,
      data: { week },
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function getWeekById(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const week = await roadmapService.getWeekById(req.params.weekId, req.user.userId);

    return res.status(200).json({
      success: true,
      data: { week },
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

module.exports = {
  generate,
  getRoadmap,
  getStatus,
  getCurrentWeek,
  getWeekById,
};
