// netlify/functions/create-proposal.js
// FIXED: column name 'message' -> 'custom_message' (Supabase table ke hisaab se)

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
    const body = JSON.parse(event.body || '{}');
    const { girlfriend_name, your_name, message, theme, notify_contact } = body;

    if (!girlfriend_name || girlfriend_name.trim().length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Naam sahi se likho! (kam se kam 2 letters)' }) };
    }

    // Sanitize all inputs
    const cleanName = girlfriend_name.trim().slice(0, 30);
    const cleanYourName = your_name ? your_name.trim().slice(0, 40) : null;
    const cleanMsg = message ? message.trim().slice(0, 300) : null;
    const cleanTheme = theme === 'college' ? 'college' : 'romantic';
    const cleanNotify = notify_contact ? notify_contact.trim().slice(0, 60) : null;

    // Creator IP (for rate limiting / abuse prevention)
    const creatorIp = event.headers['x-forwarded-for'] 
      || event.headers['client-ip'] 
      || null;

    // Supabase insert
    // NOTE: Supabase table column name 'custom_message' hai, 'message' nahi
    const { data, error } = await supabase
      .from('proposals')
      .insert([{
        girlfriend_name: cleanName,
        your_name: cleanYourName,
        custom_message: cleanMsg,   // FIX: 'message' nahi, 'custom_message' hai table mein
        theme: cleanTheme,
        notify_contact: cleanNotify,
        creator_ip: creatorIp,
        views: 0,
        yes_clicked: false,
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: data.id, theme: cleanTheme })
    };

  } catch (err) {
    console.error('create-proposal error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error. Dobara try karo.' })
    };
  }
};