import { RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAppModal } from '../contexts/AppModalContext';
import { LEAGUE_BADGES } from '../lib/leagueBadges';

export default function AppHeader({
  title,
  onRefresh,
}: {
  title: string;
  onRefresh?: () => void;
}) {
  const { profile } = useAuth();
  const { openTeamModal } = useAppModal();
  const badge = profile?.favorite_team ? LEAGUE_BADGES[profile.favorite_team] : null;

  return (
    <header className="hdr">
      <div className="hdr-inner">
        {/* ימין — שם הכרטיסייה */}
        <span className="font-bold">{title}</span>

        {/* שמאל — שם משתמש | סמל קבוצה | רענון (משמאל לימין) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, direction: 'ltr' }}>
          {profile && (
            <button
              onClick={openTeamModal}
              title="הגדרות פרופיל"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              <span style={{
                fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)',
                maxWidth: 90, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {profile.display_name}
              </span>
              {badge && (
                <img src={badge} alt="" width={20} height={20}
                  style={{ objectFit: 'contain', flexShrink: 0 }} />
              )}
            </button>
          )}
          {onRefresh && (
            <button onClick={onRefresh}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={15} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
