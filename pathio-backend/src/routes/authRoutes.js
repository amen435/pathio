const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

// ─── VALIDATORS ─────────────────────────────────────────

const waitlistValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
];

const registerValidators = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirmPassword')
    .custom((val, { req }) => val === req.body.password)
    .withMessage('Passwords do not match'),
];

const loginValidators = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── ROUTES ─────────────────────────────────────────────

router.post('/waitlist', waitlistValidators, authController.joinWaitlist);
router.post('/register', registerValidators, authController.register);
router.post('/login', loginValidators, authController.login);
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

module.exports = router;
