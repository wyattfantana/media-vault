const TorrentSearchApi = require('torrent-search-api');

TorrentSearchApi.enableProvider('ThePirateBay');
TorrentSearchApi.enableProvider('1337x');

(async () => {
  try {
    console.log('Testing torrent search...');
    const results = await TorrentSearchApi.search('Matrix 1999', 'All', 10);
    console.log(`\nFound ${results.length} results\n`);

    for (let i = 0; i < Math.min(3, results.length); i++) {
      const torrent = results[i];
      console.log(`Result ${i + 1}:`);
      console.log(`  Title: ${torrent.title}`);
      console.log(`  Provider: ${torrent.provider}`);
      console.log(`  Seeds: ${torrent.seeds}`);
      console.log(`  Peers: ${torrent.peers}`);
      console.log(`  Size: ${torrent.size}`);
      console.log(`  Has magnet: ${torrent.magnet ? 'Yes' : 'No'}`);

      if (!torrent.magnet && torrent.desc) {
        console.log(`  Fetching magnet...`);
        try {
          const magnet = await TorrentSearchApi.getMagnet(torrent.desc);
          console.log(`  Magnet found: ${magnet ? 'Yes' : 'No'}`);
        } catch (err) {
          console.log(`  Magnet fetch failed: ${err.message}`);
        }
      }
      console.log('');
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
})();
