// netlify/functions/get-proposal.js
// GF jab link khole toh naam + theme fetch karo, views count badao

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

  const id = event.queryStringParameters?.id;
  if (!id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID required' }) };
  }

  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('id, girlfriend_name, your_name, custom_message, views, yes_clicked, created_at')
      .eq('id', id)
      .single();

    if (error || !data) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Proposal nahi mila!' }) };
    }

    // Views increment (fire and forget)
    supabase
      .from('proposals')
      .update({ views: supabase.raw('views + 1') })
      .eq('id', id)
      .then(() => {})
      .catch(() => {});

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: data.id,
        girlfriend_name: data.girlfriend_name,
        your_name: data.your_name,
        message: data.message,
        theme: data.theme || 'romantic',
        yes_clicked: data.yes_clicked
      })
    };

  } catch (err) {
    console.error('get-proposal error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};