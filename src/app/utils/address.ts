/** Shared India-oriented address parse / format / dedupe helpers. */

export type ParsedAddress = {
  street: string;
  apt: string;
  city: string;
  state: string;
  pin: string;
};

/** States recognized when parsing freeform address strings. */
export const INDIA_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Other',
] as const;

const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  mysore: 'Mysuru',
  mysuru: 'Mysuru',
  mangalore: 'Mangaluru',
  mangaluru: 'Mangaluru',
  bombay: 'Mumbai',
  mumbai: 'Mumbai',
  calcutta: 'Kolkata',
  kolkata: 'Kolkata',
  madras: 'Chennai',
  chennai: 'Chennai',
  hyd: 'Hyderabad',
  hyderabad: 'Hyderabad',
  delhi: 'Delhi',
  'new delhi': 'New Delhi',
  pune: 'Pune',
  ahmedabad: 'Ahmedabad',
  jaipur: 'Jaipur',
  surat: 'Surat',
  lucknow: 'Lucknow',
  kanpur: 'Kanpur',
  nagpur: 'Nagpur',
  indore: 'Indore',
  bhopal: 'Bhopal',
  patna: 'Patna',
  chandigarh: 'Chandigarh',
  coimbatore: 'Coimbatore',
  kochi: 'Kochi',
  ernakulam: 'Kochi',
  thrissur: 'Thrissur',
  thiruvananthapuram: 'Thiruvananthapuram',
  trivandrum: 'Thiruvananthapuram',
  visakhapatnam: 'Visakhapatnam',
  vizag: 'Visakhapatnam',
  vadodara: 'Vadodara',
  rajkot: 'Rajkot',
  nashik: 'Nashik',
  faridabad: 'Faridabad',
  ghaziabad: 'Ghaziabad',
  noida: 'Noida',
  gurgaon: 'Gurugram',
  gurugram: 'Gurugram',
  amritsar: 'Amritsar',
  ludhiana: 'Ludhiana',
  agra: 'Agra',
  varanasi: 'Varanasi',
  meerut: 'Meerut',
  hubli: 'Hubballi',
  hubballi: 'Hubballi',
  belagavi: 'Belagavi',
  belgaum: 'Belagavi',
};

function normKey(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function splitParts(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Collapse repeated comma-separated segments (case-insensitive). */
export function dedupeAddressText(raw: unknown): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of splitParts(text)) {
    const key = normKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique.join(', ') || text;
}

function matchState(part: string): string {
  const key = normKey(part);
  if (!key) return '';
  const hit = INDIA_STATES.find((s) => normKey(s) === key);
  return hit || '';
}

function matchCity(part: string): string {
  const key = normKey(part);
  if (!key) return '';
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];
  // Title-case unknown single-token cities only when clearly a place name segment
  if (/^[a-zA-Z][a-zA-Z\s.'-]{1,40}$/.test(part.trim()) && !/\d/.test(part)) {
    // Only treat as city when it looks like a known alias or short place — leave unknown to street
    return '';
  }
  return '';
}

/**
 * Strip trailing city / state / PIN already present in a street line
 * so composing address does not duplicate them.
 */
export function stripLocalityFromStreet(
  street: string,
  loc: { city?: string; state?: string; pin?: string },
): string {
  let parts = splitParts(street);
  const drop = new Set(
    [loc.city, loc.state, loc.pin]
      .map((v) => normKey(String(v || '')))
      .filter(Boolean),
  );
  // Also drop known aliases of the city
  const cityKey = normKey(String(loc.city || ''));
  if (cityKey) {
    for (const [alias, canon] of Object.entries(CITY_ALIASES)) {
      if (normKey(canon) === cityKey || alias === cityKey) drop.add(alias);
    }
  }

  // Remove from the end while matching locality tokens
  while (parts.length) {
    const last = parts[parts.length - 1];
    const key = normKey(last);
    const pinInLast = last.match(/\b(\d{6})\b/);
    if (drop.has(key) || (loc.pin && pinInLast && pinInLast[1] === loc.pin)) {
      parts = parts.slice(0, -1);
      continue;
    }
    // "Bengaluru Karnataka 560023" jammed in one segment
    let trimmed = last;
    let changed = false;
    if (loc.pin) {
      const next = trimmed.replace(new RegExp(`\\b${loc.pin}\\b`, 'g'), '').trim();
      if (next !== trimmed) {
        trimmed = next.replace(/[,\s]+$/g, '').trim();
        changed = true;
      }
    }
    if (loc.state) {
      const re = new RegExp(`\\b${escapeRe(loc.state)}\\b`, 'ig');
      const next = trimmed.replace(re, '').trim();
      if (next !== trimmed) {
        trimmed = next.replace(/[,\s]+$/g, '').trim();
        changed = true;
      }
    }
    if (loc.city) {
      const re = new RegExp(`\\b${escapeRe(loc.city)}\\b`, 'ig');
      const next = trimmed.replace(re, '').trim();
      if (next !== trimmed) {
        trimmed = next.replace(/[,\s]+$/g, '').trim();
        changed = true;
      }
    }
    if (changed) {
      if (trimmed) parts[parts.length - 1] = trimmed;
      else parts = parts.slice(0, -1);
      continue;
    }
    break;
  }

  return parts.join(', ');
}

function escapeRe(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parse a freeform Indian address into structured fields. */
export function parseAddress(raw: unknown): ParsedAddress {
  const cleaned = dedupeAddressText(raw);
  const parts = splitParts(cleaned);

  let pin = '';
  let state = '';
  let city = '';
  const remaining: string[] = [];

  for (const p of parts) {
    const onlyPin = p.match(/^(\d{6})$/);
    if (onlyPin && !pin) {
      pin = onlyPin[1];
      continue;
    }
    const embedded = p.match(/\b(\d{6})\b/);
    if (embedded && !pin) {
      pin = embedded[1];
      const rest = p.replace(embedded[0], '').replace(/[,\s]+/g, ' ').trim();
      if (rest) remaining.push(rest);
      continue;
    }
    remaining.push(p);
  }

  // State: scan from the end
  for (let i = remaining.length - 1; i >= 0; i--) {
    const hit = matchState(remaining[i]);
    if (hit) {
      state = hit;
      remaining.splice(i, 1);
      break;
    }
  }

  // City: known cities from the end, else last leftover segment when state/pin known
  for (let i = remaining.length - 1; i >= 0; i--) {
    const hit = matchCity(remaining[i]);
    if (hit) {
      city = hit;
      remaining.splice(i, 1);
      break;
    }
  }
  if (!city && remaining.length >= 2 && (state || pin)) {
    city = remaining.pop() || '';
  }

  const street = remaining.join(', ');
  return {
    street: street || (city || state || pin ? '' : cleaned),
    apt: '',
    city,
    state,
    pin,
  };
}

/** Compose a single address line without duplicating city/state/PIN. */
export function formatAddress(parts: {
  street?: string;
  apt?: string;
  city?: string;
  state?: string;
  pin?: string;
}): string {
  const city = String(parts.city || '').trim();
  const state = String(parts.state || '').trim();
  const pin = String(parts.pin || '').trim();
  const apt = String(parts.apt || '').trim();
  const street = stripLocalityFromStreet(String(parts.street || '').trim(), { city, state, pin });

  const out = [
    street,
    apt ? (apt.match(/^apt\b/i) ? apt : `Apt ${apt}`) : '',
    [city, state].filter(Boolean).join(', '),
    pin,
  ].filter(Boolean);

  return dedupeAddressText(out.join(', '));
}
