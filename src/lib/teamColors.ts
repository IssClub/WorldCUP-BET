export const TEAM_COLORS: Record<string, string> = {
  "Hapoel Be'er Sheva":          '#DA291C',
  'Hapoel Haifa':                '#CC0000',
  'Maccabi Tel Aviv':            '#004F9F',
  'Maccabi Haifa':               '#1A7A40',
  'Beitar Jerusalem':            '#C8960A',
  'Hapoel Jerusalem':            '#8B0000',
  'Hapoel Tel-Aviv':             '#E30613',
  'Bnei Sakhnin':                '#007A00',
  'Hapoel Ironi Kiryat Shmona':  '#003087',
  'Maccabi Petah Tikva':         '#E05500',
  'Hapoel Petah Tikva':          '#CC0000',
  'Hapoel Ramat Gan':            '#CC0000',
  'Maccabi Netanya':             '#0073C6',
  'Ironi Tiberias':              '#1A3DB5',
};

export function applyTeamTheme(team: string): void {
  const color = TEAM_COLORS[team];
  if (color) {
    document.documentElement.style.setProperty('--green', color);
  }
}

export function resetTeamTheme(): void {
  document.documentElement.style.removeProperty('--green');
}
