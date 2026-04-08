const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const verifyAsync = promisify(jwt.verify);

async function authenticateMiddleware(req, res, next) {
  const token = req.cookies?.horizon_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
  }

  try {
    const decoded = await verifyAsync(token, process.env.JWT_SECRET, {
      algorithms: ['HS512'],
      issuer: 'horizon'
    });

    if (!decoded.userId || !decoded.agencyId || !decoded.role) {
      throw new Error('Invalid token payload');
    }

    if (parseInt(decoded.agencyId) !== parseInt(req.agency.id)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Token agency mismatch' });
    }

    req.user = {
      id: decoded.userId,
      agencyId: decoded.agencyId,
      role: decoded.role,
      email: decoded.email
    };
    next();
  } catch (err) {
    res.clearCookie('horizon_token', { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'strict' });
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

module.exports = authenticateMiddleware;
