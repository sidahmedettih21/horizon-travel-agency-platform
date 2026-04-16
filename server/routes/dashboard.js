/* ══════════════════════════════════════════════════════ DASHBOARD STATS ══════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const authenticate = require('../middleware/authenticate');

router.get('/stats', authenticate, (req, res) => {
  const agencyId = req.agency.id;

  try {
    const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings WHERE agency_id = ?').get(agencyId).count;
    const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients WHERE agency_id = ?').get(agencyId).count;
    const totalRevenue = db.prepare(`
      SELECT SUM(total_amount) as total FROM bookings
      WHERE agency_id = ? AND status IN ('confirmed', 'completed')
    `).get(agencyId).total || 0;
    const pendingPayments = db.prepare(`
      SELECT SUM(total_amount - amount_paid) as pending FROM bookings
      WHERE agency_id = ? AND status NOT IN ('cancelled', 'deleted')
    `).get(agencyId).pending || 0;
    const upcomingTravels = db.prepare(`
      SELECT COUNT(*) as count FROM bookings
      WHERE agency_id = ? AND travel_date >= DATE('now') AND status IN ('confirmed', 'processing')
    `).get(agencyId).count;
    const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE agency_id = ?').get(agencyId).count;
    const convertedLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE agency_id = ? AND status = ?').get(agencyId, 'converted').count;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    const pendingLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE agency_id = ? AND status = ?').get(agencyId, 'pending').count;

    res.json({
      totalBookings,
      totalClients,
      totalRevenue,
      pendingPayments,
      upcomingTravels,
      conversionRate,
      pendingLeads
    });
  } catch (err) {
    console.error('[dashboard]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;