// MorrMoto geocoding table (Phase 1, hand-maintained).
// Coordinates are a geocoding step, not extraction: every entry carries a precision + provenance.
// Directions links always use the extracted street address when one exists, not these points.
export const AREAS = [
  { id:'georgetown', name:'Georgetown', lat:30.6327, lng:-97.6779 },
  { id:'round-rock', name:'Round Rock', lat:30.5083, lng:-97.6789 },
  { id:'cedar-park', name:'Cedar Park', lat:30.5052, lng:-97.8203 },
  { id:'leander', name:'Leander', lat:30.5788, lng:-97.8531 },
  { id:'pflugerville', name:'Pflugerville', lat:30.4394, lng:-97.6200 },
  { id:'north-austin', name:'North Austin', lat:30.4019, lng:-97.7253 },
  { id:'central-austin', name:'Central Austin', lat:30.2672, lng:-97.7431 },
  { id:'south-austin', name:'South Austin', lat:30.1906, lng:-97.7967 },
  { id:'buda', name:'Buda', lat:30.0852, lng:-97.8403 },
  { id:'kyle', name:'Kyle', lat:29.9891, lng:-97.8772 }
];

const VENUES = {
  'circuit of the americas': { lat:30.1328, lng:-97.6411, precision:'venue', note:'Well-known venue location' },
  'harris hill raceway':     { lat:29.918892, lng:-97.873258, precision:'sourced', note:'Coordinates published for the venue' },
  'georgetown square':       { lat:30.6327, lng:-97.6779, precision:'venue', note:'Williamson County Courthouse square' },
  'bouldin acres':           { lat:30.1650, lng:-97.8335, precision:'approximate', note:'Approximate, from street address' },
  'reveille peak ranch':     { lat:30.7582, lng:-98.2284, precision:'city', note:'City-level (Burnet) until geocoded' }
};
const CITIES = {
  austin:{lat:30.2672,lng:-97.7431}, georgetown:{lat:30.6327,lng:-97.6779}, 'round rock':{lat:30.5083,lng:-97.6789},
  pflugerville:{lat:30.4394,lng:-97.6200}, hutto:{lat:30.5427,lng:-97.5467}, 'cedar park':{lat:30.5052,lng:-97.8203},
  leander:{lat:30.5788,lng:-97.8531}, buda:{lat:30.0852,lng:-97.8403}, kyle:{lat:29.9891,lng:-97.8772},
  'san marcos':{lat:29.8833,lng:-97.9414}, burnet:{lat:30.7582,lng:-98.2284}
};

export function geocode(venue, city, lat, lng) {
  if (lat != null && lng != null) return { lat, lng, precision:'sourced', note:'From source' };
  const v = venue && VENUES[venue.toLowerCase()]; if (v) return v;
  const c = city && CITIES[city.toLowerCase()]; if (c) return { ...c, precision:'city', note:'City-level' };
  return null;
}

export function miles(a, b) {
  const R = 3958.8, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
