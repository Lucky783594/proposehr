// netlify/functions/stats.js
// FIXED: 'custom_message' column use karo, CORS headers fix

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Admin password check
  const adminKey = event.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { data: proposals, error } = await supabase
      .from('proposals')
      .select('id, girlfriend_name, your_name, theme, views, yes_clicked, yes_clicked_at, creator_ip, created_at, notify_contact')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const total = proposals.length;
    const totalViews = proposals.reduce((s, p) => s + (p.views || 0), 0);
    const yesCount = proposals.filter(p => p.yes_clicked).length;
    
    const todayStr = new Date().toDateString();
    const todayCount = proposals.filter(p => {
      try {
        return new Date(p.created_at).toDateString() === todayStr;
      } catch { return false; }
    }).length;

    // Top names
    const nameCounts = {};
    proposals.forEach(p => {
      const n = p.girlfriend_name.toLowerCase().trim();
      nameCounts[n] = (nameCounts[n] || 0) + 1;
    });

    const topNames = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));

    // Theme breakdown
    const themeBreakdown = { romantic: 0, college: 0 };
    proposals.forEach(p => {
      const t = p.theme || 'romantic';
      themeBreakdown[t] = (themeBreakdown[t] || 0) + 1;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        stats: {
          total,
          totalViews,
          yesCount,
          todayCount,
          conversionRate: total ? Math.round((yesCount / total) * 100) : 0,
          themeBreakdown
        },
        topNames,
        proposals,
      }),
    };

  } catch (err) {
    console.error('stats error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};