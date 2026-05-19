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

  // Admin password check
  const adminKey = event.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    // All proposals
    const { data: proposals, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const total = proposals.length;
    const totalViews = proposals.reduce((s, p) => s + (p.views || 0), 0);
    const yesCount = proposals.filter(p => p.yes_clicked).length;
    const todayCount = proposals.filter(p => {
      const d = new Date(p.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;

    // Top names
    const nameCounts = {};
    proposals.forEach(p => {
      const n = p.girlfriend_name.toLowerCase();
      nameCounts[n] = (nameCounts[n] || 0) + 1;
    });
    const topNames = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        stats: { total, totalViews, yesCount, todayCount, conversionRate: total ? Math.round((yesCount / total) * 100) : 0 },
        topNames,
        proposals,
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};