const axios = require('axios');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

async function sendWhatsAppMessage(to, message, agencyId) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('WhatsApp not configured – skipping');
    return null;
  }
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/[^0-9+]/g, ''),
        type: 'text',
        text: { body: message.substring(0, 4096) }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`WhatsApp sent to ${to}: ${response.data.messages[0].id}`);
    return response.data;
  } catch (error) {
    console.error('WhatsApp send failed:', error.response?.data || error.message);
    return null;
  }
}

function formatLeadMessage(lead, agency, leadUrl) {
  const lang = lead.language === 'ar' ? 'ar' : 'fr';
  const messages = {
    fr: `🌟 Nouvelle demande - Horizon\nAgence: ${agency.name}\nClient: ${lead.name} - ${lead.phone}\nService: ${lead.service_interest}\nMessage: ${lead.notes || 'Aucun'}\nCliquez ici: ${leadUrl}`,
    ar: `🌟 طلب جديد - هورايزون\nالوكالة: ${agency.name}\nالعميل: ${lead.name} - ${lead.phone}\nالخدمة: ${lead.service_interest}\nالرسالة: ${lead.notes || 'لا يوجد'}\nاضغط هنا: ${leadUrl}`
  };
  return messages[lang] || messages.fr;
}

module.exports = { sendWhatsAppMessage, formatLeadMessage };
