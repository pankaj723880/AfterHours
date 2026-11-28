import { getApiUrl } from '../utils/apiUrl.js';

const LOCATION_CONSENT_KEY = 'loopra_location_consent_v1';
const SELECTED_REGION_KEY = 'loopra_selected_region_v1';

export const LOOPRA_REGIONS = [
  'India (Hindi)',
  'Garhwal (Garhwali + Hindi)',
  'Kumaon (Kumaoni + Hindi)',
  'UP East / Bihar (Bhojpuri + Hindi)',
  'Mithilanchal (Maithili + Hindi)',
  'Magadh (Magahi + Hindi)',
  'Anga / Bhagalpur (Angika + Hindi)',
  'Himachal (Pahadi + Hindi)',
  'Jharkhand (Nagpuri/Khortha + Hindi)',
  'Punjab',
  'Maharashtra',
  'Tamil Nadu',
  'Telugu',
  'Karnataka',
  'Kerala',
  'West Bengal / North Bengal',
  'Gujarat',
  'Global'
];

export const REGION_ID_TO_LABEL = {
  'in-hindi': 'India (Hindi)',
  'in-garhwali': 'Garhwal (Garhwali + Hindi)',
  'in-kumaoni': 'Kumaon (Kumaoni + Hindi)',
  'in-bhojpuri': 'UP East / Bihar (Bhojpuri + Hindi)',
  'in-maithili': 'Mithilanchal (Maithili + Hindi)',
  'in-magahi': 'Magadh (Magahi + Hindi)',
  'in-angika': 'Anga / Bhagalpur (Angika + Hindi)',
  'in-himachali': 'Himachal (Pahadi + Hindi)',
  'in-jharkhand': 'Jharkhand (Nagpuri/Khortha + Hindi)',
  'in-punjab': 'Punjab',
  'in-maharashtra': 'Maharashtra',
  'in-tamil': 'Tamil Nadu',
  'in-telugu': 'Telugu',
  'in-karnataka': 'Karnataka',
  'in-kerala': 'Kerala',
  'in-bengal': 'West Bengal / North Bengal',
  'in-gujarat': 'Gujarat',
  'global': 'Global'
};

export const mapGeoToLoopraRegionId = ({ state = '', country = '', city = '', district = '' } = {}) => {
  const s = ` ${city} ${district} ${state} ${country} `.toLowerCase();

  // Uttarakhand sub-regions (Check before general states)
  if (/(nainital|haldwani|almora|pithoragarh|bageshwar|champawat|udham singh nagar|kumaon)/i.test(s)) return 'in-kumaoni';
  if (/(dehradun|rishikesh|haridwar|tehri|pauri|chamoli|uttarkashi|rudraprayag|garhwal|uttarakhand)/i.test(s)) return 'in-garhwali';

  // Himachal Pradesh
  if (/(himachal|shimla|manali|kullu|kangra|dharamshala|mandi|solan|chamba|hamirpur|una|bilaspur|kinnaur|lahaul|spiti)/i.test(s)) return 'in-himachali';

  // Jharkhand
  if (/(jharkhand|ranchi|jamshedpur|dhanbad|bokaro|hazaribagh|deoghar|dumka|giridih|palamu|singhbhum)/i.test(s)) return 'in-jharkhand';

  // Bengal / North Bengal
  if (/(siliguri|darjeeling|jalpaiguri|cooch behar|alipurduar|kalimpong|malda|north bengal)/i.test(s)) return 'in-bengal';
  if (/(west bengal|kolkata|howrah|hooghly|asansol|durgapur)/i.test(s)) return 'in-bengal';

  // Bihar sub-regions
  if (/(darbhanga|madhubani|samastipur|begusarai|saharsa|supaul|mithila)/i.test(s)) return 'in-maithili';
  if (/(patna|\bgaya\b|nalanda|nawada|aurangabad|jehanabad|magadh)/i.test(s)) return 'in-magahi';
  if (/(bhagalpur|munger|banka|jamui|lakhisarai|\banga\b)/i.test(s)) return 'in-angika';
  if (/(champaran|motihari|bettiah|saran|chhapra|siwan|gopalganj|bhojpur|\bara\b|\barrah\b|buxar|bihar)/i.test(s)) return 'in-bhojpuri';

  // UP sub-regions (Purvanchal / Bhojpuri vs Hindi)
  if (/(varanasi|gorakhpur|azamgarh|ballia|ghazipur|jaunpur|deoria|\bmau\b|basti|mirzapur|prayagraj|purvanchal)/i.test(s)) return 'in-bhojpuri';
  if (/(lucknow|ayodhya|faizabad|kanpur|barabanki|sitapur|awadh|agra|mathura|vrindavan|aligarh|meerut|noida|ghaziabad|bareilly|braj|uttar pradesh)/i.test(s)) return 'in-hindi';

  // Major states
  if (/(punjab|chandigarh|haryana|amritsar|ludhiana|jalandhar)/i.test(s)) return 'in-punjab';
  if (/(maharashtra|mumbai|pune|nagpur|nashik|thane)/i.test(s)) return 'in-maharashtra';
  if (/(tamil|chennai|coimbatore|madurai)/i.test(s)) return 'in-tamil';
  if (/(telangana|andhra|hyderabad|visakhapatnam|vijayawada)/i.test(s)) return 'in-telugu';
  if (/(karnataka|bengaluru|bangalore|mysore|hubli)/i.test(s)) return 'in-karnataka';
  if (/(kerala|kochi|thiruvananthapuram|calicut|trivandrum)/i.test(s)) return 'in-kerala';
  if (/(gujarat|ahmedabad|surat|vadodara|rajkot)/i.test(s)) return 'in-gujarat';

  if (s.includes('india')) return 'in-hindi';
  if (country && !s.includes('india')) return 'global';
  return 'in-hindi';
};

export const mapGeoToLoopraRegion = (geo = {}) => {
  const id = mapGeoToLoopraRegionId(geo);
  return REGION_ID_TO_LABEL[id] || 'India (Hindi)';
};

export const resolveSubregionName = ({ state = '', country = '', city = '', district = '' } = {}) => {
  const s = `${city} ${district} ${state} ${country}`.toLowerCase();
  if (/(dehradun|rishikesh|haridwar|tehri|pauri|chamoli|uttarkashi|rudraprayag|garhwal)/i.test(s)) return 'Garhwal';
  if (/(nainital|haldwani|almora|pithoragarh|bageshwar|champawat|udham singh nagar|kumaon)/i.test(s)) return 'Kumaon';
  if (/(himachal|shimla|manali|kullu|kangra|dharamshala|mandi|solan|chamba)/i.test(s)) return 'Himachal (Pahadi)';
  if (/(varanasi|gorakhpur|azamgarh|ballia|ghazipur|jaunpur|deoria|mau|basti|mirzapur|prayagraj|purvanchal)/i.test(s)) return 'Purvanchal / Bhojpuri';
  if (/(darbhanga|madhubani|samastipur|begusarai|saharsa|supaul|mithila)/i.test(s)) return 'Mithilanchal';
  if (/(patna|gaya|nalanda|nawada|aurangabad|jehanabad|magadh)/i.test(s)) return 'Magadh';
  if (/(bhagalpur|munger|banka|jamui|lakhisarai|anga)/i.test(s)) return 'Anga';
  if (/(champaran|motihari|bettiah|saran|chhapra|siwan|gopalganj|bhojpur|ara|buxar)/i.test(s)) return 'West Bihar / Bhojpuri';
  if (/(jharkhand|ranchi|jamshedpur|dhanbad|bokaro)/i.test(s)) return 'Jharkhand';
  if (/(siliguri|darjeeling|jalpaiguri|north bengal)/i.test(s)) return 'North Bengal';
  if (district) return district;
  if (state) return state;
  return '';
};

export const locationAnalyticsService = {
  getConsentStatus() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      return localStorage.getItem(LOCATION_CONSENT_KEY);
    } catch (_) {
      return null;
    }
  },

  setConsentStatus(status) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(LOCATION_CONSENT_KEY, status);
    } catch (_) {}
  },

  getSavedRegion() {
    if (typeof window === 'undefined' || !window.localStorage) return 'India (Hindi)';
    try {
      return localStorage.getItem(SELECTED_REGION_KEY) || 'India (Hindi)';
    } catch (_) {
      return 'India (Hindi)';
    }
  },

  setSavedRegion(region) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(SELECTED_REGION_KEY, region || 'India (Hindi)');
    } catch (_) {}
  },

  async getPermissionState() {
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status?.state || 'prompt'; // 'prompt' | 'granted' | 'denied'
      }
    } catch (_) {}
    const saved = this.getConsentStatus();
    if (saved === 'granted') return 'granted';
    if (saved === 'denied') return 'denied';
    return 'prompt';
  },

  async reverseGeocode(lat, lng) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
        {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
      if (!res.ok) {
        return {
          city: '',
          district: '',
          state: '',
          country: '',
          subregion: '',
          formattedAddress: ''
        };
      }
      const data = await res.json();
      const addr = data?.address || {};
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.hamlet || '';
      const district = addr.state_district || addr.county || addr.district || '';
      const state = addr.state || addr.region || addr.province || '';
      const country = addr.country || '';
      const subregion = resolveSubregionName({ state, country, city, district });
      return {
        city,
        district,
        state,
        country,
        subregion,
        formattedAddress: data?.display_name || [city, district, state, country].filter(Boolean).join(', ')
      };
    } catch (_) {
      return { city: '', district: '', state: '', country: '', subregion: '', formattedAddress: '' };
    }
  },

  /**
   * Called on every app open or resume if location permission has already been granted.
   * Silently captures fresh high-accuracy position and syncs to backend + Admin Dashboard.
   */
  async checkAndSyncExactLocation({ token = null, sessionId = null } = {}) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return { success: false, reason: 'unavailable' };
    }

    const consent = this.getConsentStatus();
    const permState = await this.getPermissionState();

    const isPermitted = permState === 'granted' || consent === 'granted';
    if (!isPermitted) {
      return { success: false, reason: 'unpermitted', permState };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude, accuracy } = position.coords || {};
            this.setConsentStatus('granted');

            const geo = await this.reverseGeocode(latitude, longitude);
            const regionId = mapGeoToLoopraRegionId(geo);
            const regionLabel = REGION_ID_TO_LABEL[regionId] || 'India (Hindi)';
            this.setSavedRegion(regionLabel);

            // Save region metadata for RegionalMusicSection and notify via custom event
            const displayLabel = geo.city
              ? `${geo.city}${geo.district ? ` (${geo.district})` : ''}, ${geo.state || geo.country}`
              : (geo.district || geo.state || geo.country);

            const regionMeta = {
              regionId,
              source: 'gps',
              label: displayLabel,
              coords: { lat: latitude, lng: longitude }
            };

            try {
              localStorage.setItem('loopra_user_region_v2', JSON.stringify(regionMeta));
              localStorage.setItem('loopra_user_region', regionId);
            } catch (_) {}

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('loopra:region:detected', {
                detail: { regionId, label: displayLabel, source: 'gps', coords: { lat: latitude, lng: longitude } }
              }));
            }

            // Report exact location to backend / Socket.io for Admin Dashboard
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(getApiUrl('/api/analytics/location'), {
              method: 'POST',
              headers,
              body: JSON.stringify({
                latitude,
                longitude,
                accuracyMeters: accuracy,
                city: geo.city,
                district: geo.district,
                state: geo.state,
                country: geo.country,
                subregion: geo.subregion,
                formattedAddress: geo.formattedAddress,
                consentGiven: true,
                sessionId
              })
            });
            const data = await res.json().catch(() => ({}));
            resolve({
              success: Boolean(res.ok && data.success),
              location: data.location || geo,
              region: regionLabel,
              regionId,
              coordinates: { latitude, longitude, accuracy }
            });
          } catch (err) {
            resolve({ success: false, reason: 'sync_failed' });
          }
        },
        (err) => {
          if (err?.code === err?.PERMISSION_DENIED || err?.code === 1) {
            this.setConsentStatus('denied');
            resolve({ success: false, reason: 'denied', permissionState: 'denied' });
          } else if (err?.code === err?.TIMEOUT || err?.code === 3) {
            resolve({ success: false, reason: 'timeout' });
          } else {
            resolve({ success: false, reason: 'unavailable' });
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  },

  async requestAndSaveLocation({ token = null, sessionId = null } = {}) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return { success: false, reason: 'unavailable' };
    }

    const permState = await this.getPermissionState();
    if (import.meta.env?.DEV) {
      console.debug('[Loopra Geolocation] Permission state:', permState);
    }

    if (permState === 'denied') {
      this.setConsentStatus('denied');
      return { success: false, reason: 'denied', permissionState: 'denied' };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude, accuracy } = position.coords || {};
            this.setConsentStatus('granted');
            const geo = await this.reverseGeocode(latitude, longitude);
            const regionId = mapGeoToLoopraRegionId(geo);
            const regionLabel = REGION_ID_TO_LABEL[regionId] || 'India (Hindi)';
            this.setSavedRegion(regionLabel);

            const displayLabel = geo.city
              ? `${geo.city}${geo.district ? ` (${geo.district})` : ''}, ${geo.state || geo.country}`
              : (geo.district || geo.state || geo.country);

            const regionMeta = {
              regionId,
              source: 'gps',
              label: displayLabel,
              coords: { lat: latitude, lng: longitude }
            };

            try {
              localStorage.setItem('loopra_user_region_v2', JSON.stringify(regionMeta));
              localStorage.setItem('loopra_user_region', regionId);
            } catch (_) {}

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('loopra:region:detected', {
                detail: { regionId, label: displayLabel, source: 'gps', coords: { lat: latitude, lng: longitude } }
              }));
            }

            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(getApiUrl('/api/analytics/location'), {
              method: 'POST',
              headers,
              body: JSON.stringify({
                latitude,
                longitude,
                accuracyMeters: accuracy,
                city: geo.city,
                district: geo.district,
                state: geo.state,
                country: geo.country,
                subregion: geo.subregion,
                formattedAddress: geo.formattedAddress,
                consentGiven: true,
                sessionId
              })
            });
            const data = await res.json().catch(() => ({}));
            resolve({
              success: Boolean(res.ok && data.success),
              location: data.location || geo,
              region: regionLabel,
              regionId
            });
          } catch (err) {
            resolve({ success: false, reason: 'save_failed' });
          }
        },
        (err) => {
          if (err?.code === err?.PERMISSION_DENIED || err?.code === 1) {
            if (import.meta.env?.DEV) {
              console.debug('[Loopra Geolocation] Permission denied by user/browser.');
            }
            this.setConsentStatus('denied');
            resolve({ success: false, reason: 'denied', permissionState: 'denied' });
          } else if (err?.code === err?.TIMEOUT || err?.code === 3) {
            if (import.meta.env?.DEV) {
              console.debug('[Loopra Geolocation] Request timed out.');
            }
            resolve({ success: false, reason: 'timeout' });
          } else {
            if (import.meta.env?.DEV) {
              console.debug('[Loopra Geolocation] Position unavailable:', err?.message);
            }
            resolve({ success: false, reason: 'unavailable' });
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }
};
