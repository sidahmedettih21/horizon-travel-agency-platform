require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const tenantMiddleware = require('./middleware/tenant');
const authenticateMiddleware = require('./middleware/authenticate');
const logger = require('./utils/logger');
const db = require('./database/connection');

const requiredEnv = ['JWT_SECRET', 'ENCRYPTION_KEY'];
requiredEnv.forEach(env => {
  if (!process.env[env]) {
    console.error(`FATAL: Missing ${env} in environment`);
    process.exit(1);
  }
});

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://anouarelsabah.com'  // Add production domain later
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
app.use(compression());
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());
app.use(morgan(isProd ? 'combined' : 'dev', { stream: { write: msg => logger.info(msg.trim()) } }));

app.use(express.static(path.join(__dirname, '../client/public')));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Please try again later' }
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tenant middleware must come before any agency-scoped routes
app.use(tenantMiddleware);

// Auth routes (public)
const authRoutes = require('./routes/auth');
app.use('/api/v1/auth', authRoutes);

// Public content routes (no auth required for GET)
const contentRoutes = require('./routes/content');
app.use('/api/content', contentRoutes);

// ========== ALL ROUTES BELOW REQUIRE AUTHENTICATION ==========
app.use(authenticateMiddleware);

const leadsRoutes = require('./routes/leads');
const clientsRoutes = require('./routes/clients');
const bookingsRoutes = require('./routes/bookings');
const transactionsRoutes = require('./routes/transactions');
const attendanceRoutes = require('./routes/attendance');
const agencyRoutes = require('./routes/agency');
const notificationsRoutes = require('./routes/notifications');
const remindersRoutes = require('./routes/reminders');

app.use('/api/v1/leads', leadsRoutes);
app.use('/api/v1/clients', clientsRoutes);
app.use('/api/v1/bookings', bookingsRoutes);
app.use('/api/v1/transactions', transactionsRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/agency', agencyRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/reminders', remindersRoutes);

// Catch-all for SPA (client frontend)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: 'Internal Server Error',
    message: isProd ? 'Something went wrong' : err.message
  });
});

const server = app.listen(PORT, () => {
  logger.info(`Horizon server running on port ${PORT} (${process.env.NODE_ENV})`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server...');
  server.close(() => {
    db.close();
    logger.info('Server and database closed');
    process.exit(0);
  });
});
process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server...');
  server.close(() => {
    db.close();
    logger.info('Server and database closed');
    process.exit(0);
  });
});
