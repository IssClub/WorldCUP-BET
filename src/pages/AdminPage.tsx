import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';
import type { Invite, Profile, Settings, Bet } from '../lib/supabase';
import { Plus, Copy, Check, LogOut, Users, Settings as SettingsIcon, Trophy, RefreshCw, Trash2, Database, Shirt, CheckSquare, Star, Activity } from 'lucide-react';
import type { TopScorer, SpecialBet } from '../lib/supabase';
import { teamHe } from '../lib/teamNames';
import { LEAGUE_TEAMS } from '../lib/tournamentOdds';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'invites' | 'players' | 'settings' | 'data' | 'scorers' | 'results' | 'special' | 'activity'>('invites');
  const [betCounts, setBetCounts] = useState<Record<string, number>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [newScorer, setNewScorer] = useState({ player_name: '', team: '', goals: 0, assists: 0 });
  const [savingScorer, setSavingScorer] = useState(false);

  // Edit bank
  const [editingBank, setEditingBank] = useState<string | null>(null);
  const [editBankValue, setEditBankValue] = useState('');
  const [resettingBanks, setResettingBanks] = useState(false);
  const [resetLinkMsg, setResetLinkMsg] = useState<Record<string, string>>({});
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [cleaningSimulation, setCleaningSimulation] = useState(false);
  const [resettingGroupStage, setResettingGroupStage] = useState(false);

  // Special bets settlement
  const [specialBets, setSpecialBets] = useState<SpecialBet[]>([]);
  const [actualWinner, setActualWinner] = useState('');
  const [actualScorer, setActualScorer] = useState('');
  const [actualRelegated1, setActualRelegated1] = useState('');
  const [actualRelegated2, setActualRelegated2] = useState('');
  const [settlingSpecial, setSettlingSpecial] = useState(false);
  const [specialMsg, setSpecialMsg] = useState('');

  // ביטויי זכייה/הפסד לפוש
  const WIN_PHRASES = ['🏆 אלוף!', '👑 מלך!', '🎯 תותח!', '🔥 מי יכול עליך?', '🌟 כוכב!', '🚀 על הגג!'];
  const LOSS_PHRASES = ['😅 יהיה בסדר...', '🤦 אאוץ׳', '💀 רי פי', '🫠 נמס', '🃏 הפעם לא, חבר', '😬 כואב אבל בונה אופי'];
  const randomPhrase = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

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

  const loadSpecialBets = useCallback(async () => {
    const { data } = await supabase.from('special_bets').select('*');
    setSpecialBets((data as SpecialBet[]) || []);
  }, []);

  async function settleSpecialBets() {
    const relegatedPair = [actualRelegated1, actualRelegated2].filter(Boolean);
    if (!actualWinner && !actualScorer && relegatedPair.length < 2) return;
    const lines = [];
    if (actualWinner) lines.push(`זוכה הליגה: ${teamHe(actualWinner)}`);
    if (relegatedPair.length === 2) lines.push(`יורדות: ${teamHe(actualRelegated1)} + ${teamHe(actualRelegated2)}`);
    if (actualScorer) lines.push(`מלך השערים: ${actualScorer}`);
    if (!confirm(`לסגור ניחושי עונה?\n${lines.join('\n')}\n\nפעולה זו בלתי הפיכה.`)) return;

    setSettlingSpecial(true);
    setSpecialMsg('');

    const toSettle = specialBets.filter(sb =>
      (sb.type === 'winner' && actualWinner) ||
      (sb.type === 'top_scorer' && actualScorer) ||
      (sb.type === 'relegated' && relegatedPair.length === 2)
    );

    const playerPayouts: Record<string, number> = {};

    for (const sb of toSettle) {
      let won = false;
      if (sb.type === 'winner')     won = sb.prediction === actualWinner;
      else if (sb.type === 'top_scorer') won = sb.prediction.trim().toLowerCase() === actualScorer.trim().toLowerCase();
      else if (sb.type === 'relegated')  won = relegatedPair.includes(sb.prediction);

      await supabase.from('special_bets')
        .update({ status: won ? 'won' : 'lost' })
        .eq('id', sb.id);

      if (won) {
        const bonus =
          sb.type === 'winner'     ? (settings?.bonus_champion   ?? 200) :
          sb.type === 'top_scorer' ? (settings?.bonus_top_scorer ?? 150) :
                                     (settings?.bonus_relegated  ?? 150);
        playerPayouts[sb.player_id] = (playerPayouts[sb.player_id] || 0) + bonus;
      }
    }

    for (const [playerId, payout] of Object.entries(playerPayouts)) {
      const { data: prof } = await supabase.from('profiles').select('bank').eq('id', playerId).single();
      if (prof) await supabase.from('profiles').update({ bank: prof.bank + payout }).eq('id', playerId);
    }

    await loadSpecialBets();
    setSettlingSpecial(false);
    const winnersCount = Object.keys(playerPayouts).length;
    setSpecialMsg(`✓ נסגר בהצלחה! ${winnersCount} שחקנים זכו בנקודות בונוס.`);
  }

  useEffect(() => {
    loadInvites();
    loadPlayers();
    loadSettings();
    loadBetCounts();
    loadScorers();
    loadPendingGames();
    loadSpecialBets();
  }, [loadInvites, loadPlayers, loadSettings, loadScorers, loadSpecialBets]);

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
    const resultPts = settings?.result_points ?? 3;
    const exactPts = settings?.exact_score_points ?? 5;
    const playerPayouts: Record<string, number> = {};

    for (const bet of game.bets) {
      const won = bet.pick === winner;
      const isExact = won && bet.exact_home !== null && bet.exact_home === homeScore && bet.exact_away === awayScore;
      const payout = isExact ? exactPts : (won ? resultPts : 0);
      if (payout > 0) playerPayouts[bet.player_id] = (playerPayouts[bet.player_id] || 0) + payout;
      await supabase.from('bets').update({ status: won ? 'won' : 'lost', payout, actual_home: homeScore, actual_away: awayScore }).eq('id', bet.id);
    }

    for (const [playerId, totalPayout] of Object.entries(playerPayouts)) {
      const { data: prof } = await supabase.from('profiles').select('bank').eq('id', playerId).single();
      if (prof) await supabase.from('profiles').update({ bank: prof.bank + totalPayout }).eq('id', playerId);
    }

    // עדכן league_schedule כסגור
    await supabase.from('league_schedule')
      .update({ completed: true, home_score: homeScore, away_score: awayScore })
      .eq('id', game.external_game_id);

    // הכנס פושים לתור
    const pushTitle = `⚽ ${teamHe(game.home_team)} ${homeScore}:${awayScore} ${teamHe(game.away_team)}`;
    const pushRows = game.bets.map(bet => {
      const won = bet.pick === winner;
      const payout = playerPayouts[bet.player_id] ?? 0;
      const body = won
        ? `${randomPhrase(WIN_PHRASES)} זכית! ${payout.toLocaleString()} נק׳`
        : `${randomPhrase(LOSS_PHRASES)} הפסד — 0 נק׳`;
      return { player_id: bet.player_id, title: pushTitle, body };
    });
    if (pushRows.length > 0) {
      await supabase.from('push_queue').insert(pushRows);
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

  async function updateBank(playerId: string, newBank: number) {
    await supabase.from('profiles').update({ bank: newBank }).eq('id', playerId);
    setEditingBank(null);
    await loadPlayers();
  }

  async function resetEliminatedBanks() {
    if (!settings) return;
    const eliminated = players.filter(p => p.bank === 0);
    if (eliminated.length === 0) { alert('אין שחקנים עם בנק 0'); return; }
    if (!confirm(`לאפס בנק ל-${eliminated.length} שחקנים שאיבדו הכל?\nכל אחד יקבל ${settings.starting_bank.toLocaleString()} נק׳ מחדש.`)) return;
    setResettingBanks(true);
    for (const p of eliminated) {
      await supabase.from('profiles').update({ bank: settings.starting_bank }).eq('id', p.id);
    }
    await loadPlayers();
    setResettingBanks(false);
  }

  const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-link`;

  async function callEdge(body: object) {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    }).then(r => r.json());
  }

  async function sendResetLink(playerId: string, name: string) {
    const email = prompt(`מה האימייל של ${name}?`);
    if (!email) return;
    setResetLinkMsg(m => ({ ...m, [playerId]: '...' }));
    const res = await callEdge({ action: 'reset', email });
    if (res.error) {
      setResetLinkMsg(m => ({ ...m, [playerId]: `שגיאה: ${res.error}` }));
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: `איפוס סיסמה — ${name}`, url: res.link });
    } else {
      await navigator.clipboard.writeText(res.link);
      setResetLinkMsg(m => ({ ...m, [playerId]: '✓ הועתק!' }));
      setTimeout(() => setResetLinkMsg(m => ({ ...m, [playerId]: '' })), 3000);
    }
  }

  async function deleteUser(playerId: string, name: string) {
    if (!confirm(`למחוק את ${name} לחלוטין?\nכל ההימורים והפרופיל יימחקו ולא ניתן לשחזר.`)) return;
    setDeletingUser(playerId);
    const res = await callEdge({ action: 'delete', userId: playerId });
    setDeletingUser(null);
    if (res.error) { alert(`שגיאה: ${res.error}`); return; }
    await loadPlayers();
  }

  async function deletePlayerBets(playerId: string, name: string) {
    if (!confirm(`למחוק את כל ההימורים של ${name}?`)) return;
    setDeleting(playerId);
    await supabase.from('bets').delete().eq('player_id', playerId);
    await loadBetCounts();
    setDeleting(null);
  }

  async function giveGroupStageBonus() {
    if (!settings) return;
    const bonus = settings.group_stage_bonus ?? 500;
    if (!confirm(
      `בונוס סוף שלב הבתים\n\n` +
      `כל ${players.length} השחקנים יקבלו +${bonus.toLocaleString()} נק׳ על הבנק הקיים.\n` +
      `ההיסטוריה והניחושים נשמרים.\n\nהמשך?`
    )) return;
    setResettingGroupStage(true);
    for (const p of players) {
      await supabase.from('profiles').update({ bank: p.bank + bonus }).eq('id', p.id);
    }
    await loadPlayers();
    setResettingGroupStage(false);
    alert(`✓ בונוס של ${bonus.toLocaleString()} נק׳ חולק לכולם — בהצלחה בשלב הנוקאאוט!`);
  }

  async function cleanSimulation() {
    if (!settings) return;
    const resetTo = settings.use_bank ? settings.starting_bank : 0;
    const resetMsg = settings.use_bank ? `איפוס כל הבנקים ל-${resetTo.toLocaleString()} נק׳` : 'איפוס כל הניקוד ל-0';
    if (!confirm(`ניקוי סימולציה:\n• מחיקת כל ההימורים\n• ${resetMsg}\n• כיבוי כל המשחקים המותאמים\n• ניקוי תור הפושים\n\nהמשך?`)) return;
    if (!confirm('אתה בטוח? פעולה זו בלתי הפיכה.')) return;
    setCleaningSimulation(true);
    // מחק הימורים
    await supabase.from('bets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // אפס בנקים
    const { data: allPlayers } = await supabase.from('profiles').select('id');
    for (const p of (allPlayers ?? [])) {
      await supabase.from('profiles').update({ bank: resetTo }).eq('id', p.id);
    }
    // כבה custom_games
    await supabase.from('custom_games').update({ is_active: false }).eq('is_active', true);
    // נקה push_queue
    await supabase.from('push_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await Promise.all([loadPlayers(), loadBetCounts()]);
    setCleaningSimulation(false);
    alert(`✓ הסימולציה נוקתה — ${resetMsg}`);
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
      use_bank: settings.use_bank,
      starting_bank: settings.starting_bank,
      min_bet: settings.min_bet,
      max_bet: settings.max_bet,
      no_bet_penalty: settings.no_bet_penalty,
      special_bet_stake: settings.special_bet_stake,
      auto_bet_amount: settings.auto_bet_amount,
      group_stage_bonus: settings.group_stage_bonus,
      sport_keys: settings.sport_keys ?? ['soccer_fifa_world_cup'],
      result_points: settings.result_points ?? 3,
      exact_score_points: settings.exact_score_points ?? 5,
      bonus_champion: settings.bonus_champion ?? 200,
      bonus_relegated: settings.bonus_relegated ?? 150,
      bonus_top_scorer: settings.bonus_top_scorer ?? 150,
    }).eq('id', 1);
    setSavingSettings(false);
    setSettingsMsg(error ? 'שגיאה בשמירה' : 'נשמר בהצלחה ✓');
    setTimeout(() => setSettingsMsg(''), 3000);
  }

  const tabs = [
    { key: 'players', label: 'שחקנים', icon: Users },
    { key: 'activity', label: 'פעילות', icon: Activity },
    { key: 'results', label: 'תוצאות', icon: CheckSquare },
    { key: 'scorers', label: 'שערים', icon: Shirt },
    { key: 'special', label: 'ניחושי טורניר', icon: Star },
    { key: 'data', label: 'נתונים', icon: Database },
    { key: 'settings', label: 'הגדרות', icon: SettingsIcon },
    { key: 'invites', label: 'הזמנות', icon: Plus },
  ] as const;

  return (
    <div className="min-h-screen pitch-bg">
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20,
        paddingTop: 'env(safe-area-inset-top)',
        background: 'rgba(10,14,26,0.96)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy size={22} style={{color: 'var(--green)'}} />
            <span className="font-bold text-lg">הבדואים מנחשים</span>
            <span className="badge-admin">Admin</span>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 text-sm" style={{color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer'}}>
            <LogOut size={16} />
            יציאה
          </button>
        </div>
      </header>
      <div className="hdr-spacer" />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
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
              <div className="flex gap-2">
                {settings?.use_bank && (
                  <button
                    onClick={resetEliminatedBanks}
                    disabled={resettingBanks}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium"
                    style={{background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',color:'#fbbf24',cursor:'pointer'}}
                    title="אפס בנק לשחקנים שאיבדו הכל (סוף שלב הבתים)"
                  >
                    {resettingBanks ? '...' : '🔄 הזדמנות שנייה'}
                  </button>
                )}
                <button onClick={loadPlayers} className="p-2 rounded-lg" style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text-muted)',cursor:'pointer'}}>
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {players.map((p, i) => (
                <div key={p.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="bebas text-2xl w-8 text-center" style={{color: i === 0 ? 'var(--gold)' : 'var(--text-muted)'}}>{i + 1}</span>
                      <div>
                        <div className="font-semibold">{p.display_name}</div>
                        <div className="text-xs" style={{color: 'var(--text-muted)'}}>{p.id === profile?.id ? 'אתה' : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingBank === p.id ? (
                        <>
                          <input
                            type="number"
                            className="input text-center"
                            style={{width: 90, fontSize: '0.9rem'}}
                            value={editBankValue}
                            onChange={e => setEditBankValue(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => updateBank(p.id, parseInt(editBankValue) || 0)}
                            className="px-2 py-1 rounded text-xs font-bold"
                            style={{background:'var(--green)',color:'#000',cursor:'pointer'}}
                          >✓</button>
                          <button
                            onClick={() => setEditingBank(null)}
                            className="px-2 py-1 rounded text-xs"
                            style={{background:'var(--surface)',color:'var(--text-muted)',border:'1px solid var(--border)',cursor:'pointer'}}
                          >✕</button>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-lg" style={{color: p.bank === 0 ? '#f87171' : 'var(--green)'}}>{p.bank.toLocaleString()}</span>
                          <span className="text-xs" style={{color: 'var(--text-muted)'}}>נק׳</span>
                          {p.role === 'admin'
                            ? <span className="badge-admin">Admin</span>
                            : (
                              <button
                                onClick={async () => {
                                  if (!confirm(`להפוך את ${p.display_name} לאדמין?`)) return;
                                  await supabase.from('profiles').update({ role: 'admin' }).eq('id', p.id);
                                  await loadPlayers();
                                }}
                                className="px-2 py-1 rounded text-xs"
                                style={{background:'rgba(255,214,0,0.1)',border:'1px solid rgba(255,214,0,0.3)',color:'var(--gold)',cursor:'pointer'}}
                              >👑 אדמין</button>
                            )
                          }
                          <button
                            onClick={() => { setEditingBank(p.id); setEditBankValue(String(p.bank)); }}
                            className="px-2 py-1 rounded text-xs"
                            style={{background:'var(--surface)',color:'var(--text-muted)',border:'1px solid var(--border)',cursor:'pointer'}}
                          >ערוך</button>
                          {p.id !== profile?.id && (
                            <>
                              <button
                                onClick={() => sendResetLink(p.id, p.display_name)}
                                className="px-2 py-1 rounded text-xs"
                                style={{background:'rgba(99,179,237,0.1)',border:'1px solid rgba(99,179,237,0.3)',color:'#63b3ed',cursor:'pointer'}}
                                title="שלח קישור איפוס סיסמה"
                              >{resetLinkMsg[p.id] || '🔑'}</button>
                              <button
                                onClick={() => deleteUser(p.id, p.display_name)}
                                disabled={deletingUser === p.id}
                                className="px-2 py-1 rounded text-xs"
                                style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',cursor:'pointer'}}
                                title="מחק שחקן"
                              >{deletingUser === p.id ? '...' : '🗑'}</button>
                            </>
                          )}
                        </>
                      )}
                    </div>
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

            {/* Group stage bonus — רק במצב בנק */}
            {settings?.use_bank && (
              <div className="card p-4 mb-4" style={{border: '1px solid rgba(99,179,237,0.35)', background: 'rgba(99,179,237,0.04)'}}>
                <div className="font-semibold mb-1" style={{color: '#63b3ed'}}>🎁 בונוס סוף שלב הבתים</div>
                <div className="text-xs mb-3" style={{color: 'var(--text-muted)'}}>
                  מוסיף +{(settings?.group_stage_bonus ?? 500).toLocaleString()} נק׳ לבנק של כל שחקן. הסכום ניתן לשינוי בהגדרות.
                </div>
                <button
                  onClick={giveGroupStageBonus}
                  disabled={resettingGroupStage}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
                  style={{background: 'rgba(99,179,237,0.15)', border: '1px solid rgba(99,179,237,0.5)', color: '#63b3ed', cursor: 'pointer'}}
                >
                  🎁 {resettingGroupStage ? 'מחלק...' : 'חלק בונוס'}
                </button>
              </div>
            )}

            {/* Simulation cleanup */}
            <div className="card p-4 mb-4" style={{border: '1px solid rgba(255,152,0,0.35)', background: 'rgba(255,152,0,0.04)'}}>
              <div className="font-semibold mb-1" style={{color: '#ff9800'}}>🧹 ניקוי סימולציה</div>
              <div className="text-xs mb-3" style={{color: 'var(--text-muted)'}}>
                מוחק את כל ההימורים, מאפס ניקוד ל-{settings?.use_bank ? settings.starting_bank.toLocaleString() : '0'} נק׳, מכבה משחקים מותאמים ומנקה תור פושים
              </div>
              <button
                onClick={cleanSimulation}
                disabled={cleaningSimulation}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
                style={{background: 'rgba(255,152,0,0.15)', border: '1px solid rgba(255,152,0,0.5)', color: '#ff9800', cursor: 'pointer'}}
              >
                🧹 {cleaningSimulation ? 'מנקה...' : 'נקה סימולציה'}
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

        {tab === 'special' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">סגירת ניחושי טורניר</h2>
              <button onClick={loadSpecialBets} className="p-2 rounded-lg" style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text-muted)',cursor:'pointer'}}>
                <RefreshCw size={15}/>
              </button>
            </div>

            {/* סיכום ניחושים */}
            {(() => {
              const winnerBets   = specialBets.filter(sb => sb.type === 'winner');
              const scorerBets   = specialBets.filter(sb => sb.type === 'top_scorer');
              const relegatedBets = specialBets.filter(sb => sb.type === 'relegated');
              const winnerGroups: Record<string, number> = {};
              const scorerGroups: Record<string, number> = {};
              const relegatedGroups: Record<string, number> = {};
              winnerBets.forEach(sb => { winnerGroups[sb.prediction] = (winnerGroups[sb.prediction] || 0) + 1; });
              scorerBets.forEach(sb => { scorerGroups[sb.prediction] = (scorerGroups[sb.prediction] || 0) + 1; });
              relegatedBets.forEach(sb => { relegatedGroups[sb.prediction] = (relegatedGroups[sb.prediction] || 0) + 1; });
              const alreadySettled = specialBets.some(sb => sb.status !== 'pending');

              return (
                <>
                  {alreadySettled && (
                    <div className="card p-4 mb-4" style={{border:'1px solid rgba(0,200,83,0.3)',background:'rgba(0,200,83,0.05)'}}>
                      <div className="font-semibold" style={{color:'var(--green)'}}>✓ ניחושי הטורניר כבר נסגרו</div>
                    </div>
                  )}

                  <div className="card p-4 mb-4">
                    <div className="font-semibold text-sm mb-3" style={{color:'var(--gold)'}}>🏆 זוכה הטורניר — {winnerBets.length} ניחושים</div>
                    {Object.entries(winnerGroups).sort((a,b) => b[1]-a[1]).map(([team, count]) => (
                      <div key={team} className="flex justify-between text-sm py-1" style={{borderBottom:'1px solid var(--border)'}}>
                        <span>{teamHe(team)}</span>
                        <span style={{color:'var(--text-muted)'}}>{count} שחקן{count > 1 ? 'ים' : ''}</span>
                      </div>
                    ))}
                    {winnerBets.length === 0 && <div className="text-sm" style={{color:'var(--text-muted)'}}>אין ניחושים עדיין</div>}
                  </div>

                  <div className="card p-4 mb-4">
                    <div className="font-semibold text-sm mb-3" style={{color:'var(--gold)'}}>📉 יורדות — {relegatedBets.length} ניחושים</div>
                    {Object.entries(relegatedGroups).sort((a,b) => b[1]-a[1]).map(([team, count]) => (
                      <div key={team} className="flex justify-between text-sm py-1" style={{borderBottom:'1px solid var(--border)'}}>
                        <span>{teamHe(team)}</span>
                        <span style={{color:'var(--text-muted)'}}>{count} שחקן{count > 1 ? 'ים' : ''}</span>
                      </div>
                    ))}
                    {relegatedBets.length === 0 && <div className="text-sm" style={{color:'var(--text-muted)'}}>אין ניחושים עדיין</div>}
                  </div>

                  <div className="card p-4 mb-6">
                    <div className="font-semibold text-sm mb-3" style={{color:'var(--gold)'}}>👟 מלך השערים — {scorerBets.length} ניחושים</div>
                    {Object.entries(scorerGroups).sort((a,b) => b[1]-a[1]).map(([player, count]) => (
                      <div key={player} className="flex justify-between text-sm py-1" style={{borderBottom:'1px solid var(--border)'}}>
                        <span>{player}</span>
                        <span style={{color:'var(--text-muted)'}}>{count} שחקן{count > 1 ? 'ים' : ''}</span>
                      </div>
                    ))}
                    {scorerBets.length === 0 && <div className="text-sm" style={{color:'var(--text-muted)'}}>אין ניחושים עדיין</div>}
                  </div>

                  {/* טופס סגירה */}
                  {!alreadySettled && (
                    <div className="card p-5" style={{border:'1px solid rgba(255,214,0,0.2)'}}>
                      <div className="font-bold mb-4" style={{color:'var(--gold)'}}>סגירת ניחושים (סוף יולי 2026)</div>
                      <div className="text-xs mb-4" style={{color:'var(--text-muted)'}}>
                        כל שחקן שניחש נכון יקבל {settings?.special_bet_stake ?? 100} נק׳ בונוס.
                        (ניתן לשנות ב"הגדרות")
                      </div>

                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{color:'var(--text-muted)'}}>🏆 מי זכה בליגה?</label>
                          <select
                            className="input w-full"
                            value={actualWinner}
                            onChange={e => setActualWinner(e.target.value)}
                          >
                            <option value="">— לא מסגר —</option>
                            {LEAGUE_TEAMS.map(t => (
                              <option key={t} value={t}>{teamHe(t)}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2" style={{color:'var(--text-muted)'}}>📉 קבוצה ראשונה שירדה</label>
                          <select
                            className="input w-full"
                            value={actualRelegated1}
                            onChange={e => setActualRelegated1(e.target.value)}
                          >
                            <option value="">— לא מסגר —</option>
                            {LEAGUE_TEAMS.filter(t => t !== actualRelegated2).map(t => (
                              <option key={t} value={t}>{teamHe(t)}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2" style={{color:'var(--text-muted)'}}>📉 קבוצה שנייה שירדה</label>
                          <select
                            className="input w-full"
                            value={actualRelegated2}
                            onChange={e => setActualRelegated2(e.target.value)}
                          >
                            <option value="">— לא מסגר —</option>
                            {LEAGUE_TEAMS.filter(t => t !== actualRelegated1).map(t => (
                              <option key={t} value={t}>{teamHe(t)}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2" style={{color:'var(--text-muted)'}}>👟 מי מלך השערים? (שם מלא)</label>
                          <input
                            className="input w-full"
                            placeholder="שם השחקן — חייב להתאים לניחוש"
                            value={actualScorer}
                            onChange={e => setActualScorer(e.target.value)}
                            dir="auto"
                          />
                          <div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>
                            ההשוואה אינה תלוית רישיות (A = a)
                          </div>
                        </div>

                        {specialMsg && (
                          <div className="text-sm px-3 py-2 rounded-lg" style={{background:'rgba(0,200,83,0.1)',color:'var(--green)',border:'1px solid rgba(0,200,83,0.2)'}}>
                            {specialMsg}
                          </div>
                        )}

                        <button
                          className="btn-primary"
                          onClick={settleSpecialBets}
                          disabled={settlingSpecial || (!actualWinner && !actualScorer && (!actualRelegated1 || !actualRelegated2))}
                        >
                          {settlingSpecial ? 'מעדכן...' : '✓ סגור ניחושים וחלק נקודות'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {tab === 'activity' && (
          <div className="fade-in">
            <h2 className="font-bold text-lg mb-4">פעילות משתמשים</h2>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['שם', 'הצטרף', 'כניסה אחרונה', 'כניסות'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...players]
                    .sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''))
                    .map((p, i) => {
                      const joinedDate = new Date(p.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', timeZone: 'Asia/Jerusalem' });
                      const lastSeen = p.last_seen_at
                        ? new Date(p.last_seen_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })
                        : '—';
                      const daysSince = p.last_seen_at
                        ? Math.floor((Date.now() - new Date(p.last_seen_at).getTime()) / 86400000)
                        : null;
                      const stale = daysSince !== null && daysSince > 7;
                      return (
                        <tr key={p.id} style={{ borderBottom: i < players.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.display_name}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{joinedDate}</td>
                          <td style={{ padding: '10px 14px', color: stale ? '#f87171' : 'var(--text)' }}>
                            {lastSeen}
                            {daysSince !== null && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>
                                ({daysSince === 0 ? 'היום' : `לפני ${daysSince} ימים`})
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--green)' }}>
                            {p.login_count ?? 0}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {players.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>אין שחקנים</div>
              )}
            </div>
          </div>
        )}

        {tab === 'settings' && settings && (
          <div className="fade-in">
            <h2 className="font-bold text-lg mb-4">הגדרות מערכת</h2>
            <div className="card p-6">
              <div className="flex flex-col gap-5">

                {/* ── בחירת ספורט / ליגה ── */}
                <div>
                  <div className="text-sm font-semibold mb-2" style={{color: 'var(--text)'}}>ספורט פעיל</div>
                  <div className="text-xs mb-3" style={{color: 'var(--text-muted)'}}>
                    קובע על איזו ליגה מהמרים — משפיע על לוח המשחקים, הטבלה וסגירת הימורים
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      { key: 'soccer_fifa_world_cup', label: '🌍 FIFA World Cup 2026', sub: 'מונדיאל יוני–יולי 2026' },
                      { key: 'soccer_israel_premier_league', label: '⚽ ליגת העל', sub: 'הליגה הישראלית לכדורגל' },
                    ].map(opt => {
                      const active = (settings.sport_keys ?? ['soccer_fifa_world_cup'])[0] === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setSettings(prev => prev ? {...prev, sport_keys: [opt.key]} : prev)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                            borderRadius: 10, border: active ? '2px solid var(--green)' : '1px solid var(--border)',
                            background: active ? 'rgba(0,200,83,0.06)' : 'transparent',
                            cursor: 'pointer', textAlign: 'right',
                          }}
                        >
                          <span style={{
                            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            border: active ? '5px solid var(--green)' : '2px solid var(--border)',
                            background: active ? 'var(--green)' : 'transparent',
                          }} />
                          <div>
                            <div className="text-sm font-semibold" style={{color: active ? 'var(--green)' : 'var(--text)'}}>{opt.label}</div>
                            <div className="text-xs" style={{color: 'var(--text-muted)'}}>{opt.sub}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{height: 1, background: 'var(--border)'}} />

                {/* ── ניקוד משחק ── */}
                <div>
                  <div className="text-sm font-semibold mb-3" style={{color: 'var(--text)'}}>ניקוד משחק</div>
                  <div className="flex gap-4">
                    <div style={{flex: 1}}>
                      <label className="block text-xs mb-1" style={{color: 'var(--text-muted)'}}>כיוון נכון</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input" style={{width: 72}}
                          value={settings.result_points ?? 3}
                          onChange={e => setSettings(prev => prev ? {...prev, result_points: parseInt(e.target.value) || 0} : prev)}
                        />
                        <span className="text-xs" style={{color: 'var(--text-muted)', whiteSpace: 'nowrap'}}>נק'</span>
                      </div>
                    </div>
                    <div style={{flex: 1}}>
                      <label className="block text-xs mb-1" style={{color: 'var(--text-muted)'}}>תוצאה מדויקת</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input" style={{width: 72}}
                          value={settings.exact_score_points ?? 5}
                          onChange={e => setSettings(prev => prev ? {...prev, exact_score_points: parseInt(e.target.value) || 0} : prev)}
                        />
                        <span className="text-xs" style={{color: 'var(--text-muted)', whiteSpace: 'nowrap'}}>נק'</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{height: 1, background: 'var(--border)'}} />

                {/* ── בונוסי ניחושי ליגה ── */}
                <div>
                  <div className="text-sm font-semibold mb-3" style={{color: 'var(--text)'}}>🏆 בונוסי ניחושי ליגה</div>
                  <div className="flex gap-3">
                    <div style={{flex: 1}}>
                      <label className="block text-xs mb-1" style={{color: 'var(--text-muted)'}}>אלופה</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input" style={{width: 72}}
                          value={settings.bonus_champion ?? 200}
                          onChange={e => setSettings(prev => prev ? {...prev, bonus_champion: parseInt(e.target.value) || 0} : prev)}
                        />
                        <span className="text-xs" style={{color: 'var(--text-muted)', whiteSpace: 'nowrap'}}>נק'</span>
                      </div>
                    </div>
                    <div style={{flex: 1}}>
                      <label className="block text-xs mb-1" style={{color: 'var(--text-muted)'}}>יורדת (לכל ניחוש נכון)</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input" style={{width: 72}}
                          value={settings.bonus_relegated ?? 150}
                          onChange={e => setSettings(prev => prev ? {...prev, bonus_relegated: parseInt(e.target.value) || 0} : prev)}
                        />
                        <span className="text-xs" style={{color: 'var(--text-muted)', whiteSpace: 'nowrap'}}>נק'</span>
                      </div>
                    </div>
                    <div style={{flex: 1}}>
                      <label className="block text-xs mb-1" style={{color: 'var(--text-muted)'}}>מלך שערים</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input" style={{width: 72}}
                          value={settings.bonus_top_scorer ?? 150}
                          onChange={e => setSettings(prev => prev ? {...prev, bonus_top_scorer: parseInt(e.target.value) || 0} : prev)}
                        />
                        <span className="text-xs" style={{color: 'var(--text-muted)', whiteSpace: 'nowrap'}}>נק'</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{height: 1, background: 'var(--border)'}} />

                {/* ── Toggle: מצב בנק / צבירה ── */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold" style={{color: 'var(--text)'}}>מצב בנק נקודות</div>
                      <div className="text-xs mt-0.5" style={{color: 'var(--text-muted)'}}>
                        {settings.use_bank
                          ? 'כל שחקן מתחיל עם בנק — מנכה בהימור, מוסיף בזכייה'
                          : 'צבירה — כל הימור הוא קבוע, רק זכייה מוסיפה לציון'}
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(prev => prev ? {...prev, use_bank: !prev.use_bank} : prev)}
                      style={{
                        width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                        background: settings.use_bank ? 'var(--green)' : 'var(--border)',
                        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: settings.use_bank ? 25 : 3,
                        width: 20, height: 20, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>
                </div>

                {/* ── שדות מצב בנק (גלויים רק כשהמצב פעיל) ── */}
                {settings.use_bank && (
                  <div className="flex flex-col gap-5 fade-in" style={{
                    borderRight: '2px solid rgba(0,200,83,0.3)',
                    paddingRight: 14, marginRight: -2,
                  }}>
                    {[
                      { key: 'starting_bank', label: 'בנק פתיחה לשחקן', hint: 'נקודות' },
                      { key: 'min_bet', label: 'הימור מינימלי', hint: 'נקודות' },
                      { key: 'max_bet', label: 'הימור מקסימלי', hint: 'נקודות' },
                      { key: 'no_bet_penalty', label: 'קנס על אי-הימור', hint: 'נקודות' },
                      { key: 'special_bet_stake', label: 'הימור לניחושי טורניר', hint: 'נקודות' },
                      { key: 'group_stage_bonus', label: 'בונוס סוף שלב הבתים', hint: 'נקודות' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium mb-2" style={{color: 'var(--text-muted)'}}>{field.label}</label>
                        <div className="flex items-center gap-3">
                          <input type="number" className="input"
                            value={settings[field.key as keyof Settings] as number}
                            onChange={e => setSettings(prev => prev ? {...prev, [field.key]: parseInt(e.target.value) || 0} : prev)}
                          />
                          <span className="text-sm" style={{color: 'var(--text-muted)', whiteSpace: 'nowrap'}}>{field.hint}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── שדה מצב צבירה — רק נקודות לכל הימור ── */}
                {!settings.use_bank && (
                  <div className="flex flex-col gap-5 fade-in" style={{
                    borderRight: '2px solid rgba(255,214,0,0.3)',
                    paddingRight: 14, marginRight: -2,
                  }}>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{color: 'var(--text-muted)'}}>נקודות לכל הימור (קבוע)</label>
                      <div className="flex items-center gap-3">
                        <input type="number" className="input"
                          value={settings.auto_bet_amount}
                          onChange={e => setSettings(prev => prev ? {...prev, auto_bet_amount: parseInt(e.target.value) || 0} : prev)}
                        />
                        <span className="text-sm" style={{color: 'var(--text-muted)', whiteSpace: 'nowrap'}}>נקודות</span>
                      </div>
                    </div>
                  </div>
                )}

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
