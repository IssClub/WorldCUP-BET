import { useState, useRef } from 'react';
import { LEAGUE_BADGES } from '../lib/leagueBadges';
import { teamHe } from '../lib/teamNames';
import { getGameSlides } from '../lib/derbyFacts';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
}

export default function RoundStories({ games }: { games: Game[] }) {
  const [activeGame, setActiveGame] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const touchStartX = useRef(0);
  const selectorRef = useRef<HTMLDivElement>(null);

  if (!games.length) return null;

  const game = games[Math.min(activeGame, games.length - 1)];
  const slides = getGameSlides(game.home_team, game.away_team, game.kickoff_at);
  const slide = slides[activeSlide];

  const goSlide = (dir: 1 | -1) => {
    const next = activeSlide + dir;
    if (next >= 0 && next < slides.length) setActiveSlide(next);
  };

  const switchGame = (i: number) => {
    setActiveGame(i);
    setActiveSlide(0);
    // scroll selector into view
    selectorRef.current?.children[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>

      {/* ── Game selector ── */}
      <div
        ref={selectorRef}
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          padding: '10px 12px 8px',
          borderBottom: '1px solid var(--border)',
          scrollbarWidth: 'none',
        }}
      >
        {games.map((g, i) => {
          const active = i === activeGame;
          const homeBadge = LEAGUE_BADGES[g.home_team];
          const awayBadge = LEAGUE_BADGES[g.away_team];
          return (
            <button
              key={g.id}
              onClick={() => switchGame(i)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '5px 8px',
                borderRadius: 10,
                border: active ? '1.5px solid var(--green)' : '1.5px solid transparent',
                background: active ? 'color-mix(in srgb, var(--green) 10%, transparent)' : 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {homeBadge && <img src={homeBadge} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />}
                <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', lineHeight: 1 }}>vs</span>
                {awayBadge && <img src={awayBadge} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />}
              </div>
              <div style={{
                fontSize: '0.52rem', fontWeight: 600, lineHeight: 1.2, textAlign: 'center',
                color: active ? 'var(--green)' : 'var(--text-muted)',
                maxWidth: 54, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {teamHe(g.home_team).replace(/["""]/g, '').split(' ').slice(-1)[0]}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Story slide ── */}
      <div
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 40) goSlide(dx < 0 ? 1 : -1);
        }}
        onClick={e => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          goSlide(e.clientX > rect.left + rect.width / 2 ? 1 : -1);
        }}
        style={{
          padding: '18px 16px 14px',
          minHeight: 120,
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          textAlign: 'center',
        }}
      >
        {/* Team logos */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {LEAGUE_BADGES[game.home_team] && (
            <img src={LEAGUE_BADGES[game.home_team]} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⚔️</span>
          {LEAGUE_BADGES[game.away_team] && (
            <img src={LEAGUE_BADGES[game.away_team]} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          )}
        </div>

        {/* Slide label */}
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: 0.5 }}>
          {slide.label.toUpperCase()}
        </div>

        {/* Headline */}
        <div style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.35, maxWidth: 260 }}>
          {slide.headline}
        </div>

        {/* Detail */}
        {slide.detail && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {slide.detail}
          </div>
        )}

        {/* Dots */}
        <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === activeSlide ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === activeSlide ? 'var(--green)' : 'rgba(255,255,255,0.2)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
