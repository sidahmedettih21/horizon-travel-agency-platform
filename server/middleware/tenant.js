const db = require('../database/connection');

function tenantMiddleware(req, res, next) {
  const host = req.headers.host;
  if (!host) {
    return res.status(400).json({ error: 'Bad request', message: 'Missing host header' });
  }

  let subdomain = host.split('.')[0];
  if (subdomain === 'www') subdomain = host.split('.')[1];
  if (subdomain === host) subdomain = null;

  if (!subdomain) {
    if (process.env.NODE_ENV === 'development') {
      subdomain = req.query.agency || 'demo';
      console.warn(`⚠️  DEV MODE: Using agency fallback '${subdomain}'`);
    } else {
      return res.status(400).json({ error: 'Invalid tenant', message: 'Subdomain required' });
    }
  }

  const agency = db.prepare(`
    SELECT id, uuid, name, subdomain, custom_domain, logo_url,
           primary_color, secondary_color, font_family, settings,
           is_active, subscription_plan, max_staff, max_clients,
           subscription_expires_at
    FROM agencies WHERE subdomain = ? AND is_active = 1
  `).get(subdomain);

  if (!agency) {
    return res.status(404).json({ error: 'Tenant not found', message: 'Agency does not exist or is inactive' });
  }

  if (agency.subscription_expires_at && new Date(agency.subscription_expires_at) < new Date()) {
    return res.status(403).json({ error: 'Subscription expired', message: 'Your subscription has expired. Please renew to continue using Horizon.' });
  }

  req.agency = agency;
  next();
}

