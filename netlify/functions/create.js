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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { girlfriend_name, your_name, message } = JSON.parse(event.body || '{}');

    if (!girlfriend_name || girlfriend_name.trim().length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Naam sahi se likho!' }),
      };
    }

    // Generate unique ID
    let id = generateId();
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 10) {
      const { data } = await supabase.from('proposals').select('id').eq('id', id).single();
      exists = !!data;
      if (exists) id = generateId();
      attempts++;
    }

    const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';

    const { error } = await supabase.from('proposals').insert({
      id,
      girlfriend_name: girlfriend_name.trim(),
      your_name: your_name?.trim() || null,
      custom_message: message?.trim() || null,
      creator_ip: ip,
      views: 0,
      yes_clicked: false,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id, url: `/p/${id}` }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error. Dobara try karo.' }),
    };
  }
};