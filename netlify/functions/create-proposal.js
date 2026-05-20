// netlify/functions/create-proposal.js
// Supabase mein save karo + theme store karo + notify_contact save karo

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function generateId(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const body = JSON.parse(event.body || '{}');
    const { girlfriend_name, your_name, custom_message, theme, notify_contact } = body;

    if (!girlfriend_name || girlfriend_name.trim().length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Naam sahi se likho!' }) };
    }

    // Sanitize
    const cleanName = girlfriend_name.trim().slice(0, 30);
    const cleanYourName = your_name ? your_name.trim().slice(0, 40) : null;
    const cleanMsg = custom_message ? custom_message.trim().slice(0, 300) : null;
    // theme: 'romantic' ya 'college'
    const cleanTheme = theme === 'college' ? 'college' : 'romantic';
    const cleanNotify = notify_contact ? notify_contact.trim().slice(0, 60) : null;

    // genrate unique id 
    let id = generateId();
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 10) {
      const { data } = await supabase.from('proposals').select('id').eq('id', id).single();
      exists = !!data;
      if (exists) id = generateId();
      attempts++;
    }

    // Creator IP
    const creatorIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || null;

    // Supabase mein insert
    const { data, error } = await supabase
      .from('proposals')
      .insert([{
        id,
        girlfriend_name: cleanName,
        your_name: cleanYourName,
        custom_message: cleanMsg,
        theme: cleanTheme,
        notify_contact: cleanNotify,
        creator_ip: creatorIp,
        views: 0,
        yes_clicked: false,
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (error) throw error;

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