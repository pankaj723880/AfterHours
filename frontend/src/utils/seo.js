/**
 * Loopra SEO & Canonical Metadata Manager
 * Enforces primary domain canonicalization (https://loopra1.vercel.app),
 * unique per-route page titles, meta descriptions, OpenGraph, Twitter cards,
 * and Schema.org structured data (WebSite, Organization, BreadcrumbList).
 */

export const PRIMARY_DOMAIN = 'https://loopra1.vercel.app';
export const SECONDARY_DOMAIN = 'https://after-hours-five-beryl.vercel.app';

export const ROUTE_SEO_DATA = {
  home: {
    title: 'Loopra — Immersive Music Streaming, 3D Audio & AI Radio',
    description: 'Stream music with immersive 3D visuals, live Indian radio, curated Hindi hits, and AI-powered music exploration on Loopra.',
    path: '/',
    isIndexable: true,
    breadcrumbs: []
  },
  discover: {
    title: 'Discover Music & Trending Hits | Loopra',
    description: 'Explore trending tracks, search millions of songs, and discover popular music across Hindi, Punjabi, English, and global charts.',
    path: '/discover',
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: 'Discover Music', item: `${PRIMARY_DOMAIN}/discover` }
    ]
  },
  radio: {
    title: 'Live Indian Radio & Regional FM Stations | Loopra',
    description: 'Stream 24/7 live Indian radio stations covering Bollywood classics, Punjabi hits, Ghazals, Sufi, Devotional, and regional FM channels.',
    path: '/radio',
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: 'Live Indian Radio', item: `${PRIMARY_DOMAIN}/radio` }
    ]
  },
  'for-you': {
    title: 'Personalized AI Music Recommendations | Loopra',
    description: 'Enjoy personalized music recommendations powered by AI intelligence tailored to your listening habits, mood, and favorite artists.',
    path: '/for-you',
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: 'For You', item: `${PRIMARY_DOMAIN}/for-you` }
    ]
  },
  downloads: {
    title: 'Offline Music Player & Downloads | Loopra',
    description: 'Download your favorite music tracks for offline listening anytime with Loopra offline audio player and library manager.',
    path: '/downloads',
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: 'Offline Downloads', item: `${PRIMARY_DOMAIN}/downloads` }
    ]
  },
  mood: {
    title: 'Mood & Ambient Soundscapes | Loopra',
    description: 'Select music to match your mood: Chill, Energy, Focus, Romance, Workout, Nostalgia, and immersive ambient audio soundscapes.',
    path: '/mood',
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: 'Mood Soundscapes', item: `${PRIMARY_DOMAIN}/mood` }
    ]
  },
  timemachine: {
    title: 'Music Time Machine — Retro Era Jukebox | Loopra',
    description: 'Travel through the golden decades of music from the 60s, 70s, 80s, 90s, and 2000s Bollywood and international classics.',
    path: '/timemachine',
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: 'Time Machine', item: `${PRIMARY_DOMAIN}/timemachine` }
    ]
  },
  barber: {
    title: 'Saloon Nostalgia Radio & Classic Hits | Loopra',
    description: 'Experience vintage Indian saloon nostalgia with timeless Hindi, 90s romantic melodies, and Bollywood evergreen melodies.',
    path: '/barber',
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: 'Saloon Nostalgia', item: `${PRIMARY_DOMAIN}/barber` }
    ]
  },
  truck: {
    title: 'Highway Dhaba Radio & High-Energy Hits | Loopra',
    description: 'High-octane Punjabi road trip anthems, Daler Mehndi classics, and Highway Dhaba beats curated for travel and high energy.',
    path: '/truck',
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: 'Highway Dhaba', item: `${PRIMARY_DOMAIN}/truck` }
    ]
  },
  pauwa: {
    title: 'Desi Theka Radio & Folk Melodies | Loopra',
    description: 'Authentic rustic folk songs, evening mehfil melodies, and soulful ghazals curated for relaxing acoustic evening sessions.',
    path: '/pauwa',
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: 'Desi Theka', item: `${PRIMARY_DOMAIN}/pauwa` }
    ]
  },
  // Private / User-specific routes (Excluded from indexing)
  library: {
    title: 'Your Music Library | Loopra',
    description: 'View your saved tracks, favorite songs, and personalized music collection on Loopra.',
    path: '/library',
    isIndexable: false,
    breadcrumbs: []
  },
  history: {
    title: 'Listening History & Recap | Loopra',
    description: 'Review your playback history, top songs, and recent listening sessions on Loopra.',
    path: '/history',
    isIndexable: false,
    breadcrumbs: []
  },
  playlists: {
    title: 'Your Playlists & Mixtapes | Loopra',
    description: 'Create, organize, and play your custom music playlists on Loopra.',
    path: '/playlists',
    isIndexable: false,
    breadcrumbs: []
  },
  activity: {
    title: 'Listening Insights & Activity | Loopra',
    description: 'Detailed analytics, listening trends, and recap statistics of your music playback.',
    path: '/activity',
    isIndexable: false,
    breadcrumbs: []
  },
  admin: {
    title: 'Admin Dashboard | Loopra',
    description: 'Loopra administrative controls, ratings curation, and user role management.',
    path: '/admin',
    isIndexable: false,
    breadcrumbs: []
  }
};

/**
 * Updates DOM metadata dynamically when route or station changes.
 * Enforces canonical domain, OpenGraph, Twitter, and Schema.org BreadcrumbList.
 */
export function updateRouteMetadata(tabKey, stationOverride = null) {
  if (typeof document === 'undefined') return;

  const seoConfig = ROUTE_SEO_DATA[tabKey] || {
    title: stationOverride?.title ? `${stationOverride.title} | Loopra` : 'Loopra — Immersive Music Streaming',
    description: stationOverride?.subtitle || 'Stream music with immersive 3D visuals, live Indian radio, and AI exploration on Loopra.',
    path: `/${tabKey}`,
    isIndexable: true,
    breadcrumbs: [
      { name: 'Home', item: `${PRIMARY_DOMAIN}/` },
      { name: stationOverride?.title || tabKey, item: `${PRIMARY_DOMAIN}/${tabKey}` }
    ]
  };

  // 1. Page Title
  document.title = seoConfig.title;

  // 2. Canonical URL (Strictly enforces PRIMARY_DOMAIN https://loopra1.vercel.app)
  const canonicalUrl = `${PRIMARY_DOMAIN}${seoConfig.path}`;
  let canonicalEl = document.querySelector("link[rel='canonical']");
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  // 3. Meta Description
  let descEl = document.querySelector("meta[name='description']");
  if (!descEl) {
    descEl = document.createElement('meta');
    descEl.setAttribute('name', 'description');
    document.head.appendChild(descEl);
  }
  descEl.setAttribute('content', seoConfig.description);

  // 4. Robots Directives (noindex for private/admin routes)
  let robotsEl = document.querySelector("meta[name='robots']");
  if (!robotsEl) {
    robotsEl = document.createElement('meta');
    robotsEl.setAttribute('name', 'robots');
    document.head.appendChild(robotsEl);
  }
  if (seoConfig.isIndexable) {
    robotsEl.setAttribute('content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  } else {
    robotsEl.setAttribute('content', 'noindex, nofollow');
  }

  // 5. OpenGraph Tags
  const setMetaProp = (prop, content) => {
    let el = document.querySelector(`meta[property='${prop}']`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', prop);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMetaProp('og:title', seoConfig.title);
  setMetaProp('og:description', seoConfig.description);
  setMetaProp('og:url', canonicalUrl);
  setMetaProp('og:image', `${PRIMARY_DOMAIN}/og-image.png`);

  // 6. Twitter / X Card Tags
  const setMetaName = (name, content) => {
    let el = document.querySelector(`meta[name='${name}']`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMetaName('twitter:title', seoConfig.title);
  setMetaName('twitter:description', seoConfig.description);
  setMetaName('twitter:image', `${PRIMARY_DOMAIN}/og-image.png`);

  // 7. BreadcrumbList JSON-LD Schema
  let breadcrumbScript = document.getElementById('schema-breadcrumb');
  if (seoConfig.breadcrumbs && seoConfig.breadcrumbs.length > 0) {
    if (!breadcrumbScript) {
      breadcrumbScript = document.createElement('script');
      breadcrumbScript.id = 'schema-breadcrumb';
      breadcrumbScript.type = 'application/ld+json';
      document.head.appendChild(breadcrumbScript);
    }
    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: seoConfig.breadcrumbs.map((crumb, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: crumb.name,
        item: crumb.item
      }))
    };
    breadcrumbScript.textContent = JSON.stringify(schemaData);
  } else if (breadcrumbScript) {
    breadcrumbScript.remove();
  }
}

