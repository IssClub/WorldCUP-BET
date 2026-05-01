import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import type { Invite, Profile, Settings } from '../lib/supabase';
import { Plus, Copy, Check, LogOut, Users, Settings as SettingsIcon, Trophy, RefreshCw } from 'lucide-react';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'invites' | 'players' | 'settings'>('invites');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const loadInvites = useCallback(async () => {
    const { data } = await supabase.from('invites').select('*').order('created_at', { ascending: false });
    setInvites(data || []);
  }, []);

  const loadPlayers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('bank', { ascending: false });
    setPlayers(data || []);
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*').single();
    setSettings(data);
  }, []);

  useEffect(() => {
    loadInvites();
    loadPlayers();
    loadSettings();
  }, [loadInvites, loadPlayers, loadSettings]);

  async function createInvite() {
    setLoading(true);
    const code = generateCode();
    await supabase.from('invites').insert({ code, created_by: profile?.id });
    await loadInvites();
    setLoading(false);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    const { error } = await supabase.from('settings').update({
      starting_bank: settings.starting_bank,
      min_bet: settings.min_bet,
      max_bet: settings.max_bet,
      no_bet_penalty: settings.no_bet_penalty,
    }).eq('id', 1);
    setSavingSettings(false);
    setSettingsMsg(error ? 'שגיאה בשמירה' : 'נשמר בהצלחה ✓');
    setTimeout(() => setSettingsMsg(''), 3000);
  }

  const tabs = [
    { key: 'invites', label: 'הזמנות', icon: Plus },
    { key: 'players', label: 'שחקנים', icon: Users },
    { key: 'settings', label: 'הגדרות', icon: SettingsIcon },
  ] as const;

  return (
    <div className="min-h-screen pitch-bg">
      <header className="sticky top-0 z-10" style={{background: 'rgba(10,14,26,0.95)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(10px)'}}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy size={22} style={{color: 'var(--green)'}} />
            <span className="font-bold text-lg">מונדיאל הימורים</span>
            <span className="badge-admin">Admin</span>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 text-sm" style={{color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer'}}>
            <LogOut size={16} />
            יציאה
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === t.key
                ? {background: 'var(--green)', color: '#000', fontWeight: 700}
                : {background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)'}}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'invites' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">קודי הזמנה</h2>
              <button onClick={createInvite} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all" style={{background: 'var(--green)', color: '#000'}}>
                <Plus size={15} />
                {loading ? 'יוצר...' : 'צור קוד'}
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {invites.length === 0 && (
                <div className="card p-8 text-center" style={{color: 'var(--text-muted)'}}>
                  אין קודי הזמנה עדיין. צור את הראשון!
                </div>
              )}
              {invites.map(inv => (
                <div key={inv.id} className="card card-hover p-4 flex items-center justify-between">
                  <div>
                    <span className="bebas text-2xl tracking-widest" style={{color: inv.used_by ? 'var(--text-muted)' : 'var(--green)'}}>{inv.code}</span>
                    <div className="text-xs mt-1" style={{color: 'var(--text-muted)'}}>
                      {inv.used_by ? `נוצל • ${new Date(inv.used_at!).toLocaleDateString('he-IL')}` : 'פנוי'}
                    </div>
                  </div>
                  {!inv.used_by && (
                    <button onClick={() => copyCode(inv.code)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all" style={{background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)'}}>
                      {copied === inv.code ? <Check size={14} style={{color: 'var(--green)'}} /> : <Copy size={14} />}
                      {copied === inv.code ? 'הועתק!' : 'העתק'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'players' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">שחקנים ({players.length})</h2>
              <button onClick={loadPlayers} className="p-2 rounded-lg" style={{background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer'}}>
                <RefreshCw size={15} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {players.map((p, i) => (
                <div key={p.id} className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bebas text-2xl w-8 text-center" style={{color: i === 0 ? 'var(--gold)' : 'var(--text-muted)'}}>{i + 1}</span>
                    <div>
                      <div className="font-semibold">{p.display_name}</div>
                      <div className="text-xs" style={{color: 'var(--text-muted)'}}>{p.id === profile?.id ? 'אתה' : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg" style={{color: 'var(--green)'}}>{p.bank.toLocaleString()}</span>
                    <span className="text-xs" style={{color: 'var(--text-muted)'}}>נק׳</span>
                    {p.role === 'admin' && <span className="badge-admin">Admin</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && settings && (
          <div className="fade-in">
            <h2 className="font-bold text-lg mb-4">הגדרות מערכת</h2>
            <div className="card p-6">
              <div className="flex flex-col gap-5">
                {[
                  { key: 'starting_bank', label: 'בנק פתיחה לשחקן חדש', hint: 'נקודות' },
                  { key: 'min_bet', label: 'הימור מינימלי', hint: 'נקודות' },
                  { key: 'max_bet', label: 'הימור מקסימלי', hint: 'נקודות' },
                  { key: 'no_bet_penalty', label: 'קנס על אי-הימור', hint: 'נקודות' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium mb-2" style={{color: 'var(--text-muted)'}}>{field.label}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        className="input"
                        value={settings[field.key as keyof Settings] as number}
                        onChange={e => setSettings(prev => prev ? {...prev, [field.key]: parseInt(e.target.value) || 0} : prev)}
                      />
                      <span className="text-sm" style={{color: 'var(--text-muted)', whiteSpace: 'nowrap'}}>{field.hint}</span>
                    </div>
                  </div>
                ))}

                {settingsMsg && (
                  <div className="text-sm px-3 py-2 rounded-lg" style={{background: 'rgba(0,200,83,0.1)', color: 'var(--green)', border: '1px solid rgba(0,200,83,0.2)'}}>
                    {settingsMsg}
                  </div>
                )}

                <button className="btn-primary" onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? 'שומר...' : 'שמור הגדרות'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
