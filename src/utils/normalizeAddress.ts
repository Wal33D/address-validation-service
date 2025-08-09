/**
 * Comprehensive address normalization utility
 * Standardizes addresses for consistent comparison and matching
 */

// Comprehensive street type mappings
const STREET_TYPES: Record<string, string> = {
  // Common abbreviations
  dr: 'drive',
  st: 'street',
  ave: 'avenue',
  av: 'avenue',
  rd: 'road',
  ct: 'court',
  crt: 'court',
  ln: 'lane',
  blvd: 'boulevard',
  pkwy: 'parkway',
  pky: 'parkway',
  pl: 'place',
  cir: 'circle',
  crl: 'circle',
  hwy: 'highway',
  hiway: 'highway',
  terr: 'terrace',
  ter: 'terrace',
  trl: 'trail',
  trail: 'trail',
  way: 'way',
  wy: 'way',

  // Extended street types
  aly: 'alley',
  alley: 'alley',
  arc: 'arcade',
  arcade: 'arcade',
  bayou: 'bayou',
  byu: 'bayou',
  bch: 'beach',
  beach: 'beach',
  bend: 'bend',
  bnd: 'bend',
  blf: 'bluff',
  bluff: 'bluff',
  blfs: 'bluffs',
  bluffs: 'bluffs',
  btm: 'bottom',
  bottom: 'bottom',
  br: 'branch',
  branch: 'branch',
  brdg: 'bridge',
  bridge: 'bridge',
  brg: 'bridge',
  brk: 'brook',
  brook: 'brook',
  brks: 'brooks',
  brooks: 'brooks',
  burg: 'burg',
  bg: 'burg',
  burgs: 'burgs',
  byp: 'bypass',
  bypass: 'bypass',
  byps: 'bypass',
  camp: 'camp',
  cp: 'camp',
  canyn: 'canyon',
  canyon: 'canyon',
  cnyn: 'canyon',
  cape: 'cape',
  cpe: 'cape',
  cswy: 'causeway',
  causeway: 'causeway',
  causway: 'causeway',
  ctr: 'center',
  center: 'center',
  centre: 'center',
  cntr: 'center',
  ctrs: 'centers',
  centers: 'centers',
  chase: 'chase',
  chs: 'chase',
  clb: 'club',
  club: 'club',
  clf: 'cliff',
  cliff: 'cliff',
  clfs: 'cliffs',
  cliffs: 'cliffs',
  cmn: 'common',
  common: 'common',
  cmns: 'commons',
  commons: 'commons',
  cor: 'corner',
  corner: 'corner',
  cors: 'corners',
  corners: 'corners',
  crse: 'course',
  course: 'course',
  cove: 'cove',
  cv: 'cove',
  coves: 'coves',
  cvs: 'coves',
  crk: 'creek',
  creek: 'creek',
  cres: 'crescent',
  crescent: 'crescent',
  crest: 'crest',
  crst: 'crest',
  xing: 'crossing',
  crossing: 'crossing',
  xrd: 'crossroad',
  crossroad: 'crossroad',
  xrds: 'crossroads',
  crossroads: 'crossroads',
  curv: 'curve',
  curve: 'curve',
  dale: 'dale',
  dl: 'dale',
  dam: 'dam',
  dm: 'dam',
  div: 'divide',
  divide: 'divide',
  dv: 'divide',
  drv: 'drive',
  drives: 'drives',
  drs: 'drives',
  est: 'estate',
  estate: 'estate',
  ests: 'estates',
  estates: 'estates',
  expy: 'expressway',
  expressway: 'expressway',
  expr: 'expressway',
  express: 'expressway',
  expw: 'expressway',
  ext: 'extension',
  extension: 'extension',
  exts: 'extensions',
  extensions: 'extensions',
  fall: 'fall',
  falls: 'falls',
  fls: 'falls',
  ferry: 'ferry',
  fry: 'ferry',
  field: 'field',
  fld: 'field',
  fields: 'fields',
  flds: 'fields',
  flat: 'flat',
  flt: 'flat',
  flats: 'flats',
  flts: 'flats',
  ford: 'ford',
  frd: 'ford',
  fords: 'fords',
  frds: 'fords',
  forest: 'forest',
  frst: 'forest',
  forge: 'forge',
  frg: 'forge',
  forges: 'forges',
  frgs: 'forges',
  fork: 'fork',
  frk: 'fork',
  forks: 'forks',
  frks: 'forks',
  fort: 'fort',
  ft: 'fort',
  freeway: 'freeway',
  frwy: 'freeway',
  freewy: 'freeway',
  garden: 'garden',
  gardn: 'garden',
  grden: 'garden',
  grdn: 'garden',
  gardens: 'gardens',
  grdns: 'gardens',
  gateway: 'gateway',
  gatway: 'gateway',
  gatewy: 'gateway',
  gtway: 'gateway',
  gtwy: 'gateway',
  glen: 'glen',
  gln: 'glen',
  glens: 'glens',
  glns: 'glens',
  green: 'green',
  grn: 'green',
  greens: 'greens',
  grns: 'greens',
  grove: 'grove',
  grov: 'grove',
  grv: 'grove',
  groves: 'groves',
  grvs: 'groves',
  harbor: 'harbor',
  harb: 'harbor',
  harbr: 'harbor',
  hbr: 'harbor',
  harbors: 'harbors',
  hbrs: 'harbors',
  haven: 'haven',
  hvn: 'haven',
  heights: 'heights',
  hts: 'heights',
  ht: 'heights',
  hill: 'hill',
  hl: 'hill',
  hills: 'hills',
  hls: 'hills',
  hollow: 'hollow',
  hllw: 'hollow',
  holw: 'hollow',
  holws: 'hollow',
  inlet: 'inlet',
  inlt: 'inlet',
  island: 'island',
  is: 'island',
  islnd: 'island',
  islands: 'islands',
  iss: 'islands',
  islnds: 'islands',
  isle: 'isle',
  isles: 'isles',
  junction: 'junction',
  jct: 'junction',
  jction: 'junction',
  junctn: 'junction',
  juncton: 'junction',
  junctions: 'junctions',
  jcts: 'junctions',
  jctns: 'junctions',
  key: 'key',
  ky: 'key',
  keys: 'keys',
  kys: 'keys',
  knoll: 'knoll',
  knl: 'knoll',
  knolls: 'knolls',
  knls: 'knolls',
  lake: 'lake',
  lk: 'lake',
  lakes: 'lakes',
  lks: 'lakes',
  landing: 'landing',
  lndg: 'landing',
  lndng: 'landing',
  light: 'light',
  lgt: 'light',
  lights: 'lights',
  lgts: 'lights',
  loaf: 'loaf',
  lf: 'loaf',
  lock: 'lock',
  lck: 'lock',
  locks: 'locks',
  lcks: 'locks',
  lodge: 'lodge',
  ldg: 'lodge',
  ldge: 'lodge',
  loop: 'loop',
  loops: 'loop',
  mall: 'mall',
  manor: 'manor',
  mnr: 'manor',
  manors: 'manors',
  mnrs: 'manors',
  meadow: 'meadow',
  mdw: 'meadow',
  meadows: 'meadows',
  mdws: 'meadows',
  medows: 'meadows',
  mews: 'mews',
  mill: 'mill',
  ml: 'mill',
  mills: 'mills',
  mls: 'mills',
  mission: 'mission',
  msn: 'mission',
  missn: 'mission',
  motorway: 'motorway',
  mtwy: 'motorway',
  mount: 'mount',
  mt: 'mount',
  mnt: 'mount',
  mountain: 'mountain',
  mtn: 'mountain',
  mntain: 'mountain',
  mntn: 'mountain',
  mntns: 'mountains',
  mountains: 'mountains',
  neck: 'neck',
  nck: 'neck',
  orchard: 'orchard',
  orch: 'orchard',
  orchrd: 'orchard',
  oval: 'oval',
  ovl: 'oval',
  overpass: 'overpass',
  park: 'park',
  prk: 'park',
  parks: 'parks',
  parkway: 'parkway',
  parkways: 'parkways',
  pkwys: 'parkways',
  pass: 'pass',
  passage: 'passage',
  path: 'path',
  paths: 'path',
  pike: 'pike',
  pikes: 'pike',
  pine: 'pine',
  pne: 'pine',
  pines: 'pines',
  pnes: 'pines',
  plain: 'plain',
  pln: 'plain',
  plains: 'plains',
  plns: 'plains',
  plaza: 'plaza',
  plz: 'plaza',
  plza: 'plaza',
  point: 'point',
  pt: 'point',
  points: 'points',
  pts: 'points',
  port: 'port',
  prt: 'port',
  ports: 'ports',
  prts: 'ports',
  prairie: 'prairie',
  pr: 'prairie',
  prarie: 'prairie',
  prr: 'prairie',
  radial: 'radial',
  rad: 'radial',
  radl: 'radial',
  radiel: 'radial',
  ramp: 'ramp',
  ranch: 'ranch',
  ranches: 'ranch',
  rnch: 'ranch',
  rnchs: 'ranch',
  rapid: 'rapid',
  rpd: 'rapid',
  rapids: 'rapids',
  rpds: 'rapids',
  rest: 'rest',
  rst: 'rest',
  ridge: 'ridge',
  rdg: 'ridge',
  rdge: 'ridge',
  ridges: 'ridges',
  rdgs: 'ridges',
  river: 'river',
  riv: 'river',
  rvr: 'river',
  rivr: 'river',
  roads: 'roads',
  rds: 'roads',
  route: 'route',
  row: 'row',
  rue: 'rue',
  run: 'run',
  shoal: 'shoal',
  shl: 'shoal',
  shoals: 'shoals',
  shls: 'shoals',
  shore: 'shore',
  shr: 'shore',
  shores: 'shores',
  shrs: 'shores',
  skyway: 'skyway',
  spring: 'spring',
  spg: 'spring',
  spng: 'spring',
  sprng: 'spring',
  springs: 'springs',
  spgs: 'springs',
  spngs: 'springs',
  sprngs: 'springs',
  spur: 'spur',
  spurs: 'spurs',
  square: 'square',
  sq: 'square',
  sqr: 'square',
  sqre: 'square',
  squ: 'square',
  squares: 'squares',
  sqs: 'squares',
  sqrs: 'squares',
  station: 'station',
  sta: 'station',
  statn: 'station',
  stn: 'station',
  stravenue: 'stravenue',
  stra: 'stravenue',
  stravn: 'stravenue',
  straven: 'stravenue',
  strvn: 'stravenue',
  strvnue: 'stravenue',
  stream: 'stream',
  strm: 'stream',
  streme: 'stream',
  streets: 'streets',
  sts: 'streets',
  summit: 'summit',
  smt: 'summit',
  sumit: 'summit',
  sumitt: 'summit',
  throughway: 'throughway',
  trace: 'trace',
  trce: 'trace',
  traces: 'trace',
  track: 'track',
  trak: 'track',
  trk: 'track',
  trks: 'track',
  tracks: 'track',
  trafficway: 'trafficway',
  trfy: 'trafficway',
  trails: 'trails',
  trls: 'trails',
  trailer: 'trailer',
  trlr: 'trailer',
  trlrs: 'trailer',
  tunnel: 'tunnel',
  tunel: 'tunnel',
  tunl: 'tunnel',
  tunls: 'tunnel',
  tunnels: 'tunnel',
  tunnl: 'tunnel',
  turnpike: 'turnpike',
  trnpk: 'turnpike',
  tpke: 'turnpike',
  turnpk: 'turnpike',
  underpass: 'underpass',
  union: 'union',
  un: 'union',
  unions: 'unions',
  valley: 'valley',
  vally: 'valley',
  vlly: 'valley',
  vly: 'valley',
  valleys: 'valleys',
  vlys: 'valleys',
  viaduct: 'viaduct',
  via: 'viaduct',
  viadct: 'viaduct',
  view: 'view',
  vw: 'view',
  views: 'views',
  vws: 'views',
  village: 'village',
  vill: 'village',
  villag: 'village',
  villg: 'village',
  villiage: 'village',
  vlg: 'village',
  villages: 'villages',
  vlgs: 'villages',
  ville: 'ville',
  vl: 'ville',
  vista: 'vista',
  vis: 'vista',
  vist: 'vista',
  vst: 'vista',
  vsta: 'vista',
  walk: 'walk',
  walks: 'walks',
  wall: 'wall',
  ways: 'ways',
  well: 'well',
  wl: 'well',
  wells: 'wells',
  wls: 'wells',
};

// Direction mappings (including periods and variations)
const DIRECTIONS: Record<string, string> = {
  n: 'north',
  'n.': 'north',
  no: 'north',
  'no.': 'north',
  north: 'north',
  nrth: 'north',
  s: 'south',
  's.': 'south',
  so: 'south',
  'so.': 'south',
  south: 'south',
  sth: 'south',
  e: 'east',
  'e.': 'east',
  east: 'east',
  est: 'east',
  w: 'west',
  'w.': 'west',
  west: 'west',
  wst: 'west',
  ne: 'northeast',
  'n.e.': 'northeast',
  northeast: 'northeast',
  nw: 'northwest',
  'n.w.': 'northwest',
  northwest: 'northwest',
  se: 'southeast',
  's.e.': 'southeast',
  southeast: 'southeast',
  sw: 'southwest',
  's.w.': 'southwest',
  southwest: 'southwest',
};

// Unit/apartment type mappings
const UNIT_TYPES: Record<string, string> = {
  apt: 'apartment',
  'apt.': 'apartment',
  appt: 'apartment',
  apartment: 'apartment',
  ste: 'suite',
  'ste.': 'suite',
  suite: 'suite',
  unit: 'unit',
  bldg: 'building',
  'bldg.': 'building',
  building: 'building',
  fl: 'floor',
  'fl.': 'floor',
  flr: 'floor',
  floor: 'floor',
  rm: 'room',
  'rm.': 'room',
  room: 'room',
  dept: 'department',
  'dept.': 'department',
  department: 'department',
  ofc: 'office',
  office: 'office',
  ph: 'penthouse',
  penthouse: 'penthouse',
  bsmt: 'basement',
  basement: 'basement',
  lbby: 'lobby',
  lobby: 'lobby',
  lot: 'lot',
  pier: 'pier',
  slip: 'slip',
  space: 'space',
  spc: 'space',
  stop: 'stop',
  trlr: 'trailer',
  trailer: 'trailer',
  upper: 'upper',
  uppr: 'upper',
  lower: 'lower',
  lowr: 'lower',
  rear: 'rear',
  front: 'front',
  frnt: 'front',
  side: 'side',
};

// State abbreviations to full names
const STATES: Record<string, string> = {
  al: 'alabama',
  ak: 'alaska',
  az: 'arizona',
  ar: 'arkansas',
  ca: 'california',
  co: 'colorado',
  ct: 'connecticut',
  de: 'delaware',
  dc: 'district of columbia',
  fl: 'florida',
  ga: 'georgia',
  hi: 'hawaii',
  id: 'idaho',
  il: 'illinois',
  in: 'indiana',
  ia: 'iowa',
  ks: 'kansas',
  ky: 'kentucky',
  la: 'louisiana',
  me: 'maine',
  md: 'maryland',
  ma: 'massachusetts',
  mi: 'michigan',
  mn: 'minnesota',
  ms: 'mississippi',
  mo: 'missouri',
  mt: 'montana',
  ne: 'nebraska',
  nv: 'nevada',
  nh: 'new hampshire',
  nj: 'new jersey',
  nm: 'new mexico',
  ny: 'new york',
  nc: 'north carolina',
  nd: 'north dakota',
  oh: 'ohio',
  ok: 'oklahoma',
  or: 'oregon',
  pa: 'pennsylvania',
  ri: 'rhode island',
  sc: 'south carolina',
  sd: 'south dakota',
  tn: 'tennessee',
  tx: 'texas',
  ut: 'utah',
  vt: 'vermont',
  va: 'virginia',
  wa: 'washington',
  wv: 'west virginia',
  wi: 'wisconsin',
  wy: 'wyoming',
};

// Common prefix/suffix transformations
const PREFIXES: Record<string, string> = {
  mt: 'mount',
  'mt.': 'mount',
  ft: 'fort',
  'ft.': 'fort',
  st: 'saint',
  'st.': 'saint',
  ste: 'sainte',
  'ste.': 'sainte',
};

// Ordinal number mappings
const ORDINALS: Record<string, string> = {
  '1st': 'first',
  '2nd': 'second',
  '3rd': 'third',
  '4th': 'fourth',
  '5th': 'fifth',
  '6th': 'sixth',
  '7th': 'seventh',
  '8th': 'eighth',
  '9th': 'ninth',
  '10th': 'tenth',
  '11th': 'eleventh',
  '12th': 'twelfth',
  '13th': 'thirteenth',
  '14th': 'fourteenth',
  '15th': 'fifteenth',
  '16th': 'sixteenth',
  '17th': 'seventeenth',
  '18th': 'eighteenth',
  '19th': 'nineteenth',
  '20th': 'twentieth',
  '21st': 'twenty first',
  '22nd': 'twenty second',
  '23rd': 'twenty third',
  '24th': 'twenty fourth',
  '25th': 'twenty fifth',
  '26th': 'twenty sixth',
  '27th': 'twenty seventh',
  '28th': 'twenty eighth',
  '29th': 'twenty ninth',
  '30th': 'thirtieth',
  '31st': 'thirty first',
  '40th': 'fortieth',
  '50th': 'fiftieth',
  '60th': 'sixtieth',
  '70th': 'seventieth',
  '80th': 'eightieth',
  '90th': 'ninetieth',
  '100th': 'hundredth',
};

/**
 * Enhanced address normalization function
 * @param address - The address string to normalize
 * @returns Normalized address string
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';

  let normalized = address.toLowerCase();

  // Handle ampersand specifically before removing punctuation
  normalized = normalized.replace(/&/g, ' and ');

  // Handle compound direction abbreviations with periods (S.E., N.W., etc.)
  normalized = normalized.replace(/\bs\.e\./gi, 'southeast');
  normalized = normalized.replace(/\bn\.e\./gi, 'northeast');
  normalized = normalized.replace(/\bs\.w\./gi, 'southwest');
  normalized = normalized.replace(/\bn\.w\./gi, 'northwest');

  // Remove all punctuation except spaces and hyphens (initially)
  normalized = normalized.replace(/[^\w\s-]/g, ' ');

  // Normalize multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ');

  // Split into tokens for processing
  const tokens = normalized.split(' ').filter(token => token.length > 0);

  // Process each token
  const processedTokens = tokens.map((token, index) => {
    // Check if it's an ordinal number
    if (ORDINALS[token]) {
      return ORDINALS[token];
    }

    // Check if it might be a numeric ordinal (e.g., "42nd")
    const ordinalMatch = token.match(/^(\d+)(st|nd|rd|th)$/);
    if (ordinalMatch) {
      if (ORDINALS[token]) {
        return ORDINALS[token];
      }
      // For unhandled ordinals, just use the number
      return ordinalMatch[1];
    }

    // Check if it's a direction
    if (DIRECTIONS[token]) {
      return DIRECTIONS[token];
    }

    // Special handling for 'st' which could be 'saint' or 'street'
    // Must check this BEFORE checking street types
    if (token === 'st') {
      // Check if next token looks like a saint name (common ones)
      // This check happens regardless of what comes before 'st'
      if (
        index < tokens.length - 1 &&
        (tokens[index + 1] === 'johns' ||
          tokens[index + 1] === 'john' ||
          tokens[index + 1] === 'mary' ||
          tokens[index + 1] === 'marys' ||
          tokens[index + 1] === 'paul' ||
          tokens[index + 1] === 'pauls' ||
          tokens[index + 1] === 'peter' ||
          tokens[index + 1] === 'peters' ||
          tokens[index + 1] === 'james' ||
          tokens[index + 1] === 'joseph' ||
          tokens[index + 1] === 'anthony' ||
          tokens[index + 1] === 'francis' ||
          tokens[index + 1] === 'louis' ||
          tokens[index + 1] === 'george' ||
          tokens[index + 1] === 'patrick' ||
          tokens[index + 1] === 'thomas' ||
          tokens[index + 1] === 'michael')
      ) {
        return 'saint';
      }
      // Default to street
      return 'street';
    }

    // Check if it's a street type (other than 'st' which we handled above)
    if (STREET_TYPES[token]) {
      return STREET_TYPES[token];
    }

    // Check if it's a unit type
    if (UNIT_TYPES[token]) {
      return UNIT_TYPES[token];
    }

    // Check if it's a state abbreviation (only at end of address or near end)
    if (index >= tokens.length - 3) {
      if (STATES[token]) {
        return STATES[token];
      }
    }

    // Check for other special prefixes (mt, ft, etc.)
    if (index === 0 || (index > 0 && !tokens[index - 1].match(/^\d+$/))) {
      if (PREFIXES[token] && token !== 'st') {
        // Exclude 'st' as we handled it above
        return PREFIXES[token];
      }
    }

    // Handle common compound abbreviations
    if (token === 'po' && index < tokens.length - 1 && tokens[index + 1] === 'box') {
      return 'post office';
    }

    // Remove common noise words (but keep 'and' from ampersand conversion)
    if (['the', 'of', 'at'].includes(token)) {
      return '';
    }

    // Handle number symbols
    if (token === '#' || token === 'no' || token === 'number') {
      return '';
    }

    return token;
  });

  // Filter out empty tokens and join
  normalized = processedTokens.filter(token => token.length > 0).join(' ');

  // Handle ZIP+4 codes (remove the +4 part)
  normalized = normalized.replace(/\b(\d{5})-?\d{4}\b/g, '$1');

  // Remove any remaining hyphens
  normalized = normalized.replace(/-/g, ' ');

  // Final whitespace normalization
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// Export a simpler version for backwards compatibility
export function simpleNormalizeAddress(address: string): string {
  if (!address) return '';

  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove all punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Utility function to check if two addresses match after normalization
export function addressesMatch(addr1: string, addr2: string): boolean {
  return normalizeAddress(addr1) === normalizeAddress(addr2);
}

// Utility to extract just the street address part (remove city, state, zip)
export function extractStreetAddress(address: string): string {
  if (!address) return '';

  // Remove ZIP code patterns
  let street = address.replace(/\b\d{5}(-\d{4})?\b/g, '');

  // Remove state patterns (2 letter abbreviations at end)
  street = street.replace(/\b[A-Z]{2}\b\s*$/i, '');

  // Remove common city/state separators and everything after
  street = street.split(',')[0];

  return street.trim();
}
