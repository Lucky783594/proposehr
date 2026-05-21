// netlify/functions/yes-clicked.js
// FIXED:
//   1. Select query mein 'notify_contact' properly fetch karo
//   2. proposal.yes_clicked check theek karo
//   3. Email sender address fix karo (verified domain chahiye)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { id } = JSON.parse(event.body || '{}');
    if (!id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID required' }) };
    }

    // Proposal fetch karo with notify_contact
    const { data: proposal, error: fetchErr } = await supabase
      .from('proposals')
      .select('id, girlfriend_name, notify_contact, yes_clicked')
      .eq('id', id)
      .single();

    if (fetchErr || !proposal) {
      console.error('Proposal not found:', fetchErr);
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Proposal not found' }) };
    }

    // Already clicked? Double notification rokne ke liye
    if (proposal.yes_clicked === true) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, already: true }) };
    }

    // Update yes_clicked = true
    const { error: updateErr } = await supabase
      .from('proposals')
      .update({
        yes_clicked: true,
        yes_clicked_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateErr) {
      console.error('Update error:', updateErr);
      // Update fail hona critical nahi — notification phir bhi bhejo
    }

    // Notification bhejo
    if (proposal.notify_contact) {
      const contact = proposal.notify_contact.trim();
      const gfName = proposal.girlfriend_name;

      if (contact.includes('@')) {
        // Email
        await sendEmail(contact, gfName, id);
      } else if (/^[\d\+][\d\s\-]{8,}$/.test(contact)) {
        // WhatsApp / SMS
        await sendWhatsApp(contact, gfName, id);
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error('yes-clicked error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

// ===== EMAIL via Resend =====
async function sendEmail(toEmail, gfName, proposalId) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set — email skipped');
    return;
  }

  const siteUrl = process.env.SITE_URL || 'https://proposeanyone.netlify.app';

  // IMPORTANT: 'from' address mein Resend pe verified domain hona chahiye
  // Free plan mein 'onboarding@resend.dev' use karo ya apna domain verify karo
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const emailHtml = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProposeHer Notification</title>
</head>
<body style="font-family:Georgia,serif;background:#faf7f2;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:#c0525a;padding:2rem;text-align:center;">
      <h1 style="color:#fff;font-size:28px;margin:0;font-style:italic;">ProposeHer 💕</h1>
    </div>
    <div style="padding:2rem;">
      <div style="font-size:48px;text-align:center;margin:1rem 0;">🎉</div>
      <p style="font-size:20px;color:#1e1012;line-height:1.7;text-align:center;">
        <strong style="color:#c0525a;font-size:24px;">${escHtml(gfName)}</strong><br>
        ne tumhara proposal <strong>accept kar liya!</strong>
      </p>
      <p style="font-size:16px;color:#6b4e52;line-height:1.6;text-align:center;margin-top:1rem;">
        Woh "Haan, bilkul!" bol di — ab tumhari kahani shuru hoti hai! 💕
      </p>
      <div style="text-align:center;margin-top:1.5rem;">
        <a href="${siteUrl}/p/${proposalId}" 
           style="display:inline-block;padding:0.8rem 2rem;background:#c0525a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">
          Proposal Page Dekho
        </a>
      </div>
    </div>
    <div style="padding:1rem 2rem;text-align:center;font-size:12px;color:#8a6a6e;border-top:1px solid #f7dde0;">
      ProposeHer · Made with 💕
    </div>
  </div>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        subject: `💕 ${escHtml(gfName)} ne "Haan" bol di! — ProposeHer`,
        html: emailHtml
      })
    });

    const resBody = await res.text();
    if (!res.ok) {
      console.error('Resend error:', res.status, resBody);
    } else {
      console.log(`Email sent to ${toEmail}`);
    }
  } catch (e) {
    console.error('Email send failed:', e.message);
  }
}

// ===== WhatsApp via Twilio =====
async function sendWhatsApp(phone, gfName, proposalId) {
  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM;

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log('Twilio not configured — WhatsApp skipped');
    return;
  }

  // Phone normalize
  let normalizedPhone = phone.replace(/[\s\-]/g, '');
  if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = '+91' + normalizedPhone.replace(/^0/, '');
  }

  const siteUrl = process.env.SITE_URL || 'https://proposeanyone.netlify.app';
  const message = `💕 *ProposeHer*\n\n🎉 *${gfName}* ne tumhara proposal accept kar liya!\n\nWoh "Haan, bilkul!" bol di — ab teri kahani shuru hoti hai! ❤️\n\nProposal dekho: ${siteUrl}/p/${proposalId}`;

  try {
    const credentials = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
    const body = new URLSearchParams({
      From: TWILIO_FROM,
      To: `whatsapp:${normalizedPhone}`,
      Body: message
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Twilio WhatsApp error:', err);
    } else {
      console.log(`WhatsApp sent to ${normalizedPhone}`);
    }
  } catch (e) {
    console.error('WhatsApp send failed:', e.message);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}