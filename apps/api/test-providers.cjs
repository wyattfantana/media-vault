const TorrentSearchApi = require('torrent-search-api');

async function testProvider(providerName) {
  try {
    TorrentSearchApi.getActiveProviders().forEach(p => TorrentSearchApi.disableProvider(p.name));
    TorrentSearchApi.enableProvider(providerName);

    console.log(`\nTesting ${providerName}...`);
    const results = await Promise.race([
      TorrentSearchApi.search('Matrix 1999', 'All', 3),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);

    console.log(`✓ ${providerName}: ${results.length} results`);
    if (results.length > 0) {
      console.log(`  First: ${results[0].title} | Seeds: ${results[0].seeds}`);
    }
    return true;
  } catch (error) {
    console.log(`✗ ${providerName}: ${error.message}`);
    return false;
  }
}

(async () => {
  const providers = ['ThePirateBay', '1337x', 'Eztv', 'Rarbg', 'Torrentz2', 'Limetorrents'];

  console.log('Testing providers for Matrix 1999...\n');

  for (const provider of providers) {
    await testProvider(provider);
  }
})();
