/**
 * Loopra Centralized Admin Entity Management Registry
 * 
 * Provides a standardized registry for platform entities, ensuring:
 * 1. Strict server-side role and permission enforcement (requireAdmin).
 * 2. Complete visibility into managed entities and their CRUD capabilities.
 * 3. Safe extension points for future features/entities.
 * 4. Explicit exclusion of sensitive internal system tables from direct CRUD exposure.
 */

export const ADMIN_MANAGED_ENTITIES = [
  {
    id: 'users',
    name: 'Users & Roles',
    modelName: 'User',
    baseEndpoint: '/api/admin/users',
    category: 'governance',
    requiredRole: 'admin',
    operations: ['read', 'update', 'delete'],
    searchableFields: ['username', 'email', 'displayName', 'role'],
    destructiveConfirmationRequired: true,
    isPublicCrud: false,
    description: 'User accounts, role elevation/revocation, security bans, and profile management.'
  },
  {
    id: 'offline_licenses',
    name: 'Offline Track Licenses',
    modelName: 'OfflineTrackLicense',
    baseEndpoint: '/api/offline/admin/licenses',
    category: 'music_rights',
    requiredRole: 'admin',
    operations: ['create', 'read', 'update', 'delete'],
    searchableFields: ['trackId', 'title', 'artist', 'sourceProvider', 'licenseType'],
    destructiveConfirmationRequired: true,
    isPublicCrud: false,
    description: 'Licensed track catalogue authorized for offline encrypted caching and playback.'
  },
  {
    id: 'curated_collections',
    name: 'Curated Music Collections',
    modelName: 'CuratedCollection',
    baseEndpoint: '/api/admin/cms/collections',
    category: 'music_content',
    requiredRole: 'admin',
    operations: ['create', 'read', 'update', 'delete'],
    searchableFields: ['name', 'slug', 'category'],
    destructiveConfirmationRequired: true,
    isPublicCrud: false,
    description: 'Curated playlists, stations, and albums rendered across the public home and explore tabs.'
  },
  {
    id: 'reviews',
    name: 'Community Reviews & Ratings',
    modelName: 'Review',
    baseEndpoint: '/api/reviews/admin',
    category: 'moderation',
    requiredRole: 'admin',
    operations: ['create', 'read', 'update', 'delete'],
    searchableFields: ['title', 'comment', 'authorName', 'username'],
    destructiveConfirmationRequired: true,
    isPublicCrud: false,
    description: 'User feedback, rating moderation, editorial reviews, and score calculations.'
  },
  {
    id: 'activities',
    name: 'Activity Moderation',
    modelName: 'Activity',
    baseEndpoint: '/api/admin/activities',
    category: 'moderation',
    requiredRole: 'admin',
    operations: ['read', 'delete'],
    searchableFields: ['username', 'userDisplayName', 'action', 'trackTitle'],
    destructiveConfirmationRequired: true,
    isPublicCrud: false,
    description: 'Public community social activities, listening history shares, and moderation.'
  },
  {
    id: 'feature_flags',
    name: 'Feature Flags & Voice Control',
    modelName: 'FeatureFlag',
    baseEndpoint: '/api/feature-flags/admin',
    category: 'system_control',
    requiredRole: 'admin',
    operations: ['read', 'update'],
    searchableFields: ['key', 'description'],
    destructiveConfirmationRequired: false,
    isPublicCrud: false,
    description: 'Runtime feature flags, canary rollouts, and real-time voice control switches.'
  },
  {
    id: 'site_config',
    name: 'CMS Site Configuration',
    modelName: 'SiteConfig',
    baseEndpoint: '/api/admin/cms/config',
    category: 'branding',
    requiredRole: 'admin',
    operations: ['read', 'update'],
    searchableFields: ['brandName', 'tagline', 'seoKeywords'],
    destructiveConfirmationRequired: false,
    isPublicCrud: false,
    description: 'Global site branding, themes, announcements, layout, and footer navigation.'
  },
  {
    id: 'media_assets',
    name: 'Media Asset Library',
    modelName: 'MediaAsset',
    baseEndpoint: '/api/admin/cms/media',
    category: 'branding',
    requiredRole: 'admin',
    operations: ['create', 'read', 'delete'],
    searchableFields: ['filename', 'originalName', 'mimeType'],
    destructiveConfirmationRequired: true,
    isPublicCrud: false,
    description: 'Uploaded banners, album artworks, station logos, and preset assets.'
  },
  {
    id: 'audit_logs',
    name: 'Audit Logs',
    modelName: 'AuditLog',
    baseEndpoint: '/api/admin/audit-logs',
    category: 'security',
    requiredRole: 'admin',
    operations: ['read'],
    searchableFields: ['action', 'details', 'username', 'ipAddress'],
    destructiveConfirmationRequired: false,
    isPublicCrud: false,
    description: 'Immutable record of administrator actions, CMS revisions, and permission changes.'
  }
];

// Sensitive system entities explicitly protected from direct public CRUD exposure
export const EXCLUDED_INTERNAL_ENTITIES = [
  'ActionMemory',
  'UserBehaviorEvent',
  'UserLearningProfile',
  'UserListeningEvent',
  'UserListeningSession',
  'UserMusicPreference',
  'UserPlaybackEvent',
  'UserRecommendationCache',
  'WebsiteUsageSession',
  'SystemMetric',
  'LearningUpdateLog',
  'LiveUsersConfig'
];

/**
 * Returns registered entity metadata by id
 */
export const getEntityMetadata = (entityId) => {
  return ADMIN_MANAGED_ENTITIES.find(e => e.id === entityId) || null;
};

/**
 * Validates if an entity operation is authorized and supported
 */
export const isOperationAllowed = (entityId, operation) => {
  const meta = getEntityMetadata(entityId);
  if (!meta) return false;
  return meta.operations.includes(operation);
};

