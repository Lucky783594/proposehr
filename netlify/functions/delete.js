// netlify/functions/delete.js
// FIXED: CORS headers aur proper error handling

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const adminKey = event.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const id = event.queryStringParameters?.id;
  if (!id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID required' }) };
  }

  try {
    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('delete error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};