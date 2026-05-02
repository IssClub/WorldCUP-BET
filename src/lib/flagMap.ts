// ISO 3166-1 alpha-2 codes for flagcdn.com
const CODES: Record<string, string> = {
  // Americas – CONCACAF
  'Mexico': 'mx', 'United States': 'us', 'USA': 'us', 'Canada': 'ca',
  'Panama': 'pa', 'Costa Rica': 'cr', 'Honduras': 'hn', 'Jamaica': 'jm',
  'Trinidad and Tobago': 'tt', 'Trinidad & Tobago': 'tt',
  'El Salvador': 'sv', 'Guatemala': 'gt', 'Cuba': 'cu', 'Haiti': 'ht',
  'Nicaragua': 'ni', 'Belize': 'bz', 'Antigua and Barbuda': 'ag',
  'Curacao': 'cw', 'Suriname': 'sr', 'Guyana': 'gy',

  // Americas – CONMEBOL
  'Brazil': 'br', 'Argentina': 'ar', 'Colombia': 'co', 'Uruguay': 'uy',
  'Ecuador': 'ec', 'Venezuela': 've', 'Chile': 'cl', 'Peru': 'pe',
  'Paraguay': 'py', 'Bolivia': 'bo',

  // Europe – UEFA
  'Germany': 'de', 'France': 'fr', 'Spain': 'es', 'England': 'gb-eng',
  'Portugal': 'pt', 'Netherlands': 'nl', 'Belgium': 'be', 'Italy': 'it',
  'Croatia': 'hr', 'Switzerland': 'ch', 'Denmark': 'dk', 'Poland': 'pl',
  'Sweden': 'se', 'Norway': 'no', 'Finland': 'fi', 'Iceland': 'is',
  'Austria': 'at', 'Hungary': 'hu', 'Turkey': 'tr', 'Greece': 'gr',
  'Romania': 'ro', 'Serbia': 'rs', 'Ukraine': 'ua', 'Slovakia': 'sk',
  'Czech Republic': 'cz', 'Czechia': 'cz', 'Scotland': 'gb-sct',
  'Wales': 'gb-wls', 'Albania': 'al', 'Georgia': 'ge',
  'Bosnia and Herzegovina': 'ba', 'Bosnia & Herzegovina': 'ba',
  'North Macedonia': 'mk', 'Slovenia': 'si', 'Bulgaria': 'bg',
  'Kosovo': 'xk', 'Montenegro': 'me', 'Moldova': 'md',
  'Belarus': 'by', 'Luxembourg': 'lu', 'Estonia': 'ee',
  'Latvia': 'lv', 'Lithuania': 'lt',

  // Asia – AFC
  'Japan': 'jp', 'South Korea': 'kr', 'Korea Republic': 'kr',
  'Korea DPR': 'kp', 'North Korea': 'kp',
  'Australia': 'au', 'Saudi Arabia': 'sa', 'Iran': 'ir',
  'Iraq': 'iq', 'Jordan': 'jo', 'Uzbekistan': 'uz',
  'China': 'cn', 'China PR': 'cn', 'Indonesia': 'id',
  'Qatar': 'qa', 'UAE': 'ae', 'United Arab Emirates': 'ae',
  'Thailand': 'th', 'Vietnam': 'vn', 'Philippines': 'ph',
  'Bahrain': 'bh', 'India': 'in', 'Oman': 'om', 'Kuwait': 'kw',
  'Syria': 'sy', 'Lebanon': 'lb', 'Palestine': 'ps', 'Kyrgyz Republic': 'kg',
  'Tajikistan': 'tj', 'Myanmar': 'mm', 'Malaysia': 'my',

  // Africa – CAF
  'Morocco': 'ma', 'Nigeria': 'ng', 'Egypt': 'eg', 'Senegal': 'sn',
  'Ghana': 'gh', 'Cameroon': 'cm', 'Tunisia': 'tn', 'Algeria': 'dz',
  'Ivory Coast': 'ci', "Côte d'Ivoire": 'ci', 'Mali': 'ml',
  'South Africa': 'za', 'DR Congo': 'cd', 'Congo DR': 'cd',
  'Democratic Republic of Congo': 'cd', 'Cape Verde': 'cv',
  'Zambia': 'zm', 'Zimbabwe': 'zw', 'Kenya': 'ke', 'Guinea': 'gn',
  'Uganda': 'ug', 'Tanzania': 'tz', 'Angola': 'ao', 'Mozambique': 'mz',
  'Gabon': 'ga', 'Equatorial Guinea': 'gq', 'Mauritania': 'mr',
  'Benin': 'bj', 'Liberia': 'lr', 'Sierra Leone': 'sl', 'Ethiopia': 'et',
  'Comoros': 'km', 'Namibia': 'na', 'Malawi': 'mw',

  // Oceania – OFC
  'New Zealand': 'nz', 'Fiji': 'fj', 'Papua New Guinea': 'pg',

  // Russia (suspended from UEFA, listed separately)
  'Russia': 'ru',
};

export function flagUrl(country: string, size: 'w40' | 'w80' | 'w160' = 'w80'): string {
  const code = CODES[country];
  if (!code) return '';
  return `https://flagcdn.com/${size}/${code}.png`;
}

export function hasFlag(country: string): boolean {
  return country in CODES;
}
