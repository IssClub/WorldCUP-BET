// ISO 3166-1 alpha-2 codes for flagcdn.com
const CODES: Record<string, string> = {
  'Mexico': 'mx', 'South Africa': 'za', 'United States': 'us',
  'Canada': 'ca', 'Brazil': 'br', 'Argentina': 'ar',
  'Germany': 'de', 'France': 'fr', 'Spain': 'es',
  'England': 'gb-eng', 'Portugal': 'pt', 'Netherlands': 'nl',
  'Belgium': 'be', 'Italy': 'it', 'Croatia': 'hr',
  'Switzerland': 'ch', 'Denmark': 'dk', 'Poland': 'pl',
  'Japan': 'jp', 'South Korea': 'kr', 'Australia': 'au',
  'Saudi Arabia': 'sa', 'Iran': 'ir', 'Morocco': 'ma',
  'Senegal': 'sn', 'Ghana': 'gh', 'Nigeria': 'ng',
  'Cameroon': 'cm', 'Egypt': 'eg', 'Tunisia': 'tn',
  'Ecuador': 'ec', 'Uruguay': 'uy', 'Colombia': 'co',
  'Costa Rica': 'cr', 'Panama': 'pa', 'Jamaica': 'jm',
  'Serbia': 'rs', 'Ukraine': 'ua', 'Sweden': 'se',
  'Qatar': 'qa', "Côte d'Ivoire": 'ci', 'Ivory Coast': 'ci',
  'New Zealand': 'nz', 'Wales': 'gb-wls', 'Scotland': 'gb-sct',
  'Austria': 'at', 'Hungary': 'hu', 'Turkey': 'tr',
  'Albania': 'al', 'Uzbekistan': 'uz', 'Indonesia': 'id',
  'Venezuela': 've', 'Chile': 'cl', 'Peru': 'pe',
  'Honduras': 'hn', 'Paraguay': 'py', 'Bolivia': 'bo',
  'Slovakia': 'sk', 'Czech Republic': 'cz', 'Greece': 'gr',
  'Romania': 'ro', 'Norway': 'no', 'Finland': 'fi',
  'Iceland': 'is', 'Algeria': 'dz', 'Jordan': 'jo',
  'El Salvador': 'sv', 'Trinidad and Tobago': 'tt',
  'Cuba': 'cu', 'Guatemala': 'gt', 'Russia': 'ru',
  'Cape Verde': 'cv', 'Mali': 'ml', 'Guinea': 'gn',
  'Kenya': 'ke', 'Zambia': 'zm', 'Zimbabwe': 'zw',
  'Iraq': 'iq', 'UAE': 'ae', 'Bahrain': 'bh',
  'China': 'cn', 'India': 'in', 'Thailand': 'th',
  'Vietnam': 'vn', 'Philippines': 'ph',
};

export function flagUrl(country: string, size: 'w40' | 'w80' | 'w160' = 'w80'): string {
  const code = CODES[country];
  if (!code) return '';
  return `https://flagcdn.com/${size}/${code}.png`;
}

export function hasFlag(country: string): boolean {
  return country in CODES;
}
