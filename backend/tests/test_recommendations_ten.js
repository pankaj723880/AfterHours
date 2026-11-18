import express from 'express';
import recommendationsRouter from '../routes/recommendations.js';

const app = express();
app.use(express.json());
app.use('/api/recommendations', recommendationsRouter);

const server = app.listen(5099, async () => {
  try {
    const testCases = [
      { name: 'Latin Pop (Despacito)', params: 'trackId=kJQP7kiw5Fk&title=Despacito&artist=Luis%20Fonsi&genre=Latin%20Pop&refresh=true' },
      { name: 'Rock (Bohemian Rhapsody)', params: 'trackId=fJ9rUzIMcZQ&title=Bohemian%20Rhapsody&artist=Queen&genre=Rock&refresh=true' },
      { name: 'Bollywood (Dheere Dheere)', params: 'trackId=KeyfUuXPOcY&title=Dheere%20Dheere&artist=Kumar%20Sanu&genre=Bollywood&language=hindi&refresh=true' },
      { name: 'Bhojpuri (Lollypop Lagelu)', params: 'trackId=xyz123&title=Lollypop%20Lagelu&artist=Pawan%20Singh&genre=Bhojpuri&language=bhojpuri&refresh=true' },
      { name: 'Punjabi (Lover)', params: 'trackId=mH_LFkWxpI0&title=Lover&artist=Diljit%20Dosanjh&genre=Punjabi&language=punjabi&refresh=true' }
    ];

    let allPass = true;
    for (const tc of testCases) {
      const res = await fetch('http://127.0.0.1:5099/api/recommendations/similar?' + tc.params);
      const data = await res.json();
      console.log('\n=== Test Case:', tc.name, '===');
      console.log('Total items:', data.items?.length, '| Related:', data.related?.length, '| Discover:', data.discover?.length);
      console.log('Related:', data.related?.map(t => t.title));
      console.log('Discover:', data.discover?.map(t => t.title));
      if (data.items?.length !== 10 || data.related?.length !== 5 || data.discover?.length !== 5) {
        console.error('FAIL: Expected 10 items (5 related + 5 discover), got', { total: data.items?.length, related: data.related?.length, discover: data.discover?.length });
        allPass = false;
      } else {
        console.log('PASS: Exactly 10 items (5 related + 5 discover)');
      }
    }

    if (!allPass) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode || 0);
  }
});
