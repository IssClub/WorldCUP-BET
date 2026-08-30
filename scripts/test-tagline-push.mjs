/**
 * test-tagline-push.mjs — סקריפט חד-פעמי לבדיקת פוש הטגליין
 * מוחק אחרי הבדיקה
 */
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY;
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID keys');
  process.exit(1);
}

webpush.setVapidDetails('mailto:admin@worldcupbet.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendPush(playerId, payload) {
  const { data: subs } = await supabase
    .from('push_subscriptions').select('subscription').eq('player_id', playerId);
  if (!subs?.length) { console.log('No subscriptions found for player'); return; }
  for (const { subscription } of subs) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      console.log('Push sent ✓');
    } catch (err) {
      console.error('Push error:', err.statusCode, err.body);
    }
  }
}

async function main() {
  // מצא את המשתמש לפי האימייל
  const { data: authUsers, error } = await supabase.auth.admin.listUsers();
  if (error) { console.error('listUsers error:', error.message); process.exit(1); }

  const target = authUsers.users.find(u => u.email === 'issgpt@gmail.com');
  if (!target) { console.error('User not found'); process.exit(1); }

  console.log(`Sending tagline push to: ${target.email} (${target.id})`);

  await sendPush(target.id, {
    title: 'כל הכבוד, אתה מוביל! 🏆',
    body: 'סיימת את מחזור 1 במקום הראשון! זה הזמן לכתוב לכל הלוזרים מה אתה חושב 🏆',
    url: '/WorldCUP-BET/?set-tagline=1',
  });
}

main().catch(e => { console.error(e); process.exit(1); });
