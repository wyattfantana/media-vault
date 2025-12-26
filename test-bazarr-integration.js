// Test Bazarr integration through MediaVault API
const fetch = require('node-fetch');

async function testBazarrIntegration() {
  console.log('🧪 Testing Bazarr Integration...\n');

  try {
    // Test 1: Direct Bazarr API
    console.log('1️⃣  Testing direct Bazarr API connection...');
    const directResponse = await fetch('http://localhost:6767/api/system/status', {
      headers: {
        'X-API-KEY': 'a5421902220f09abd682e7d30ed1cc20'
      }
    });

    if (directResponse.ok) {
      const data = await directResponse.json();
      console.log('   ✅ Bazarr API responding');
      console.log('   📦 Version:', data.data.bazarr_version);
      console.log('   🐍 Python:', data.data.python_version);
      console.log('   💾 Database:', data.data.database_engine);
    } else {
      console.log('   ❌ Bazarr API failed:', directResponse.status);
    }

    // Test 2: Check movies in Bazarr
    console.log('\n2️⃣  Checking movies in Bazarr...');
    const moviesResponse = await fetch('http://localhost:6767/api/movies', {
      headers: {
        'X-API-KEY': 'a5421902220f09abd682e7d30ed1cc20'
      }
    });

    if (moviesResponse.ok) {
      const movies = await moviesResponse.json();
      console.log('   ✅ Movies endpoint responding');
      console.log('   🎬 Total movies:', movies.data?.length || 0);

      if (movies.data && movies.data.length > 0) {
        const withSubtitles = movies.data.filter(m => m.subtitles && m.subtitles.length > 0).length;
        const missingSubtitles = movies.data.filter(m => m.missing_subtitles && m.missing_subtitles.length > 0).length;
        console.log('   ✓ Movies with subtitles:', withSubtitles);
        console.log('   ⚠ Movies missing subtitles:', missingSubtitles);
      }
    } else {
      console.log('   ❌ Movies endpoint failed:', moviesResponse.status);
    }

    // Test 3: Check series in Bazarr
    console.log('\n3️⃣  Checking TV series in Bazarr...');
    const seriesResponse = await fetch('http://localhost:6767/api/series', {
      headers: {
        'X-API-KEY': 'a5421902220f09abd682e7d30ed1cc20'
      }
    });

    if (seriesResponse.ok) {
      const series = await seriesResponse.json();
      console.log('   ✅ Series endpoint responding');
      console.log('   📺 Total series:', series.data?.length || 0);

      if (series.data && series.data.length > 0) {
        const seriesCount = series.data.length;
        console.log('   📊 Series tracked:', seriesCount);
      }
    } else {
      console.log('   ❌ Series endpoint failed:', seriesResponse.status);
    }

    // Test 4: Check available languages
    console.log('\n4️⃣  Checking available subtitle languages...');
    const langResponse = await fetch('http://localhost:6767/api/system/languages', {
      headers: {
        'X-API-KEY': 'a5421902220f09abd682e7d30ed1cc20'
      }
    });

    if (langResponse.ok) {
      const langs = await langResponse.json();
      console.log('   ✅ Languages endpoint responding');
      console.log('   🌍 Available languages:', langs.data?.length || 0);

      if (langs.data && langs.data.length > 0) {
        const english = langs.data.find(l => l.code2 === 'en');
        if (english) {
          console.log('   ✓ English (en) available:', english.name);
        }
      }
    } else {
      console.log('   ⚠️  Languages endpoint:', langResponse.status);
    }

    // Test 5: Check Bazarr providers
    console.log('\n5️⃣  Checking subtitle providers...');
    const providersResponse = await fetch('http://localhost:6767/api/providers', {
      headers: {
        'X-API-KEY': 'a5421902220f09abd682e7d30ed1cc20'
      }
    });

    if (providersResponse.ok) {
      const providers = await providersResponse.json();
      console.log('   ✅ Providers endpoint responding');

      if (providers.data) {
        const movieProviders = providers.data.filter(p => p.movie).length;
        const seriesProviders = providers.data.filter(p => p.tv).length;
        console.log('   🎬 Movie providers:', movieProviders);
        console.log('   📺 TV providers:', seriesProviders);
      }
    } else {
      console.log('   ⚠️  Providers endpoint:', providersResponse.status);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Bazarr Integration Test Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Next Steps:');
    console.log('   1. Access Bazarr at: http://localhost:6767');
    console.log('   2. Configure subtitle providers in Bazarr settings');
    console.log('   3. Add Sonarr/Radarr integration in Bazarr if needed');
    console.log('   4. Your subtitles will auto-sync based on your preferences\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testBazarrIntegration();
