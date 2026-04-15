require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

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

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'https://anouarelsabah-relizane.com', 'https://tdnikram-dotcom.github.io'],
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(tenantMiddleware);

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/content', require('./routes/content'));
app.use('/api/v1/installments', require('./routes/installments'));
app.use('/api/v1/super', require('./routes/super-admin'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
app.use(authenticateMiddleware);
app.use('/api/v1/leads', require('./routes/leads'));
app.use('/api/v1/clients', require('./routes/clients'));
app.use('/api/v1/bookings', require('./routes/bookings'));
app.use('/api/v1/transactions', require('./routes/transactions'));
app.use('/api/v1/attendance', require('./routes/attendance'));
app.use('/api/v1/agency', require('./routes/agency'));
app.use('/api/v1/upload', require('./routes/upload'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/reminders', require('./routes/reminders'));
app.use('/api/v1/staff', require('./routes/staff'));

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
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
process.on('SIGINT', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});