import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OpenverseAudioService {
  constructor() {
    this.baseUrl = 'https://api.openverse.org/v1/audio/';
    this.userAgent = 'Loopra-Music/1.0 (contact@loopra.app)';
    this.cacheDir = path.join(__dirname, '..', 'public', 'audio', 'relax');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  // Search Openverse for CC-licensed audio
  async searchAudio(query, options = {}) {
    const { pageSize = 5, licenseType = 'all-cc', page = 1 } = options;
    const url = new URL(this.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('page_size', String(pageSize));
    url.searchParams.set('page', String(page));
    url.searchParams.set('license_type', licenseType);

    try {
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(6000)
      });

      if (!res.ok) {
        throw new Error(`Openverse API returned status ${res.status}`);
      }

      const data = await res.json();
      return (data.results || []).map(item => this.normalizeTrack(item));
    } catch (err) {
      console.warn(`[OpenverseAudioService] Search error for "${query}":`, err.message);
      return [];
    }
  }

  normalizeTrack(item) {
    const isCommercialSafe = !item.license?.includes('nc') && !item.license?.includes('sampling+');
    return {
      id: item.id || `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title || 'Ambient Sound',
      creator: item.creator || 'Openverse Contributor',
      creatorUrl: item.creator_url || item.foreign_landing_url || '',
      audioUrl: item.url,
      foreignLandingUrl: item.foreign_landing_url || item.url,
      license: (item.license || 'cc0').toUpperCase(),
      licenseVersion: item.license_version || '',
      licenseUrl: item.license_url || `https://creativecommons.org/licenses/${item.license || 'by'}/4.0/`,
      isCommercialSafe,
      filetype: item.filetype || 'mp3',
      filesize: item.filesize || null,
      duration: item.duration ? Math.round(item.duration / 1000) : null,
      source: 'Openverse / Freesound',
      provider: item.provider || 'freesound'
    };
  }

  async verifyAudioUrl(url) {
    if (!url) return { valid: false, error: 'Empty URL' };
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(5000)
      });

      if (!res.ok) {
        return { valid: false, status: res.status, error: `HTTP ${res.status}` };
      }

      const contentType = res.headers.get('content-type') || '';
      const isAudio = contentType.includes('audio') || contentType.includes('octet-stream') || url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.ogg');

      return {
        valid: isAudio && res.status === 200,
        contentType,
        status: res.status
      };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }
}

export const openverseAudioService = new OpenverseAudioService();
