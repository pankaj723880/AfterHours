class ChatBuddyLearningClient {
  constructor() {
    this.localCache = new Map();
    this.lastExecutedAction = null;
  }

  normalizePhrase(phrase = '') {
    return String(phrase)
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async resolveAction(phrase = '', backendUrl = '') {
    const norm = this.normalizePhrase(phrase);
    if (!norm) return null;

    if (this.localCache.has(norm)) {
      return this.localCache.get(norm);
    }

    try {
      const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/chatbuddy/learning/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: norm })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.matched && data.action) {
          this.localCache.set(norm, data.action);
          return data.action;
        }
      }
    } catch (_) {}

    return null;
  }

  async recordExecution({
    userPhrase = '',
    intent = '',
    actionType = 'NONE',
    target = null,
    query = null,
    value = null,
    handler = null,
    success = true,
    backendUrl = '',
    token = null
  }) {
    const norm = this.normalizePhrase(userPhrase);
    const entry = { userPhrase, intent, actionType, target, query, value, handler, success };
    this.lastExecutedAction = { ...entry, timestamp: Date.now() };

    if (norm) {
      if (success) {
        this.localCache.set(norm, entry);
      } else {
        this.localCache.delete(norm);
      }
    }

    try {
      const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch(`${cleanUrl}/api/chatbuddy/learning/record`, {
        method: 'POST',
        headers,
        body: JSON.stringify(entry)
      }).catch(() => {});
    } catch (_) {}
  }

  async recordCorrection(correctedPhrase = '', backendUrl = '', token = null) {
    if (this.lastExecutedAction && Date.now() - this.lastExecutedAction.timestamp < 15000) {
      const failedNorm = this.normalizePhrase(this.lastExecutedAction.userPhrase);
      this.localCache.delete(failedNorm);
    }

    try {
      const cleanUrl = (backendUrl || '').replace(/\/+$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch(`${cleanUrl}/api/chatbuddy/learning/correct`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ correctedPhrase })
      }).catch(() => {});
    } catch (_) {}
  }
}

export const chatBuddyLearningClient = new ChatBuddyLearningClient();
export default chatBuddyLearningClient;
