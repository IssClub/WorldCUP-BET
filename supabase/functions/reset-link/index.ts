import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const REDIRECT_TO = 'https://issclub.github.io/WorldCUP-BET/';
const ADMIN_EMAIL  = 'issgpt@gmail.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  // ── וידוא שהמשתמש הוא אדמין ──────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data: { user } } = await supabaseUser.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user || user.email !== ADMIN_EMAIL) return json({ error: 'Forbidden' }, 403);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.json();

  // ── יצירת קישור שחזור סיסמה ─────────────────────────────────
  if (body.action === 'reset' || !body.action) {
    const { email } = body;
    if (!email) return json({ error: 'email required' }, 400);

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: REDIRECT_TO },
    });

    if (error) return json({ error: error.message }, 400);
    return json({ link: data.properties.action_link });
  }

  // ── מחיקת משתמש ─────────────────────────────────────────────
  if (body.action === 'delete') {
    const { userId } = body;
    if (!userId) return json({ error: 'userId required' }, 400);

    // מחק הימורים ופרופיל (auth.admin.deleteUser מטפל גם בפרופיל אם יש cascade)
    await supabaseAdmin.from('bets').delete().eq('player_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: 'unknown action' }, 400);
});

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
