export interface TeamTheme {
  green:        string;  // primary accent
  greenDark:    string;
  gold:         string;  // secondary accent
  inputAccent:  string;  // border color of filled score inputs
  gcBorder:     string;  // border of game card when bet is filled (secondary color)
  bg:           string;
  surface:      string;
  surface2:     string;
  textMuted:    string;
  cardBg:       string;  // full rgba string
  hdrBg:        string;  // full rgba string
  pitchGlow1:   string;  // full rgba string
  pitchGlow2:   string;
  pitchGlow3:   string;
  pitchStart:   string;
  pitchEnd:     string;
}

export const TEAM_THEMES: Record<string, TeamTheme> = {

  // ── Yellow + Blue ───────────────────────────────────────────────────
  'Maccabi Tel Aviv': {
    green: '#FFD700', greenDark: '#C8A500', gold: '#4A88D8', inputAccent: '#4A88D8', gcBorder: '#4A88D8',
    bg: '#07101e', surface: '#0d1c36', surface2: '#14294e',
    textMuted: '#5878a8',
    cardBg:   'rgba(10,22,50,0.88)',
    hdrBg:    'rgba(5,10,20,0.96)',
    pitchGlow1: 'rgba(255,215,0,0.24)',
    pitchGlow2: 'rgba(0,80,180,0.12)',
    pitchGlow3: 'rgba(255,200,0,0.08)',
    pitchStart: '#07101e', pitchEnd: '#040a14',
  },

  // ── Yellow + Black ──────────────────────────────────────────────────
  'Beitar Jerusalem': {
    green: '#FFD700', greenDark: '#C8A500', gold: '#aa8800', inputAccent: '#FFD700', gcBorder: '#888800',
    bg: '#0d0d0a', surface: '#1a1a14', surface2: '#26261e',
    textMuted: '#888860',
    cardBg:   'rgba(20,20,12,0.90)',
    hdrBg:    'rgba(8,8,5,0.96)',
    pitchGlow1: 'rgba(255,215,0,0.22)',
    pitchGlow2: 'rgba(120,100,0,0.10)',
    pitchGlow3: 'rgba(220,180,0,0.06)',
    pitchStart: '#0d0d0a', pitchEnd: '#070705',
  },

  'Maccabi Netanya': {
    green: '#FFD700', greenDark: '#C8A500', gold: '#004899', inputAccent: '#004899', gcBorder: '#3388CC',
    bg: '#0d0d0a', surface: '#1a1a14', surface2: '#26261e',
    textMuted: '#888860',
    cardBg:   'rgba(20,20,12,0.90)',
    hdrBg:    'rgba(8,8,5,0.96)',
    pitchGlow1: 'rgba(255,215,0,0.22)',
    pitchGlow2: 'rgba(0,72,153,0.12)',
    pitchGlow3: 'rgba(220,180,0,0.06)',
    pitchStart: '#0d0d0a', pitchEnd: '#070705',
  },

  // ── Red + White ─────────────────────────────────────────────────────
  'Hapoel Tel-Aviv': {
    green: '#E30613', greenDark: '#A80000', gold: '#ff6666', inputAccent: '#E30613', gcBorder: '#e0e0e0',
    bg: '#180305', surface: '#280508', surface2: '#36080b',
    textMuted: '#a06060',
    cardBg:   'rgba(38,5,8,0.88)',
    hdrBg:    'rgba(12,2,4,0.96)',
    pitchGlow1: 'rgba(227,6,19,0.28)',
    pitchGlow2: 'rgba(180,0,20,0.10)',
    pitchGlow3: 'rgba(200,0,10,0.06)',
    pitchStart: '#180305', pitchEnd: '#0c0203',
  },

  "Hapoel Be'er Sheva": {
    green: '#DA291C', greenDark: '#9a1a10', gold: '#ff7766', inputAccent: '#DA291C', gcBorder: '#e0e0e0',
    bg: '#180305', surface: '#280508', surface2: '#36080b',
    textMuted: '#a06060',
    cardBg:   'rgba(36,5,8,0.88)',
    hdrBg:    'rgba(12,2,4,0.96)',
    pitchGlow1: 'rgba(218,41,28,0.28)',
    pitchGlow2: 'rgba(170,20,10,0.10)',
    pitchGlow3: 'rgba(190,30,10,0.06)',
    pitchStart: '#180305', pitchEnd: '#0c0203',
  },

  // ── Red + Black ─────────────────────────────────────────────────────
  'Hapoel Haifa': {
    green: '#CC0000', greenDark: '#880000', gold: '#884444', inputAccent: '#CC0000', gcBorder: '#CC0000',
    bg: '#130404', surface: '#200606', surface2: '#2e0a0a',
    textMuted: '#885858',
    cardBg:   'rgba(30,6,6,0.88)',
    hdrBg:    'rgba(10,3,3,0.96)',
    pitchGlow1: 'rgba(204,0,0,0.30)',
    pitchGlow2: 'rgba(150,0,0,0.12)',
    pitchGlow3: 'rgba(180,0,0,0.06)',
    pitchStart: '#130404', pitchEnd: '#0a0202',
  },

  'Hapoel Jerusalem': {
    green: '#CC0000', greenDark: '#880000', gold: '#884444', inputAccent: '#CC0000', gcBorder: '#CC0000',
    bg: '#130404', surface: '#200606', surface2: '#2e0a0a',
    textMuted: '#885858',
    cardBg:   'rgba(30,6,6,0.88)',
    hdrBg:    'rgba(10,3,3,0.96)',
    pitchGlow1: 'rgba(204,0,0,0.30)',
    pitchGlow2: 'rgba(150,0,0,0.12)',
    pitchGlow3: 'rgba(180,0,0,0.06)',
    pitchStart: '#130404', pitchEnd: '#0a0202',
  },

  'Hapoel Ramat Gan': {
    green: '#CC0000', greenDark: '#880000', gold: '#884444', inputAccent: '#CC0000', gcBorder: '#CC0000',
    bg: '#130404', surface: '#200606', surface2: '#2e0a0a',
    textMuted: '#885858',
    cardBg:   'rgba(30,6,6,0.88)',
    hdrBg:    'rgba(10,3,3,0.96)',
    pitchGlow1: 'rgba(204,0,0,0.30)',
    pitchGlow2: 'rgba(150,0,0,0.12)',
    pitchGlow3: 'rgba(180,0,0,0.06)',
    pitchStart: '#130404', pitchEnd: '#0a0202',
  },

  // ── Green + White ────────────────────────────────────────────────────
  'Maccabi Haifa': {
    green: '#19a045', greenDark: '#107830', gold: '#50cc70', inputAccent: '#19a045', gcBorder: '#e0e0e0',
    bg: '#061210', surface: '#0c1e18', surface2: '#142c22',
    textMuted: '#5a9868',
    cardBg:   'rgba(8,26,18,0.88)',
    hdrBg:    'rgba(3,8,6,0.96)',
    pitchGlow1: 'rgba(25,160,69,0.32)',
    pitchGlow2: 'rgba(0,100,50,0.12)',
    pitchGlow3: 'rgba(20,180,60,0.08)',
    pitchStart: '#061210', pitchEnd: '#030a08',
  },

  'Bnei Sakhnin': {
    green: '#007A00', greenDark: '#005000', gold: '#44aa44', inputAccent: '#007A00', gcBorder: '#44aa44',
    bg: '#061210', surface: '#0c1e18', surface2: '#142c22',
    textMuted: '#5a9868',
    cardBg:   'rgba(6,24,14,0.88)',
    hdrBg:    'rgba(3,8,6,0.96)',
    pitchGlow1: 'rgba(0,122,0,0.30)',
    pitchGlow2: 'rgba(0,80,0,0.12)',
    pitchGlow3: 'rgba(0,100,0,0.06)',
    pitchStart: '#061210', pitchEnd: '#030a08',
  },

  // ── Blue + White ─────────────────────────────────────────────────────
  'Hapoel Ironi Kiryat Shmona': {
    green: '#1040AA', greenDark: '#0a2c78', gold: '#4070c0', inputAccent: '#1040AA', gcBorder: '#e0e0e0',
    bg: '#050810', surface: '#0a1020', surface2: '#12182e',
    textMuted: '#486090',
    cardBg:   'rgba(6,12,32,0.88)',
    hdrBg:    'rgba(3,5,10,0.96)',
    pitchGlow1: 'rgba(16,64,170,0.32)',
    pitchGlow2: 'rgba(0,40,140,0.14)',
    pitchGlow3: 'rgba(0,60,180,0.08)',
    pitchStart: '#050810', pitchEnd: '#030508',
  },

  'Hapoel Petah Tikva': {
    green: '#1565C0', greenDark: '#0d4a8a', gold: '#5090e0', inputAccent: '#1565C0', gcBorder: '#e0e0e0',
    bg: '#060c1a', surface: '#0c1830', surface2: '#142442',
    textMuted: '#5878b0',
    cardBg:   'rgba(8,18,45,0.88)',
    hdrBg:    'rgba(4,7,14,0.96)',
    pitchGlow1: 'rgba(21,101,192,0.30)',
    pitchGlow2: 'rgba(0,60,160,0.12)',
    pitchGlow3: 'rgba(30,120,210,0.08)',
    pitchStart: '#060c1a', pitchEnd: '#03060e',
  },

  // ── Blue + Black ─────────────────────────────────────────────────────
  'Ironi Tiberias': {
    green: '#1A3DB5', greenDark: '#122a80', gold: '#4060c0', inputAccent: '#1A3DB5', gcBorder: '#1A3DB5',
    bg: '#060a14', surface: '#0c1228', surface2: '#14203a',
    textMuted: '#5070a8',
    cardBg:   'rgba(8,14,38,0.88)',
    hdrBg:    'rgba(4,6,12,0.96)',
    pitchGlow1: 'rgba(26,61,181,0.30)',
    pitchGlow2: 'rgba(0,40,150,0.14)',
    pitchGlow3: 'rgba(20,60,200,0.08)',
    pitchStart: '#060a14', pitchEnd: '#03050c',
  },

  // ── White + Blue ─────────────────────────────────────────────────────
  'Maccabi Petah Tikva': {
    green: '#dde8ff', greenDark: '#a0b8e0', gold: '#0052A3', inputAccent: '#0052A3', gcBorder: '#0052A3',
    bg: '#080e1a', surface: '#0f1a2e', surface2: '#182640',
    textMuted: '#6888b0',
    cardBg:   'rgba(10,20,45,0.88)',
    hdrBg:    'rgba(5,8,14,0.96)',
    pitchGlow1: 'rgba(200,215,255,0.18)',
    pitchGlow2: 'rgba(0,80,160,0.14)',
    pitchGlow3: 'rgba(180,200,255,0.06)',
    pitchStart: '#080e1a', pitchEnd: '#040810',
  },
};

const DEFAULT_THEME: TeamTheme = {
  green: '#00C853', greenDark: '#007B33', gold: '#FFD600', inputAccent: '#00C853', gcBorder: '#00C853',
  bg: '#0b1e2d', surface: '#132840', surface2: '#1b3352',
  textMuted: '#7da0c0',
  cardBg:   'rgba(19,40,64,0.85)',
  hdrBg:    'rgba(10,14,26,0.96)',
  pitchGlow1: 'rgba(0,210,90,0.28)',
  pitchGlow2: 'rgba(0,120,255,0.08)',
  pitchGlow3: 'rgba(0,200,83,0.06)',
  pitchStart: '#0b1e2d', pitchEnd: '#071524',
};

function setVars(t: TeamTheme) {
  const r = document.documentElement.style;
  r.setProperty('--green',        t.green);
  r.setProperty('--green-dark',   t.greenDark);
  r.setProperty('--gold',         t.gold);
  r.setProperty('--input-accent', t.inputAccent);
  r.setProperty('--gc-border',   t.gcBorder);
  r.setProperty('--bg',          t.bg);
  r.setProperty('--surface',     t.surface);
  r.setProperty('--surface2',    t.surface2);
  r.setProperty('--text-muted',  t.textMuted);
  r.setProperty('--card-bg',     t.cardBg);
  r.setProperty('--hdr-bg',      t.hdrBg);
  r.setProperty('--pitch-glow-1',t.pitchGlow1);
  r.setProperty('--pitch-glow-2',t.pitchGlow2);
  r.setProperty('--pitch-glow-3',t.pitchGlow3);
  r.setProperty('--pitch-start', t.pitchStart);
  r.setProperty('--pitch-end',   t.pitchEnd);
  // also update html background so over-scroll area matches
  document.documentElement.style.background = t.bg;
}

export function applyTeamTheme(team: string): void {
  const theme = TEAM_THEMES[team];
  if (theme) setVars(theme);
}

export function resetTeamTheme(): void {
  setVars(DEFAULT_THEME);
}
