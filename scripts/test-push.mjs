/**
 * Test script — sends a push notification to ALL subscribed players.
 * Run manually via GitHub Actions → "Test Push Notification".
 */
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY;
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
webpush.setVapidDetails('mailto:admin@worldcupbet.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function main() {
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('player_id, subscription');

  if (error) { console.error('Error fetching subscriptions:', error.message); process.exit(1); }
  if (!subs?.length) { console.log('No push subscriptions found.'); return; }

  console.log(`Sending test push to ${subs.length} subscription(s)...`);

  const payload = JSON.stringify({
    title: '⚽ בדיקת התראות',
    body: 'ההתראות עובדות בהצלחה! תהנו מהמונדיאל 🏆',
    url: '/WorldCUP-BET/',
  });

  let sent = 0, failed = 0;
  for (const { player_id, subscription } of subs) {
    try {
      await webpush.sendNotification(subscription, payload);
      sent++;
    } catch (err) {
      failed++;
      console.warn(`Failed for player ${player_id}: ${err.statusCode} ${err.message}`);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions')
          .delete().eq('player_id', player_id).filter('subscription', 'eq', subscription);
        console.log(`  → Removed expired subscription`);
      }
    }
  }

  console.log(`Done. Sent: ${sent}, Failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
