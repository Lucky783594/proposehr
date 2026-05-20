const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { id } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID required' }) };

    // Fetch proposal + notify_contact
    const { data: proposal, error: fetchErr } = await supabase
      .from('proposals')
      .select('girlfriend_name, notify_contact, yes_clicked')
      .eq('id', id)
      .single();

    if (fetchErr || !proposal) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
    }

    // Already clicked? Skip double notification
    if (proposal.yes_clicked) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, already: true }) };
    }

    // Update yes_clicked = true + timestamp
    await supabase
      .from('proposals')
      .update({
        yes_clicked: true,
        yes_clicked_at: new Date().toISOString()
      })
      .eq('id', id);

    // ===== SEND NOTIFICATION =====
    if (proposal.notify_contact) {
      const contact = proposal.notify_contact.trim();
      const gfName = proposal.girlfriend_name;

      // Email check karo (@ hai toh email)
      if (contact.includes('@')) {
        await sendEmail(contact, gfName, id);
      }
      // Phone number check (10 digit ya + se shuru)
      else if (/^[\d\+][\d\s\-]{8,}$/.test(contact)) {
        await sendWhatsApp(contact, gfName, id);
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error('yes-clicked error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

// ===== EMAIL via Resend API =====
async function sendEmail(toEmail, gfName, proposalId) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set — email skipped');
    return;
  }

  const siteUrl = process.env.SITE_URL || 'https://proposeanyone.netlify.app';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Georgia, serif; background: #faf7f2; margin: 0; padding: 20px; }
        .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: #c0525a; padding: 2rem; text-align: center; }
        .header h1 { color: #fff; font-size: 28px; margin: 0; font-style: italic; }
        .body { padding: 2rem; }
        .big-text { font-size: 48px; text-align: center; margin: 1rem 0; }
        .message { font-size: 18px; color: #1e1012; line-height: 1.7; text-align: center; }
        .name { color: #c0525a; font-style: italic; font-size: 24px; }
        .link-btn { display: block; width: fit-content; margin: 1.5rem auto; padding: 0.8rem 2rem; background: #c0525a; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; }
        .footer { padding: 1rem 2rem; text-align: center; font-size: 12px; color: #8a6a6e; border-top: 1px solid #f7dde0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>ProposeHer 💕</h1></div>
        <div class="body">
          <div class="big-text">🎉</div>
          <p class="message">
            <span class="name">${escHtml(gfName)}</span> ne tumhara proposal
            <strong>accept kar liya!</strong>
          </p>
          <p class="message" style="font-size:16px;margin-top:1rem;">
            Woh "Haan, bilkul!" bol di — ab tumhari kahani shuru hoti hai! 💕
          </p>
          <a href="${siteUrl}/p/${proposalId}" class="link-btn">Proposal Page Dekho</a>
        </div>
        <div class="footer">ProposeHer · Made with 💕</div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'ProposeHer <notifications@proposeanyone.netlify.app>',
        to: [toEmail],
        subject: `💕 ${gfName} ne "Haan" bol di! — ProposeHer`,
        html: emailHtml
      })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
    } else {
      console.log(`Email sent to ${toEmail}`);
    }
  } catch (e) {
    console.error('Email send failed:', e);
  }
}

// ===== WhatsApp via Twilio =====
async function sendWhatsApp(phone, gfName, proposalId) {
  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM; // whatsapp:+14155238886

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log('Twilio not configured — WhatsApp skipped');
    return;
  }

  // Normalize phone: ensure starts with +91 or country code
  let normalizedPhone = phone.replace(/[\s\-]/g, '');
  if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = '+91' + normalizedPhone.replace(/^0/, '');
  }

  const message = `💕 *ProposeHer*\n\n🎉 *${gfName}* ne tumhara proposal accept kar liya!\n\nWoh "Haan, bilkul!" bol di — ab teri kahani shuru hoti hai! ❤️\n\nProposal dekho: https://proposeanyone.netlify.app/p/${proposalId}`;

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
    console.error('WhatsApp send failed:', e);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}