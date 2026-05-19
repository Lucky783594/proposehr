const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
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

    // Increment view count (fire and forget)
    supabase
      .from('proposals')
      .update({ views: (data.views || 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq('id', id)
      .then(() => {});

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};