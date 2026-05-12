const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

// ─── HELPERS ────────────────────────────────────────────

async function generateMemberNumber() {
  const count = await prisma.user.count();
  return count + 51;
}

function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

async function sendWelcomeEmail(email, fullName, memberNumber) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const firstName = fullName.split(' ')[0];

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `You're in, ${firstName}. Pathio is ready.`,
      html: `
        <div style="background:#050A08;padding:3rem 2rem;font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="margin-bottom:2.5rem;">
            <span style="font-size:14px;font-weight:800;color:#E8F0EB;letter-spacing:-0.02em;">PATHI</span><span style="font-size:14px;font-weight:800;color:#3DFF8F;letter-spacing:-0.02em;">O</span>
          </div>

          <h1 style="font-size:48px;font-weight:800;color:#3DFF8F;margin:0 0 1.5rem;letter-spacing:-0.04em;line-height:1;">you're in.</h1>

          <p style="font-size:16px;color:#E8F0EB;margin:0 0 0.5rem;line-height:1.6;">Welcome to Pathio, ${fullName}.</p>

          <p style="font-size:14px;color:#4A6355;margin:0 0 2rem;line-height:1.7;">You're member <strong style="color:#3DFF8F;">#${memberNumber}</strong>. Your agents activate when we launch.</p>

          <div style="border-top:1px solid #1A2E22;padding-top:1.5rem;margin-top:1rem;">
            <p style="font-size:11px;color:#3DFF8F;letter-spacing:0.1em;margin:0 0 1.5rem;">YOUR PATH. AI-POWERED.</p>
          </div>

          <p style="font-size:10px;color:#4A6355;margin:0;letter-spacing:0.06em;">© 2026 Pathio</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Welcome email failed:', err.message);
  }
}

// ─── BUSINESS LOGIC ─────────────────────────────────────

async function joinWaitlist(email) {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    const error = new Error('Invalid email address.');
    error.status = 400;
    throw error;
  }

  // Check duplicate
  const existing = await prisma.waitlistEntry.findUnique({ where: { email } });
  if (existing) {
    const error = new Error('Already on the waitlist.');
    error.status = 409;
    throw error;
  }

  // Create entry
  await prisma.waitlistEntry.create({ data: { email } });

  // Get total count
  const count = await prisma.waitlistEntry.count();

  return { success: true, count };
}

async function register(fullName, email, password) {
  // Validate inputs
  if (!fullName || fullName.trim().length === 0) {
    const error = new Error('Full name is required.');
    error.status = 400;
    throw error;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    const error = new Error('Valid email is required.');
    error.status = 400;
    throw error;
  }

  if (!password || password.length < 8) {
    const error = new Error('Password must be at least 8 characters.');
    error.status = 400;
    throw error;
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const error = new Error('Email already registered.');
    error.status = 409;
    throw error;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Generate member number
  const memberNumber = await generateMemberNumber();

  // Create user
  const user = await prisma.user.create({
    data: {
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      memberNumber,
    },
  });

  // Generate token
  const token = generateToken(user.id, user.email);

  // Send welcome email (non-blocking — don't await)
  sendWelcomeEmail(user.email, user.fullName, user.memberNumber);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      memberNumber: user.memberNumber,
      createdAt: user.createdAt,
    },
    token,
  };
}

async function login(email, password) {
  // Find user by email
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    const error = new Error('Invalid credentials.');
    error.status = 401;
    throw error;
  }

  // Compare password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('Invalid credentials.');
    error.status = 401;
    throw error;
  }

  // Generate token
  const token = generateToken(user.id, user.email);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      memberNumber: user.memberNumber,
      createdAt: user.createdAt,
    },
    token,
  };
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      memberNumber: true,
      isVerified: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    const error = new Error('User not found.');
    error.status = 404;
    throw error;
  }

  return user;
}

module.exports = {
  joinWaitlist,
  register,
  login,
  getMe,
};
