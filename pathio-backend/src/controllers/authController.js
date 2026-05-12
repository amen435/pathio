const { validationResult } = require('express-validator');
const authService = require('../services/authService');

async function joinWaitlist(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { email } = req.body;
    const result = await authService.joinWaitlist(email);

    return res.status(201).json({
      success: true,
      message: "You're on the waitlist!",
      data: result,
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { fullName, email, password } = req.body;
    const result = await authService.register(fullName, email, password);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: result,
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const result = await authService.login(email, password);

    return res.status(200).json({
      success: true,
      message: 'Welcome back',
      data: result,
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const userId = req.user.userId;
    const user = await authService.getMe(userId);

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
}

module.exports = {
  joinWaitlist,
  register,
  login,
  getMe,
  logout,
};
