import { supabase } from './supabase';
import type { Profile } from './supabase';

export const ADMIN_EMAIL = 'issgpt@gmail.com';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, displayName: string, inviteCode: string) {
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (!isAdmin) {
    const { data: invites } = await supabase
      .from('invites')
      .select('*')
      .eq('code', inviteCode.toUpperCase())
      .is('used_by', null)
      .limit(1);

    const invite = invites?.[0];

    if (!invite) {
      throw new Error('קוד הזמנה לא תקין או כבר נוצל');
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new Error('קוד ההזמנה פג תוקף');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    });
    if (error) throw error;

    if (data.user) {
      await supabase.from('invites').update({
        used_by: data.user.id,
        used_at: new Date().toISOString()
      }).eq('id', invite.id);
    }

    return data;
  }

  // Admin — הרשמה ישירה ללא קוד
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || 'Admin' } }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}
