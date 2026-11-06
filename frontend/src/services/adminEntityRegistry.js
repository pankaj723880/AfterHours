
/**
 * Loopra Client Admin Entity Registry
 * 
 * Provides centralized discovery of platform entities managed under the Admin Dashboard.
 */

export const ADMIN_ENTITIES = [
  { id: 'users', label: 'Users & Roles', category: 'governance', endpoint: '/api/admin/users' },
  { id: 'offline_licenses', label: 'Offline Track Licenses', category: 'music_rights', endpoint: '/api/offline/admin/licenses' },
  { id: 'curated_collections', label: 'Curated Music Collections', category: 'music_content', endpoint: '/api/admin/cms/collections' },
  { id: 'reviews', label: 'Ratings & Reviews', category: 'moderation', endpoint: '/api/reviews/admin' },
  { id: 'activities', label: 'Activity Moderation', category: 'moderation', endpoint: '/api/admin/activities' },
  { id: 'voice_control', label: 'Voice Control & Feature Flags', category: 'system_control', endpoint: '/api/feature-flags/admin' },
  { id: 'cms_settings', label: 'Global Branding & Themes', category: 'branding', endpoint: '/api/admin/cms/config' },
  { id: 'cms_layout', label: 'Layout & Navigation', category: 'branding', endpoint: '/api/admin/cms/config' },
  { id: 'cms_music', label: 'Nostalgia Stations & Music', category: 'branding', endpoint: '/api/admin/cms/config' },
  { id: 'cms_media', label: 'Media Library', category: 'branding', endpoint: '/api/admin/cms/media' },
  { id: 'audit', label: 'Audit Logs', category: 'security', endpoint: '/api/admin/audit-logs' }
];

export const fetchAdminRegistry = async (backendUrl, token) => {
  if (!token) return { success: false, error: 'Authentication required' };
  try {
    const res = await fetch(`${backendUrl}/api/admin/registry`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message, entities: ADMIN_ENTITIES };
  }
};

