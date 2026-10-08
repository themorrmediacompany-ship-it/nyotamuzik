// MorrMoto genre taxonomy. One source of truth for onboarding, filters, "For you", scene rail and web classification.
// vt/et match engine taxonomy values; kw match lowercased text (title, venue, organizer, source).
export const GROUPS = [
  { id: 'machines', label: 'Machines' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'events', label: 'Kinds of events' }
];

export const GENRES = [
  { id: 'cars', group: 'machines', label: 'Cars', icon: 'car-profile', vt: ['Cars', 'Mixed'], et: [], kw: ['car show', 'car meet', 'cars '] , say: ['car', 'cars', 'auto'] },
  { id: 'motorcycles', group: 'machines', label: 'Motorcycles', icon: 'motorcycle', vt: ['Motorcycles'], et: ['Bike Night'], kw: ['motorcycle', 'motorcycles', 'harley', 'bike night', 'bike rally', 'biker', 'bikers', 'riders', 'chopper', 'scooter', 'ducati', 'triumph', 'indian motorcycle'], say: ['bike', 'bikes', 'motorcycle', 'motorcycles', 'moto', 'harley', 'riding', 'riders', 'sportbike'] },
  { id: 'trucks', group: 'machines', label: 'Trucks', icon: 'truck', vt: ['Trucks'], et: [], kw: ['truck'], say: ['truck', 'trucks', 'lifted', 'squatted'] },
  { id: 'offroad', group: 'machines', label: 'Off-road', icon: 'mountains', vt: ['Off-road'], et: ['Off-road'], kw: ['off-road', 'off road', 'offroad', 'jeep', 'trail', 'overland', '4x4', '4wd', 'atv', 'utv', 'sxs', 'side-by-side', 'mud', 'rock crawl', 'bronco', 'jamboree'], say: ['off-road', 'offroad', 'off road', 'jeep', 'trail', 'trails', 'overland', '4x4', 'dirt'] },
  { id: 'ev', group: 'machines', label: 'EV', icon: 'lightning', vt: ['EV'], et: [], kw: ['ev ', 'electric', 'tesla', 'rivian'], say: ['ev', 'electric', 'tesla', 'rivian'] },

  { id: 'jdm', group: 'scenes', label: 'JDM', icon: 'car-simple', vt: ['JDM'], et: [], kw: ['jdm', 'japanese', 'import', 'miata', 'subaru', 'nissan', 'toyota', 'honda'], say: ['jdm', 'japanese', 'import', 'imports', 'miata', 'subaru', 'nissan', 'honda', 'toyota', 'mazda'] },
  { id: 'euro', group: 'scenes', label: 'Euro', icon: 'car-simple', vt: ['Euro'], et: [], kw: ['euro', 'porsche', 'bmw', 'audi', 'vw', 'volkswagen', 'mercedes', 'ferrari 296'], say: ['euro', 'european', 'german', 'porsche', 'bmw', 'audi', 'vw', 'volkswagen', 'mercedes', 'italian'] },
  { id: 'american', group: 'scenes', label: 'American muscle', icon: 'car-profile', vt: ['American'], et: [], kw: ['mopar', 'mustang', 'corvette', 'camaro', 'muscle', 'trans-am', 'nascar'], say: ['american', 'muscle', 'mopar', 'mustang', 'corvette', 'camaro', 'challenger', 'hemi'] },
  { id: 'classics', group: 'scenes', label: 'Classics', icon: 'clock-counter-clockwise', vt: ['Classics'], et: [], kw: ['classic', 'antique', 'vintage', 'pistons on the square', 'svra'], say: ['classic', 'classics', 'vintage', 'antique', 'old school', 'restored'] },
  { id: 'exotics', group: 'scenes', label: 'Exotics', icon: 'diamond', vt: ['Exotics'], et: [], kw: ['exotic', 'ferrari', 'lamborghini', 'mclaren', 'supercar'], say: ['exotic', 'exotics', 'supercar', 'supercars', 'ferrari', 'lambo', 'lamborghini', 'mclaren'] },
  { id: 'hotrods', group: 'scenes', label: 'Hot rods + customs', icon: 'wrench', vt: [], et: [], kw: ['hot rod', 'rat rod', 'kustom', 'custom'], say: ['hot rod', 'hotrod', 'rat rod', 'kustom', 'customs'] },
  { id: 'lowriders', group: 'scenes', label: 'Lowriders', icon: 'car', vt: [], et: [], kw: ['lowrider', 'low rider'], say: ['lowrider', 'lowriders', 'low rider'] },
  { id: 'monster', group: 'scenes', label: 'Monster trucks', icon: 'truck-trailer', vt: [], et: [], kw: ['monster truck', 'monster jam', 'tractor pull', 'truck pull', 'demolition derby', 'demo derby'], say: ['monster truck', 'monster trucks', 'monster jam'] },

  { id: 'cnc', group: 'events', label: 'Cars + coffee', icon: 'coffee', vt: [], et: ['Cars & Coffee'], kw: ['coffee', 'caffeine'], say: ['coffee', 'cars and coffee', 'c&c', 'morning meet'] },
  { id: 'meets', group: 'events', label: 'Meets', icon: 'users-three', vt: [], et: ['Meet', 'Club Event'], kw: ['meet', 'meetup', 'club'], say: ['meet', 'meets', 'meetup', 'club', 'hang out'] },
  { id: 'shows', group: 'events', label: 'Shows', icon: 'trophy', vt: [], et: ['Show'], kw: ['show', 'concours', 'show and shine', 'cruise night', 'cruise-in', 'auto show'], say: ['show', 'shows', 'car show', 'concours'] },
  { id: 'cruises', group: 'events', label: 'Cruises + rides', icon: 'path', vt: [], et: ['Cruise', 'Group Ride'], kw: ['cruise', 'group ride', 'poker run'], say: ['cruise', 'cruises', 'drive', 'drives', 'group ride', 'ride', 'rides', 'road trip'] },
  { id: 'track', group: 'events', label: 'Track days', icon: 'flag-checkered', vt: [], et: ['Track Day', 'Autocross'], kw: ['track day', 'track night', 'hpde', 'autocross', 'lapping'], say: ['track', 'track day', 'track days', 'hpde', 'autocross', 'lapping', 'drive the track'] },
  { id: 'racing', group: 'events', label: 'Pro racing', icon: 'flag-banner', vt: [], et: ['Race', 'Major Motorsport'], kw: ['grand prix', 'race', 'racing', 'raceway', 'speedway', 'motogp', 'imsa', 'indycar', 'nascar', 'sprint car', 'stock car', 'dirt track', 'late model'], say: ['race', 'races', 'racing', 'f1', 'formula 1', 'motogp', 'nascar', 'imsa', 'indycar', 'grand prix'] },
  { id: 'drag', group: 'events', label: 'Drag', icon: 'timer', vt: [], et: ['Drag'], kw: ['drag', 'quarter mile', '1/4 mile', 'test and tune'], say: ['drag', 'drag racing', 'quarter mile', 'test and tune'] },
  { id: 'drift', group: 'events', label: 'Drift', icon: 'wind', vt: [], et: [], kw: ['drift'], say: ['drift', 'drifting'] },
  { id: 'karting', group: 'events', label: 'Karting', icon: 'steering-wheel', vt: [], et: ['Karting'], kw: ['kart'], say: ['kart', 'karts', 'karting', 'go kart'] },
  { id: 'motocross', group: 'events', label: 'Motocross + dirt bikes', icon: 'tire', vt: [], et: [], kw: ['motocross', 'mx', 'supercross', 'arenacross', 'dirt bike', 'dirtbike', 'enduro', 'hare scramble', 'flat track', 'trials'], say: ['motocross', 'mx', 'supercross', 'dirt bike', 'dirt bikes', 'enduro'] },
  { id: 'rally', group: 'events', label: 'Rally', icon: 'compass', vt: [], et: ['Rally'], kw: ['rally', 'rallycross'], say: ['rally', 'rallycross'] },
  { id: 'swap', group: 'events', label: 'Swap meets', icon: 'swap', vt: [], et: ['Swap Meet'], kw: ['swap meet', 'parts swap'], say: ['swap', 'swap meet', 'parts'] },
  { id: 'courses', group: 'events', label: 'Courses + licensing', icon: 'student', vt: [], et: ['Course'], kw: ['riding course', 'rider course', 'msf', 'basic rider', 'motorcycle license', 'driving school', 'driver training', 'performance driving school', 'hpde', 'car control clinic', 'teen driver', 'track school', 'racing school', 'off-road training', 'skills clinic'], say: ['course', 'courses', 'class', 'classes', 'license', 'licence', 'training', 'driving school', 'riding school', 'msf', 'hpde', 'lessons'] }
];

export const GENRE = Object.fromEntries(GENRES.map(g => [g.id, g]));

export const matchGenre = (g, x) =>
  (x.vt || []).some(v => g.vt.includes(v)) || (x.et || []).some(t => g.et.includes(t)) || g.kw.some(k => (x.hay || '').includes(k));

// Natural-language intent → structured preferences. Deterministic and local; an LLM can replace it later behind the same shape.
export function parseIntent(text = '') {
  const t = ' ' + text.toLowerCase().replace(/[^a-z0-9&/ -]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const genres = GENRES.filter(g => g.say.some(w => t.includes(' ' + w + ' '))).map(g => g.id);
  const m = t.match(/(\d{1,3})\s*(mi|mile|miles)\b/);
  const radius = m ? Math.min(150, Math.max(5, +m[1])) : /\bclose\b|\bnearby\b|\bnear me\b/.test(t) ? 10 : /road trip|worth the drive|anywhere/.test(t) ? 100 : null;
  const price = /\bfree\b/.test(t) ? 'free' : null;
  const when = /\btonight\b/.test(t) ? 'tonight' : /\btoday\b/.test(t) ? 'today' : /\bweekend\b/.test(t) ? 'weekend' : null;
  const everything = /\beverything\b|\ball of it\b|\banything\b/.test(t) && !genres.length;
  return { genres, radius, price, when, everything };
}

// Web-discovery classifier. Whole-word matching only ("important" must not match "import").
// An event is kept only if it has a real motor signal; generic words (show, meet, club, ride, class) never qualify on their own.
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = k => new RegExp('(^|[^a-z0-9])' + esc(k.trim()) + '($|[^a-z0-9])');
const hasWord = (hay, k) => wordRe(k).test(hay);
const MOTOR = [
  // general
  'car', 'cars', 'auto', 'autos', 'automotive', 'automobile', 'motor', 'motors', 'motorsport', 'motorsports', 'vehicle', 'vehicles', 'horsepower', 'hot rod', 'hot rods', 'rat rod', 'street rod', 'kustom', 'lowrider', 'lowriders', 'show and shine', 'show-n-shine', 'cruise night', 'cruise-in', 'cruise in', 'rod run', 'concours', 'auto show', 'car show', 'car meet', 'car club', 'cars and coffee', 'cars & coffee', 'coffee and cars', 'swap meet', 'auto swap', 'parts swap',
  // two wheels
  'motorcycle', 'motorcycles', 'moto', 'motorbike', 'biker', 'bikers', 'bike night', 'bike show', 'bike rally', 'motorcycle rally', 'chopper', 'choppers', 'bobber', 'cafe racer', 'scooter', 'scooters', 'vespa', 'harley', 'harley-davidson', 'indian motorcycle', 'ducati', 'triumph', 'ktm', 'kawasaki', 'yamaha', 'suzuki', 'bmw motorrad', 'sportbike', 'poker run', 'group ride', 'ride-in', 'msf', 'rider course', 'dirt bike', 'dirt bikes', 'dirtbike', 'motocross', 'mx', 'supercross', 'arenacross', 'enduro', 'hare scramble', 'hare scrambles', 'flat track', 'moto trials', 'hill climb',
  // 4x4 + off-road
  'truck', 'trucks', 'jeep', 'jeeps', '4x4', '4wd', 'off-road', 'offroad', 'off road', 'off-roading', 'overland', 'overlanding', 'rock crawl', 'rock crawling', 'crawler', 'mud', 'mud bog', 'mudding', 'jamboree', 'atv', 'atvs', 'utv', 'utvs', 'sxs', 'side-by-side', 'side by side', 'quad', 'quads', 'rzr', 'polaris', 'can-am', 'bronco', 'broncos', 'land cruiser', '4runner', 'tacoma', 'raptor', 'trail ride', 'monster truck', 'monster trucks', 'monster jam', 'tractor pull', 'truck pull', 'demolition derby', 'demo derby',
  // racing + track
  'race', 'races', 'racing', 'raceway', 'speedway', 'motorsports park', 'dragway', 'drag strip', 'drag racing', 'drag race', 'test and tune', 'grudge', 'grand prix', 'f1', 'formula 1', 'formula one', 'motogp', 'nascar', 'imsa', 'indycar', 'wec', 'sprint car', 'stock car', 'late model', 'dirt track', 'figure 8', 'track day', 'track night', 'hpde', 'autocross', 'time trial', 'time trials', 'scca', 'nasa hpde', 'pca', 'bmw cca', 'rally', 'rallycross', 'drift', 'drifting', 'karting', 'kart', 'karts', 'go-kart', 'go kart', 'cota', 'circuit of the americas', 'harris hill', 'thunderhill', 'driving school', 'racing school',
  // makes + scenes
  'jdm', 'euro', 'porsche', 'ferrari', 'lamborghini', 'mclaren', 'aston martin', 'bentley', 'rolls-royce', 'lotus', 'alfa romeo', 'corvette', 'mustang', 'camaro', 'challenger', 'charger', 'mopar', 'hemi', 'shelby', 'cobra', 'chevy', 'chevrolet', 'ford', 'dodge', 'pontiac', 'oldsmobile', 'buick', 'cadillac', 'datsun', 'miata', 'subaru', 'nissan', 'toyota', 'supra', 'honda', 'acura', 'mazda', 'lexus', 'bmw', 'audi', 'vw', 'volkswagen', 'mercedes', 'mercedes-benz', 'mini cooper', 'tesla', 'rivian', 'electric vehicle', 'model a', 'model t', 'muscle car', 'classic car', 'classic cars', 'antique car', 'vintage car', 'exotic car', 'supercar', 'supercars'
];
// Always disqualifying: not a motor event even if a car word appears.
const NOT_MOTOR_HARD = ['agentic', 'ai builder', 'llm', 'webinar', 'virtual', 'ai', 'a.i.', 'artificial intelligence', 'machine learning', 'genai', 'gen ai', 'chatgpt', 'openai', 'copilot', 'startup', 'startups', 'hackathon', 'developer', 'developers', 'devs', 'coding', 'software', 'saas', 'crypto', 'blockchain', 'pitch night', 'career fair', 'job fair', 'real estate', 'investor', 'investors', 'builder lab', 'meetup.com', 'bicycle', 'cycling', 'cyclists', 'bmx', 'mountain bike', 'mtb', '5k', '10k', 'half marathon', 'marathon', 'fun run', 'yoga', 'book club', 'drag queen', 'drag brunch', 'drag show', 'horse race', 'horse racing', 'boat race', 'rc car', 'slot car', 'hot wheels'];
// Disqualifying only when the motor signal is weak (one hit). Car shows often mention live music, food trucks, networking.
const NOT_MOTOR_SOFT = ['board meeting', 'annual meeting', 'concert', 'music', 'lunchtime', 'performer', 'trivia', 'networking', 'founder', 'founders', 'code', 'gemini', 'food truck', 'food trucks', 'carnival', 'car wash', 'car seat', 'carpool', 'race for the cure', 'rat race'];
export function classify(text = '') {
  const hay = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const motorHits = MOTOR.filter(k => hasWord(hay, k)).length;
  const blocked = NOT_MOTOR_HARD.some(k => hasWord(hay, k)) || (motorHits < 2 && NOT_MOTOR_SOFT.some(k => hasWord(hay, k)));
  const motorized = motorHits > 0 && !blocked;
  const hits = motorized ? GENRES.filter(g => g.kw.some(k => hasWord(hay, k))) : [];
  const vehicle_type = [...new Set(hits.flatMap(g => g.vt.slice(0, 1)))];
  const event_type = [...new Set(hits.flatMap(g => g.et.slice(0, 1)))];
  return { vehicle_type: vehicle_type.length ? vehicle_type : (motorized ? ['Mixed'] : []), event_type: event_type.length ? event_type : (motorized ? ['Meet'] : []), motorized, genres: hits.map(g => g.id) };
}

// Austin-area geofence. Coordinates win; otherwise a known Central Texas town; otherwise the text must say Austin.
const HOME = [30.2672, -97.7431];
export const NEAR_CITIES = ['austin', 'round rock', 'georgetown', 'cedar park', 'leander', 'pflugerville', 'hutto', 'taylor', 'manor', 'elgin', 'bastrop', 'del valle', 'buda', 'kyle', 'san marcos', 'new braunfels', 'lockhart', 'dripping springs', 'wimberley', 'bee cave', 'lakeway', 'marble falls', 'burnet', 'liberty hill', 'jarrell', 'temple', 'belton', 'killeen', 'seguin', 'luling', 'smithville', 'giddings', 'johnson city', 'spicewood', 'horseshoe bay', 'salado', 'florence', 'bertram', 'lago vista', 'jonestown', 'west lake hills', 'sunset valley', 'mustang ridge', 'creedmoor', 'martindale', 'maxwell', 'canyon lake', 'fredericksburg', 'llano', 'gonzales', 'la grange', 'san antonio', 'waco', 'hewitt', 'boerne', 'schertz', 'cibolo', 'converse', 'universal city', 'bandera', 'kerrville', 'columbus', 'caldwell', 'rockdale', 'cameron', 'lampasas', 'copperas cove', 'harker heights', 'nolanville', 'mcgregor'];
export function nearAustin(e, maxMi = 100) {
  if (e.latitude != null && e.longitude != null && !isNaN(+e.latitude)) {
    const R = 3958.8, r = d => d * Math.PI / 180, dLa = r(+e.latitude - HOME[0]), dLo = r(+e.longitude - HOME[1]);
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(r(HOME[0])) * Math.cos(r(+e.latitude)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a)) <= maxMi;
  }
  const c = String(e.city || '').toLowerCase().trim();
  if (c) return NEAR_CITIES.includes(c);
  const t = ' ' + [e.venue, e.address, e.street_address, e.name].filter(Boolean).join(' ').toLowerCase() + ' ';
  return NEAR_CITIES.some(k => hasWord(t, k));
}
