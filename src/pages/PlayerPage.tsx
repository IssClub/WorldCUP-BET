import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../lib/auth';
import { Trophy, LogOut, Coins, TrendingUp, Calendar } from 'lucide-react';

export default function PlayerPage() {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen pitch-bg">
      <header className="sticky top-0 z-10" style={{background: 'rgba(10,14,26,0.95)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(10px)'}}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy size={22} style={{color: 'var(--green)'}} />
            <span className="font-bold">מונדיאל הימורים</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{color: 'var(--text-muted)'}}>{profile?.display_name}</span>
            <button onClick={signOut} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'}}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="stat-card">
            <div className="flex items-center justify-center gap-1 mb-1" style={{color: 'var(--text-muted)'}}>
              <Coins size={14} />
              <span className="text-xs">בנק</span>
            </div>
            <div className="font-bold text-xl" style={{color: 'var(--green)'}}>{profile?.bank.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-center gap-1 mb-1" style={{color: 'var(--text-muted)'}}>
              <TrendingUp size={14} />
              <span className="text-xs">דירוג</span>
            </div>
            <div className="font-bold text-xl">—</div>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-center gap-1 mb-1" style={{color: 'var(--text-muted)'}}>
              <Calendar size={14} />
              <span className="text-xs">הימורים</span>
            </div>
            <div className="font-bold text-xl">0</div>
          </div>
        </div>

        <div className="card p-6 text-center">
          <div className="mb-3" style={{color: 'var(--text-muted)'}}>
            <Calendar size={32} className="mx-auto mb-3" style={{opacity: 0.4}} />
          </div>
          <h3 className="font-bold text-lg mb-1">אין משחקים להיום</h3>
          <p className="text-sm" style={{color: 'var(--text-muted)'}}>כשיהיו משחקים, תוכל להמר עליהם כאן</p>
        </div>
      </div>
    </div>
  );
}
