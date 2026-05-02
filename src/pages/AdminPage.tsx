import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import type { Invite, Profile, Settings, Bet } from '../lib/supabase';
import { Plus, Copy, Check, LogOut, Users, Settings as SettingsIcon, Trophy, RefreshCw, Trash2, Database, Shirt, CheckSquare } from 'lucide-react';
import type { TopScorer } from '../lib/supabase';
import { teamHe } from '../lib/teamNames';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'invites' | 'players' | 'settings' | 'data' | 'scorers' | 'results'>('invites');
  const [betCounts, setBetCounts] = useState<Record<string, number>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [newScorer, setNewScorer] = useState({ player_name: '', team: '', goals: 0, assists: 0 });
  const [savingScorer, setSavingScorer] = useState(false);

  // Settlement state
  type GameGroup = { external_game_id: string; home_team: string; away_team: string; kickoff_at: string; bets: Bet[] };
  const [pendingGames, setPendingGames] = useState<GameGroup[]>([]);
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});
  const [settling, setSettling] = useState<string | null>(null);
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

  const loadScorers = useCallback(async () => {
    const { data } = await supabase.from('top_scorers').select('*').order('goals', { ascending: false });
    setScorers((data as TopScorer[]) || []);
  }, []);

  useEffect(() => {
    loadInvites();
    loadPlayers();
    loadSettings();
    loadBetCounts();
    loadScorers();
    loadPendingGames();
  }, [loadInvites, loadPlayers, loadSettings, loadScorers]);

  async function upsertScorer() {
    if (!newScorer.player_name.trim()) return;
    setSavingScorer(true);
    await supabase.from('top_scorers').upsert(
      { ...newScorer, updated_at: new Date().toISOString() },
      { onConflict: 'player_name' }
    );
    setNewScorer({ player_name: '', team: '', goals: 0, assists: 0 });
    await loadScorers();
    setSavingScorer(false);
  }

  async function loadPendingGames() {
    const { data } = await supabase.from('bets').select('*').eq('status', 'pending').order('kickoff_at');
    if (!data) return;
    const grouped: Record<string, GameGroup> = {};
    for (const bet of data as Bet[]) {
      if (!grouped[bet.external_game_id]) {
        grouped[bet.external_game_id] = { external_game_id: bet.external_game_id, home_team: bet.home_team, away_team: bet.away_team, kickoff_at: bet.kickoff_at, bets: [] };
      }
      grouped[bet.external_game_id].bets.push(bet);
    }
    setPendingGames(Object.values(grouped).sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at)));
  }

  async function settleGame(game: GameGroup) {
    const sc = scores[game.external_game_id];
    const homeScore = parseInt(sc?.home ?? '');
    const awayScore = parseInt(sc?.away ?? '');
    if (isNaN(homeScore) || isNaN(awayScore)) { alert('הזן תוצאה תקינה'); return; }
    if (!confirm(`לסגור: ${teamHe(game.home_team)} ${homeScore}:${awayScore} ${teamHe(game.away_team)}?\n${game.bets.length} הימורים יסגרו.`)) return;

    setSettling(game.external_game_id);
    const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
    const playerPayouts: Record<string, number> = {};

    for (const bet of game.bets) {
      const won = bet.pick === winner;
      let payout = 0;
      if (won) {
        payout = Math.floor(bet.amount * bet.odds_value);
        if (bet.exact_home !== null && bet.exact_home === homeScore && bet.exact_away === awayScore) {
          payout = Math.floor(payout * 1.5);
        }
        playerPayouts[bet.player_id] = (playerPayouts[bet.player_id] || 0) + payout;
      }
      await supabase.from('bets').update({ status: won ? 'won' : 'lost', payout: won ? payout : 0 }).eq('id', bet.id);
    }

    for (const [playerId, totalPayout] of Object.entries(playerPayouts)) {
      const { data: prof } = await supabase.from('profiles').select('bank').eq('id', playerId).single();
      if (prof) await supabase.from('profiles').update({ bank: prof.bank + totalPayout }).eq('id', playerId);
    }

    setSettling(null);
    await loadPendingGames();
  }

  async function deleteScorer(id: string) {
    if (!confirm('למחוק שחקן זה מהרשימה?')) return;
    await supabase.from('top_scorers').delete().eq('id', id);
    await loadScorers();
  }

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

  async function loadBetCounts() {
    const { data } = await supabase.from('bets').select('player_id');
    if (!data) return;
    const counts: Record<string, number> = {};
    for (const row of data) counts[row.player_id] = (counts[row.player_id] || 0) + 1;
    setBetCounts(counts);
  }

  async function deletePlayerBets(playerId: string, name: string) {
    if (!confirm(`למחוק את כל ההימורים של ${name}?`)) return;
    setDeleting(playerId);
    await supabase.from('bets').delete().eq('player_id', playerId);
    await loadBetCounts();
    setDeleting(null);
  }

  async function deleteAllBets() {
    if (!confirm('למחוק את כל ההימורים של כולם? פעולה זו בלתי הפיכה.')) return;
    if (!confirm('אתה בטוח לגמרי? כל ההיסטוריה תימחק.')) return;
    setDeleting('all');
    await supabase.from('bets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await loadBetCounts();
    setDeleting(null);
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
    { key: 'data', label: 'נתונים', icon: Database },
    { key: 'scorers', label: 'שערים', icon: Shirt },
    { key: 'results', label: 'תוצאות', icon: CheckSquare },
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
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
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

        {tab === 'data' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">ניהול נתונים</h2>
              <button onClick={loadBetCounts} className="p-2 rounded-lg" style={{background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer'}}>
                <RefreshCw size={15} />
              </button>
            </div>

            {/* Delete all */}
            <div className="card p-4 mb-4" style={{border: '1px solid rgba(248,113,113,0.25)'}}>
              <div className="font-semibold mb-1" style={{color: '#f87171'}}>מחיקת כל ההימורים</div>
              <div className="text-xs mb-3" style={{color: 'var(--text-muted)'}}>מוחק את כל הרשומות מטבלת הימורים של כל השחקנים</div>
              <button
                onClick={deleteAllBets}
                disabled={deleting === 'all'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
                style={{background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', cursor: 'pointer'}}
              >
                <Trash2 size={14} />
                {deleting === 'all' ? 'מוחק...' : 'מחק הכל'}
              </button>
            </div>

            {/* Per player */}
            <h3 className="font-semibold text-sm mb-3" style={{color: 'var(--text-muted)'}}>מחיקה לפי שחקן</h3>
            <div className="flex flex-col gap-2">
              {players.map(p => (
                <div key={p.id} className="card p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.display_name}</div>
                    <div className="text-xs" style={{color: 'var(--text-muted)'}}>{betCounts[p.id] ?? 0} הימורים</div>
                  </div>
                  <button
                    onClick={() => deletePlayerBets(p.id, p.display_name)}
                    disabled={deleting === p.id || !betCounts[p.id]}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs"
                    style={{
                      background: betCounts[p.id] ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(248,113,113,0.3)',
                      color: betCounts[p.id] ? '#f87171' : 'var(--text-muted)',
                      cursor: betCounts[p.id] ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <Trash2 size={11} />
                    {deleting === p.id ? 'מוחק...' : 'מחק'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'scorers' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">מלכי השערים</h2>
              <button onClick={loadScorers} className="p-2 rounded-lg" style={{background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer'}}>
                <RefreshCw size={15} />
              </button>
            </div>

            {/* Add / update scorer */}
            <div className="card p-4 mb-4">
              <div className="font-semibold text-sm mb-3" style={{color: 'var(--gold)'}}>הוספה / עדכון שחקן</div>
              <div className="flex flex-col gap-2 mb-3">
                <input className="input" placeholder="שם שחקן (מזהה ייחודי)" value={newScorer.player_name}
                  onChange={e => setNewScorer(p => ({...p, player_name: e.target.value}))} />
                <input className="input" placeholder="נבחרת (אנגלית, למשל: Brazil)" value={newScorer.team}
                  onChange={e => setNewScorer(p => ({...p, team: e.target.value}))} />
                <div className="flex gap-2">
                  <input className="input" type="number" placeholder="שערים" value={newScorer.goals || ''}
                    onChange={e => setNewScorer(p => ({...p, goals: parseInt(e.target.value) || 0}))} />
                  <input className="input" type="number" placeholder="בישולים" value={newScorer.assists || ''}
                    onChange={e => setNewScorer(p => ({...p, assists: parseInt(e.target.value) || 0}))} />
                </div>
              </div>
              <button className="btn-primary w-full" onClick={upsertScorer} disabled={savingScorer || !newScorer.player_name.trim()}>
                {savingScorer ? 'שומר...' : 'שמור / עדכן'}
              </button>
            </div>

            {/* Current list */}
            {scorers.length === 0
              ? <div className="card p-8 text-center text-sm" style={{color: 'var(--text-muted)'}}>אין נתונים עדיין</div>
              : (
              <div className="flex flex-col gap-2">
                {scorers.map((s, i) => (
                  <div key={s.id} className="card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="bebas text-xl w-6 text-center" style={{color: i === 0 ? 'var(--gold)' : 'var(--text-muted)'}}>{i + 1}</span>
                      <div>
                        <div className="font-semibold text-sm">{s.player_name}</div>
                        <div className="text-xs" style={{color: 'var(--text-muted)'}}>{s.team} · {s.goals} שע׳ · {s.assists} בישולים</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setNewScorer({ player_name: s.player_name, team: s.team, goals: s.goals, assists: s.assists })}
                        className="text-xs px-2 py-1 rounded" style={{background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)'}}>
                        ערוך
                      </button>
                      <button onClick={() => deleteScorer(s.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                        style={{background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', cursor: 'pointer'}}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'results' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">סגירת תוצאות</h2>
              <button onClick={loadPendingGames} className="p-2 rounded-lg" style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text-muted)',cursor:'pointer'}}>
                <RefreshCw size={15}/>
              </button>
            </div>
            <div className="text-xs mb-4" style={{color:'var(--text-muted)'}}>
              הזן תוצאה סופית לכל משחק — כל ההימורים יסגרו אוטומטית והבנקים יתעדכנו.
            </div>

            {pendingGames.length === 0 && (
              <div className="card p-8 text-center text-sm" style={{color:'var(--text-muted)'}}>
                <div className="text-3xl mb-2">✅</div>
                אין הימורים ממתינים לסגירה
              </div>
            )}

            <div className="flex flex-col gap-3">
              {pendingGames.map(game => {
                const sc = scores[game.external_game_id] ?? { home: '', away: '' };
                const isSettling = settling === game.external_game_id;
                const kickoff = new Date(game.kickoff_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
                return (
                  <div key={game.external_game_id} className="card p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{color:'var(--text-muted)'}}>{kickoff}</span>
                      <span className="text-xs" style={{color:'var(--gold)'}}>{game.bets.length} הימורים</span>
                    </div>
                    <div className="font-semibold text-sm text-center mb-3">
                      {teamHe(game.home_team)} <span style={{color:'var(--text-muted)'}}>נגד</span> {teamHe(game.away_team)}
                    </div>
                    <div className="flex items-center gap-3 justify-center mb-3">
                      <input
                        type="number" min="0" max="20" placeholder="0"
                        value={sc.home}
                        onChange={e => setScores(p => ({...p, [game.external_game_id]: {...(p[game.external_game_id]??{home:'',away:''}), home: e.target.value}}))}
                        className="input text-center" style={{width:64, fontSize:'1.3rem', fontWeight:700}}
                      />
                      <span className="bebas text-2xl" style={{color:'var(--text-muted)'}}>:</span>
                      <input
                        type="number" min="0" max="20" placeholder="0"
                        value={sc.away}
                        onChange={e => setScores(p => ({...p, [game.external_game_id]: {...(p[game.external_game_id]??{home:'',away:''}), away: e.target.value}}))}
                        className="input text-center" style={{width:64, fontSize:'1.3rem', fontWeight:700}}
                      />
                    </div>
                    <button
                      onClick={() => settleGame(game)}
                      disabled={isSettling || !sc.home || !sc.away}
                      className="btn-primary w-full"
                      style={{fontSize:'0.85rem'}}
                    >
                      {isSettling ? 'מעדכן...' : '✓ סגור הימורים'}
                    </button>
                  </div>
                );
              })}
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
