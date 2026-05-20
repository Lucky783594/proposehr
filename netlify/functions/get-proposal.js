// netlify/functions/get-proposal.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // ID URL se lo: /p/abc123 → querystring ya path se
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
    const { data, error } = await supabase
      .from('proposals')
      .select('id, girlfriend_name, your_name, custom_message, theme, yes_clicked')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Supabase fetch error:', error);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Proposal nahi mila' })
      };
    }

    // Views increment — FIX: supabase.raw nahi, direct SQL
    supabase.rpc('increment_views', { proposal_id: id })
      .then(() => {})
      .catch(() => {
        // Fallback: direct update
        supabase
          .from('proposals')
          .update({ views: (data.views || 0) + 1 })
          .eq('id', id)
          .then(() => {})
          .catch(() => {});
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: data.id,
        girlfriend_name: data.girlfriend_name,
        your_name: data.your_name || null,
        message: data.message || null,
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