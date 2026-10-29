const mongoose = require('../node_modules/mongoose');

const standardNav = [
  { id: 'home', label: 'Home', enabled: true, order: 1, isCore: true, icon: 'home', badge: '', group: 'main', route: '/' },
  { id: 'discover', label: 'Discover & Search', enabled: true, order: 2, isCore: true, icon: 'discover', badge: '', group: 'main', route: '/discover' },
  { id: 'mood', label: 'Mood-to-Music AI', enabled: true, order: 3, isCore: false, icon: 'sparkles', badge: 'AI', group: 'discovery', route: '/mood' },
  { id: 'timemachine', label: 'Time Machine Radio', enabled: true, order: 4, isCore: false, icon: 'radio', badge: 'Retro', group: 'discovery', route: '/timemachine' },
  { id: 'activity', label: 'Listening Activity', enabled: true, order: 5, isCore: false, icon: 'flame', badge: '', group: 'discovery', route: '/activity' },
  { id: 'swipe', label: 'Discover Swipe', enabled: true, order: 6, isCore: false, icon: 'swipe', badge: '', group: 'discovery', route: '/swipe' },
  { id: 'barber', label: 'Saloon FM', enabled: true, order: 7, isCore: false, icon: 'scissors', badge: '90s', group: 'stations', route: '/station/barber' },
  { id: 'truck', label: 'Horn Ok Please', enabled: true, order: 8, isCore: false, icon: 'truck', badge: 'Dhaba', group: 'stations', route: '/station/truck' },
  { id: 'pauwa', label: 'Theka Session', enabled: true, order: 9, isCore: false, icon: 'beer', badge: 'Desi', group: 'stations', route: '/station/pauwa' },
  { id: 'library', label: 'Liked Songs Collection', enabled: true, order: 10, isCore: true, icon: 'library', badge: '', group: 'collection', route: '/library' },
  { id: 'history', label: 'Listening History', enabled: true, order: 11, isCore: true, icon: 'history', badge: '', group: 'collection', route: '/history' },
  { id: 'playlists', label: 'Playlists', enabled: true, order: 12, isCore: true, icon: 'list', badge: '', group: 'collection', route: '/playlists' },
  { id: 'stats', label: 'Recap & Stats', enabled: true, order: 13, isCore: false, icon: 'sparkles', badge: '', group: 'collection', route: '/stats' }
];

async function updateDB() {
  await mongoose.connect('mongodb://127.0.0.1:27017/afterhours');
  const db = mongoose.connection.db;
  const result = await db.collection('siteconfigs').updateMany(
    {},
    { $set: { navigation: standardNav, updatedAt: new Date() } }
  );
  console.log('Updated documents count:', result.modifiedCount);
  const configs = await db.collection('siteconfigs').find({}).toArray();
  console.log('Verified navigation in DB:');
  configs.forEach(c => {
    console.log(c.configType, c.navigation.map(n => ({ id: n.id, group: n.group, label: n.label })));
  });
  await mongoose.disconnect();
}
updateDB().catch(e => { console.error(e); process.exit(1); });

