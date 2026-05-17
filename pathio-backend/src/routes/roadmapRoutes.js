const express = require('express');
const { param } = require('express-validator');
const roadmapController = require('../controllers/roadmapController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/generate', roadmapController.generate);
router.get('/status', roadmapController.getStatus);
router.get('/', roadmapController.getRoadmap);
router.get('/current', roadmapController.getCurrentWeek);
router.get(
  '/week/:weekId',
  [param('weekId').isUUID().withMessage('Valid weekId required.')],
  roadmapController.getWeekById
);

module.exports = router;
