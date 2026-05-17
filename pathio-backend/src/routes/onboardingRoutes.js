const express = require('express');
const { body, param } = require('express-validator');
const onboardingController = require('../controllers/onboardingController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

const answerValidators = [
  body('questionNum')
    .isInt({ min: 1, max: 5 })
    .withMessage('questionNum must be between 1 and 5.'),
  body('answer')
    .custom((value, { req }) => {
      if (Number(req.body.questionNum) === 5) {
        return value && typeof value === 'object' && !Array.isArray(value);
      }

      return typeof value === 'string' && value.trim().length > 0;
    })
    .withMessage('Answer is required.'),
];

const statusValidators = [
  param('userId').isUUID().withMessage('Valid userId required.'),
];

router.use(protect);

router.post('/start', onboardingController.start);
router.post('/answer', answerValidators, onboardingController.answer);
router.get('/status/:userId', statusValidators, onboardingController.status);

module.exports = router;
