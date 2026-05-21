// netlify/functions/get-proposal.js
// FIXED: 
//   1. Select query mein 'custom_message' use karo, 'message' nahi
//   2. Response mein 'message' key pe custom_message bhejo (frontend compatibility)
//   3. increment_views RPC fail hone par views+1 update karo correctly

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // ID: querystring se ya path se
  const id =
    event.queryStringParameters?.id ||
    event.path?.split('/').filter(Boolean).pop();

  if (!id || id === 'get-proposal') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Proposal ID required' })
    };
  }

  try {
    // FIX: 'custom_message' column select karo + views bhi lao (views update ke liye)
    const { data, error } = await supabase
      .from('proposals')
      .select('id, girlfriend_name, your_name, custom_message, theme, yes_clicked, views')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Supabase fetch error:', error);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Proposal nahi mila. Link check karo.' })
      };
    }

    // Views increment — pehle RPC try karo, fail hone par manual update
    incrementViews(id, data.views || 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: data.id,
        girlfriend_name: data.girlfriend_name,
        your_name: data.your_name || null,
        message: data.custom_message || null,   // Frontend 'message' key expect karta hai
        theme: data.theme || 'romantic',
        yes_clicked: data.yes_clicked || false
      })
    };

  } catch (err) {
    console.error('get-proposal error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error. Dobara try karo.' })
    };
  }
};

// Views increment — async, non-blocking
async function incrementViews(id, currentViews) {
  try {
    // Pehle RPC try karo (agar function bana hua hai Supabase mein)
    const { error: rpcError } = await supabase.rpc('increment_views', { proposal_id: id });
    if (rpcError) {
      // RPC nahi hai toh direct update
      await supabase
        .from('proposals')
        .update({ views: currentViews + 1, last_viewed_at: new Date().toISOString() })
        .eq('id', id);
    }
  } catch (e) {
    // Views miss honi theek hai, proposal load hona zyada zaroori hai
    console.warn('Views increment failed (non-critical):', e.message);
  }
}