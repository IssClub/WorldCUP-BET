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

        {/* מרכז — שם משתמש + סמל קבוצה (לחיץ לפרופיל) */}
        {profile && (
          <button
            onClick={openTeamModal}
            title="הגדרות פרופיל"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, direction: 'rtl',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              borderRadius: 8,
            }}
          >
            {badge && (
              <img src={badge} alt="" width={20} height={20}
                style={{ objectFit: 'contain', flexShrink: 0 }} />
            )}
            <span style={{
              fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)',
              maxWidth: 90, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              {profile.display_name}
            </span>
          </button>
        )}

        {/* שמאל — רענון */}
        {onRefresh ? (
          <button onClick={onRefresh}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4 }}>
            <RefreshCw size={15} />
          </button>
        ) : (
          <div style={{ width: 24 }} />
        )}
      </div>
    </header>
  );
}
