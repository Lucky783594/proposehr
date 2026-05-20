const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// All valid themes
const VALID_THEMES = [
  'romantic', 'college', 'starry', 'royale', 'garden',
  'sunset', 'fairy', 'vintage', 'ocean', 'monsoon',
  'mountain', 'desert', 'neon', 'pastel', 'minimalist',
  'bollywood', 'retro', 'winter', 'spring', 'autumn'
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { girlfriend_name, your_name, message, theme, notify_contact } = body;

    if (!girlfriend_name || girlfriend_name.trim().length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Naam sahi se likho!' }) };
    }

    const cleanName = girlfriend_name.trim().slice(0, 30);
    const cleanYour = your_name ? your_name.trim().slice(0, 40) : null;
    const cleanMsg = message ? message.trim().slice(0, 300) : null;
    const cleanTheme = VALID_THEMES.includes(theme) ? theme : 'romantic';
    const cleanNotify = notify_contact ? notify_contact.trim().slice(0, 60) : null;
    const creatorIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || null;

    const { data, error } = await supabase
      .from('proposals')
      .insert([{
        girlfriend_name: cleanName,
        your_name: cleanYour,
        custom_message: cleanMsg,
        theme: cleanTheme,
        notify_contact: cleanNotify,
        creator_ip: creatorIp,
        views: 0,
        yes_clicked: false,
        yes_clicked_at: null,
        last_viewed_at: null,
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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error. Dobara try karo.' }) };
  }
};