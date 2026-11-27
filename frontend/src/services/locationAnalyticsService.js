import { getApiUrl } from '../utils/apiUrl';

const LOCATION_CONSENT_KEY = 'loopra_location_consent_v1';
const SELECTED_REGION_KEY = 'loopra_selected_region_v1';

export const LOOPRA_REGIONS = [
  'India (Hindi)',
  'Punjab',
  'Maharashtra',
  'Tamil Nadu',
  'Telugu',
  'Karnataka',
  'Kerala',
  'West Bengal',
  'Gujarat',
  'Global'
];

export const mapGeoToLoopraRegion = ({ state = '', country = '' } = {}) => {
  const s = String(state || '').toLowerCase();
  const c = String(country || '').toLowerCase();

  if (s.includes('punjab') || s.includes('chandigarh')) return 'Punjab';
  if (s.includes('maharashtra')) return 'Maharashtra';
  if (s.includes('tamil nadu') || s.includes('puducherry')) return 'Tamil Nadu';
  if (s.includes('telangana') || s.includes('andhra pradesh')) return 'Telugu';
  if (s.includes('karnataka')) return 'Karnataka';
  if (s.includes('kerala')) return 'Kerala';
  if (s.includes('west bengal')) return 'West Bengal';
  if (s.includes('gujarat')) return 'Gujarat';
  if (c && !c.includes('india')) return 'Global';
  return 'India (Hindi)';
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
    return 'prompt';
  },

  async reverseGeocode(lat, lng) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
        {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
      if (!res.ok) return { city: '', state: '', country: '', formattedAddress: '' };
      const data = await res.json();
      const addr = data?.address || {};
      return {
        city: addr.city || addr.town || addr.village || addr.county || '',
        state: addr.state || addr.region || '',
        country: addr.country || '',
        formattedAddress: data?.display_name || ''
      };
    } catch (_) {
      return { city: '', state: '', country: '', formattedAddress: '' };
    }
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
      if (import.meta.env?.DEV) {
        console.debug('[Loopra Geolocation] Calling navigator.geolocation.getCurrentPosition...');
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude, accuracy } = position.coords || {};
            if (import.meta.env?.DEV) {
              console.debug('[Loopra Geolocation] Success:', { latitude, longitude, accuracy });
            }
            this.setConsentStatus('granted');
            const geo = await this.reverseGeocode(latitude, longitude);
            const region = mapGeoToLoopraRegion(geo);
            this.setSavedRegion(region);

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
                state: geo.state,
                country: geo.country,
                formattedAddress: geo.formattedAddress,
                consentGiven: true,
                sessionId
              })
            });
            const data = await res.json().catch(() => ({}));
            resolve({
              success: Boolean(res.ok && data.success),
              location: data.location || geo,
              region
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
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    });
  }
};
