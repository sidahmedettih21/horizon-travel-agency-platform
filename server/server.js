require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

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
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// --- Global Middleware ---
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'https://anouarelsabah-relizane.com'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
app.use(compression());
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());
app.use(morgan(isProd ? 'combined' : 'dev', { stream: { write: msg => logger.info(msg.trim()) } }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Please try again later' }
}));

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tenant middleware (extracts agency from subdomain)
app.use(tenantMiddleware);

// --- Public Routes (no authentication) ---
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/content', require('./routes/content'));
app.use('/api/v1/installments', require('./routes/installments'));
app.use('/api/v1/super', require('./routes/super-admin'));

// --- Protected Routes (require authentication) ---
app.use(authenticateMiddleware);
app.use('/api/v1/leads', require('./routes/leads'));
app.use('/api/v1/clients', require('./routes/clients'));
app.use('/api/v1/bookings', require('./routes/bookings'));
app.use('/api/v1/transactions', require('./routes/transactions'));
app.use('/api/v1/attendance', require('./routes/attendance'));
app.use('/api/v1/agency', require('./routes/agency'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/reminders', require('./routes/reminders'));

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  logger.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: 'Internal Server Error',
    message: isProd ? 'Something went wrong' : err.message
  });
});

// Start server
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