import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Music Recognition Service
 * Handles external environmental audio recognition via ACRCloud or AudD.
 * If credentials are not configured, gracefully reports configuration requirements
 * without fabricating false recognition results.
 */
export const musicRecognitionService = {
  /**
   * Checks whether an external music recognition provider is configured.
   */
  isConfigured() {
    const hasAcrCloud = Boolean(
      process.env.ACRCLOUD_HOST &&
      process.env.ACRCLOUD_ACCESS_KEY &&
      process.env.ACRCLOUD_SECRET_KEY
    );
    const hasAudD = Boolean(process.env.AUDD_API_TOKEN);
    return hasAcrCloud || hasAudD;
  },

  /**
   * Returns details about the active provider.
   */
  getProviderInfo() {
    if (process.env.ACRCLOUD_HOST && process.env.ACRCLOUD_ACCESS_KEY) {
      return {
        provider: 'acrcloud',
        host: process.env.ACRCLOUD_HOST,
        configured: true
      };
    }
    if (process.env.AUDD_API_TOKEN) {
      return {
        provider: 'audd',
        configured: true
      };
    }
    return {
      provider: 'none',
      configured: false,
      requiredEnvVars: [
        'ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, ACRCLOUD_SECRET_KEY',
        'or AUDD_API_TOKEN'
      ]
    };
  },

  /**
   * Generates ACRCloud HMAC-SHA1 signature.
   */
  buildAcrCloudSignature(httpMethod, httpUri, accessKey, secretKey, timestamp) {
    const stringToSign = [
      httpMethod,
      httpUri,
      accessKey,
      'audio',
      '1',
      timestamp
    ].join('\n');

    return crypto
      .createHmac('sha1', secretKey)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');
  },

  /**
   * Identifies an audio sample buffer using ACRCloud.
   */
  async identifyWithAcrCloud(audioBuffer) {
    const host = process.env.ACRCLOUD_HOST;
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const secretKey = process.env.ACRCLOUD_SECRET_KEY;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.buildAcrCloudSignature('POST', '/v1/identify', accessKey, secretKey, timestamp);

    // Build multipart/form-data boundary
    const boundary = '----LoopraAcrBoundary' + Date.now();
    const crlf = '\r\n';

    let body = Buffer.concat([
      Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="sample"; filename="sample.wav"${crlf}Content-Type: application/octet-stream${crlf}${crlf}`),
      audioBuffer,
      Buffer.from(`${crlf}--${boundary}${crlf}Content-Disposition: form-data; name="access_key"${crlf}${crlf}${accessKey}`),
      Buffer.from(`${crlf}--${boundary}${crlf}Content-Disposition: form-data; name="sample_bytes"${crlf}${crlf}${audioBuffer.length}`),
      Buffer.from(`${crlf}--${boundary}${crlf}Content-Disposition: form-data; name="timestamp"${crlf}${crlf}${timestamp}`),
      Buffer.from(`${crlf}--${boundary}${crlf}Content-Disposition: form-data; name="signature"${crlf}${crlf}${signature}`),
      Buffer.from(`${crlf}--${boundary}${crlf}Content-Disposition: form-data; name="data_type"${crlf}${crlf}audio`),
      Buffer.from(`${crlf}--${boundary}${crlf}Content-Disposition: form-data; name="signature_version"${crlf}${crlf}1`),
      Buffer.from(`${crlf}--${boundary}--${crlf}`)
    ]);

    const url = host.startsWith('http') ? `${host}/v1/identify` : `https://${host}/v1/identify`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      },
      body
    });

    if (!response.ok) {
      throw new Error(`ACRCloud returned HTTP status ${response.status}`);
    }

    const data = await response.json();
    if (data.status?.code === 0 && data.metadata?.music?.[0]) {
      const music = data.metadata.music[0];
      return {
        success: true,
        provider: 'acrcloud',
        title: music.title || 'Unknown Title',
        artist: (music.artists || []).map(a => a.name).join(', ') || 'Unknown Artist',
        album: music.album?.name || null,
        releaseDate: music.release_date || null,
        score: music.score || 100,
        genres: (music.genres || []).map(g => g.name),
        externalMetadata: {
          label: music.label || null,
          durationMs: music.duration_ms || null
        }
      };
    }

    return {
      success: false,
      provider: 'acrcloud',
      statusCode: data.status?.code,
      message: data.status?.msg || 'No matching music found in ACRCloud audio database'
    };
  },

  /**
   * Identifies an audio sample buffer using AudD.
   */
  async identifyWithAudD(audioBuffer) {
    const apiToken = process.env.AUDD_API_TOKEN;
    const boundary = '----LoopraAudDBoundary' + Date.now();
    const crlf = '\r\n';

    let body = Buffer.concat([
      Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="sample.wav"${crlf}Content-Type: application/octet-stream${crlf}${crlf}`),
      audioBuffer,
      Buffer.from(`${crlf}--${boundary}${crlf}Content-Disposition: form-data; name="api_token"${crlf}${crlf}${apiToken}`),
      Buffer.from(`${crlf}--${boundary}--${crlf}`)
    ]);

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      },
      body
    });

    if (!response.ok) {
      throw new Error(`AudD returned HTTP status ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'success' && data.result) {
      const res = data.result;
      return {
        success: true,
        provider: 'audd',
        title: res.title || 'Unknown Title',
        artist: res.artist || 'Unknown Artist',
        album: res.album || null,
        releaseDate: res.release_date || null,
        score: 95,
        externalMetadata: {
          label: res.label || null
        }
      };
    }

    return {
      success: false,
      provider: 'audd',
      message: data.error?.error_message || 'No matching track found'
    };
  },

  /**
   * Core identification handler.
   * Accepts base64 audio data or binary buffer.
   */
  async identifyAudio({ audioBase64, mimeType = 'audio/webm', durationSeconds = 6 }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        configured: false,
        message: 'External song recognition requires an ACRCloud or AudD API key configured on the server. Please set ACRCLOUD_ACCESS_KEY & ACRCLOUD_SECRET_KEY or AUDD_API_TOKEN in your backend environment variables.',
        requiredEnvVars: [
          'ACRCLOUD_HOST',
          'ACRCLOUD_ACCESS_KEY',
          'ACRCLOUD_SECRET_KEY',
          'or AUDD_API_TOKEN'
        ]
      };
    }

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return {
        success: false,
        error: 'Missing or invalid audioBase64 data in request'
      };
    }

    // Strip data URI header if present
    const cleanBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
    const audioBuffer = Buffer.from(cleanBase64, 'base64');

    if (audioBuffer.length < 1000) {
      return {
        success: false,
        error: 'Audio sample too short. Please capture at least 4-6 seconds of music.'
      };
    }

    // Call active provider
    if (process.env.ACRCLOUD_HOST && process.env.ACRCLOUD_ACCESS_KEY) {
      return await this.identifyWithAcrCloud(audioBuffer);
    }
    if (process.env.AUDD_API_TOKEN) {
      return await this.identifyWithAudD(audioBuffer);
    }

    return {
      success: false,
      configured: false,
      message: 'No supported music recognition provider found'
    };
  }
};

