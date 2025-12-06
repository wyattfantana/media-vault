import { jellyfinFormatter } from './apps/api/src/services/jellyfin-formatter.service';

async function test() {
  console.log('Testing Jellyfin Formatter Service\n');

  // Test cases
  const testFiles = [
    'Breaking Bad S01E01 Pilot (2160p x265 10bit Joy).mkv',
    'The.Office.S03E14.The.Return.1080p.x264.mkv',
    'Inception (2010) 1080p BluRay x264.mkv',
    'The Matrix 1999 2160p UHD BluRay x265.mkv',
  ];

  for (const filename of testFiles) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Original: ${filename}`);
    console.log('='.repeat(60));

    try {
      const result = await jellyfinFormatter.autoFormat(filename, false); // false = skip TMDB for now
      console.log(`\nContent Type: ${result.contentType}`);
      console.log(`Base Dir: ${result.baseDir}`);
      console.log(`\nFormatted Path:\n${result.formattedPath}`);
      console.log(`\nPreview:\n${result.preview}`);
      console.log(`\nStructure:`, JSON.stringify(result.folderStructure, null, 2));
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('Testing with TMDB integration (Breaking Bad)');
  console.log('='.repeat(60));

  try {
    const result = await jellyfinFormatter.formatTVShow(
      'Breaking Bad S01E01 Pilot (2160p x265 10bit Joy).mkv',
      undefined,
      true // Enable TMDB
    );
    console.log(`\nWith TMDB:\n${result.preview}`);
    console.log(`\nEpisode title from TMDB: "${result.folderStructure.episodeTitle}"`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }
}

test().catch(console.error);
