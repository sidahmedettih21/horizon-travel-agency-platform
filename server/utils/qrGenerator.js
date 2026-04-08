const QRCode = require('qrcode');
const crypto = require('crypto');

function generateDailyQRToken(agencyId, dateStr) {
  const payload = `${agencyId}:${dateStr}:${process.env.JWT_SECRET}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function generateQRImage(token) {
  const qrData = `horizon://attendance?token=${token}`;
  return await QRCode.toBuffer(qrData, { type: 'png', margin: 1, width: 300 });
}

module.exports = { generateDailyQRToken, generateQRImage };
