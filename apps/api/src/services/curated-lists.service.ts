/**
 * Curated Lists Service
 * Manages curated movie/TV collections like IMDB Top 250, Oscar Winners, etc.
 */

import { tmdbService } from './tmdb.service.js';

export interface CuratedList {
  id: string;
  name: string;
  description: string;
  type: 'movie' | 'tv';
  imdbIds?: string[];
  tmdbIds?: number[];
}

/**
 * IMDB Top 250 Movies
 * Source: Official IMDB datasets (https://datasets.imdbws.com/)
 * Last updated: 2025-12-13
 */
const IMDB_TOP_250_MOVIES: string[] = [
  'tt0111161', 'tt0068646', 'tt0252487', 'tt0468569', 'tt0167260',
  'tt0108052', 'tt0071562', 'tt0050083', 'tt0120737', 'tt5354160',
  'tt0253828', 'tt1375666', 'tt0137523', 'tt0109830', 'tt0110912',
  'tt0167261', 'tt0060196', 'tt0816692', 'tt0133093', 'tt0080684',
  'tt0099685', 'tt23849204', 'tt7466810', 'tt0114369', 'tt0102926',
  'tt0120815', 'tt0076759', 'tt0120689', 'tt0103064', 'tt0073486',
  'tt0245429', 'tt0317248', 'tt0118799', 'tt0038650', 'tt0047478',
  'tt15097216', 'tt10189514', 'tt0056058', 'tt9263550', 'tt34365591',
  'tt0252488', 'tt0367495', 'tt0093603', 'tt1853728', 'tt0172495',
  'tt0482571', 'tt0407887', 'tt0088763', 'tt0110413', 'tt0120586',
  'tt0110357', 'tt0114814', 'tt6751668', 'tt2582802', 'tt0078748',
  'tt1675434', 'tt0253474', 'tt0054215', 'tt0034583', 'tt10811166',
  'tt0047396', 'tt9362722', 'tt0064116', 'tt0095327', 'tt0095765',
  'tt0027977', 'tt0021749', 'tt1424432', 'tt20850406', 'tt32820897',
  'tt1152758', 'tt7019842', 'tt0103767', 'tt11580854', 'tt8948790',
  'tt24082438', 'tt30472557', 'tt1345836', 'tt0361748', 'tt0209144',
  'tt4154796', 'tt4154756', 'tt0910970', 'tt0081505', 'tt0082971',
  'tt0090605', 'tt4633694', 'tt0078788', 'tt15239678', 'tt2380307',
  'tt1187043', 'tt0086879', 'tt0405094', 'tt5311514', 'tt0082096',
  'tt0043014', 'tt0032553', 'tt0050825', 'tt0051201', 'tt8267604',
  'tt0057565', 'tt1313104', 'tt9900782', 'tt3417422', 'tt12361178',
  'tt0770802', 'tt9477520', 'tt16492678', 'tt0346336', 'tt0376127',
  'tt7286456', 'tt0169547', 'tt1049413', 'tt0086190', 'tt0119217',
  'tt0338013', 'tt0105236', 'tt0114709', 'tt0112573', 'tt0086250',
  'tt15398776', 'tt0180093', 'tt0435761', 'tt0211915', 'tt0113277',
  'tt0062622', 'tt0364569', 'tt0057012', 'tt0119698', 'tt0087843',
  'tt2106476', 'tt0053125', 'tt0056592', 'tt0056172', 'tt0045152',
  'tt1832382', 'tt1255953', 'tt5074352', 'tt0986264', 'tt0053604',
  'tt0022100', 'tt0036775', 'tt8110330', 'tt8503618', 'tt10295212',
  'tt0091251', 'tt0044741', 'tt0055031', 'tt9179430', 'tt26548265',
  'tt9052870', 'tt7060344', 'tt21626284', 'tt10280296', 'tt26439764',
  'tt0019760', 'tt0110057', 'tt7681902', 'tt4679210', 'tt3668162',
  'tt25433734', 'tt0993846', 'tt0372784', 'tt1130884', 'tt0120382',
  'tt0266697', 'tt0266543', 'tt0477348', 'tt0107290', 'tt0167404',
  'tt0268978', 'tt0095016', 'tt0075314', 'tt10872600', 'tt0208092',
  'tt0066921', 'tt1392214', 'tt0097576', 'tt0093058', 'tt1745960',
  'tt8579674', 'tt0457430', 'tt0469494', 'tt6966692', 'tt0119488',
  'tt0112641', 'tt0071853', 'tt0084787', 'tt0347149', 'tt0033467',
  'tt0105695', 'tt0052357', 'tt0363163', 'tt0031381', 'tt0053291',
  'tt0070735', 'tt0059578', 'tt0080678', 'tt0057115', 'tt1305806',
  'tt4729430', 'tt10272386', 'tt29623480', 'tt0046912', 'tt0017136',
  'tt0040522', 'tt10698680', 'tt0089881', 'tt0042192', 'tt0012349',
  'tt0055630', 'tt0040897', 'tt5323662', 'tt4849438', 'tt8108198',
  'tt5813916', 'tt1954470', 'tt7838252', 'tt4430212', 'tt0367110',
  'tt0476735', 'tt0374887', 'tt11032374', 'tt1562872', 'tt0118849',
  'tt1645089', 'tt0242519', 'tt8291224', 'tt2356180', 'tt2125608',
  'tt8239946', 'tt10431500', 'tt6148156', 'tt15501640', 'tt6316138',
  'tt0085809', 'tt2375605', 'tt0048473', 'tt7905466', 'tt1620933',
  'tt5895028', 'tt0071411', 'tt26458038', 'tt7392212', 'tt0049902',
  'tt5929776', 'tt0466460', 'tt0100234', 'tt0054248', 'tt0325980',
];

/**
 * IMDB Top 250 TV Shows
 * Source: Official IMDB datasets (https://datasets.imdbws.com/)
 * Last updated: 2025-12-13
 */
const IMDB_TOP_250_TV: string[] = [
  'tt0903747', 'tt0417299', 'tt0306414', 'tt7678620', 'tt0944947',
  'tt0141842', 'tt30263074', 'tt9253866', 'tt0071075', 'tt2560140',
  'tt14392248', 'tt1355642', 'tt4742876', 'tt28227737', 'tt5622316',
  'tt4202274', 'tt26471411', 'tt10530900', 'tt1475582', 'tt0386676',
  'tt3032476', 'tt2861424', 'tt11126994', 'tt0388629', 'tt2098220',
  'tt0103359', 'tt33043892', 'tt12004706', 'tt0052520', 'tt1831164',
  'tt9432978', 'tt10541088', 'tt14986406', 'tt0081912', 'tt0296310',
  'tt13675832', 'tt4934214', 'tt0268093', 'tt0108778', 'tt2356777',
  'tt0877057', 'tt0098904', 'tt0303461', 'tt1865718', 'tt0213338',
  'tt0200276', 'tt31938062', 'tt22248376', 'tt7920978', 'tt2297757',
  'tt21279678', 'tt1909015', 'tt8595766', 'tt0158417', 'tt2802850',
  'tt10986410', 'tt7660850', 'tt0472954', 'tt3398228', 'tt0214341',
  'tt0264235', 'tt0193676', 'tt14650074', 'tt10233448', 'tt0072500',
  'tt3530232', 'tt0121220', 'tt1910272', 'tt0063929', 'tt0353049',
  'tt0096548', 'tt1795096', 'tt7927936', 'tt2442560', 'tt2085059',
  'tt0412142', 'tt5753856', 'tt2707408', 'tt0121955', 'tt11280740',
  'tt6741278', 'tt0804503', 'tt1606375', 'tt0098936', 'tt5687612',
  'tt0988824', 'tt0384766', 'tt0407362', 'tt5555260', 'tt0248654',
  'tt5788792', 'tt0092455', 'tt1628033', 'tt0118421', 'tt9544034',
  'tt13309742', 'tt0994314', 'tt0286486', 'tt5712554', 'tt2303687',
  'tt0758745', 'tt0318871', 'tt0387764', 'tt0434706', 'tt3398540',
  'tt16026746', 'tt7472896', 'tt0459159', 'tt9471962', 'tt0086661',
  'tt20859920', 'tt4574334', 'tt0773262', 'tt1190634', 'tt8111088',
  'tt1856010', 'tt3322312', 'tt0096697', 'tt5290382', 'tt0367279',
  'tt1266020', 'tt4236770', 'tt4786824', 'tt0106179', 'tt9253284',
  'tt2788316', 'tt4508902', 'tt0979432', 'tt9335498', 'tt1486217',
  'tt0096657', 'tt1870479', 'tt1305826', 'tt1489428', 'tt0348914',
  'tt21209876', 'tt4288182', 'tt1733785', 'tt5421602', 'tt1710308',
  'tt4299972', 'tt0094525', 'tt0088484', 'tt1641384', 'tt0092324',
  'tt2049116', 'tt0111958', 'tt11854694', 'tt1534360', 'tt5288312',
  'tt0053488', 'tt2701582', 'tt7562112', 'tt0380136', 'tt1983079',
  'tt4647692', 'tt0417373', 'tt0094517', 'tt4156586', 'tt10332508',
  'tt2433738', 'tt3581920', 'tt2306299', 'tt1442437', 'tt4158110',
  'tt1124373', 'tt1586680', 'tt1439629', 'tt2243973', 'tt14452776',
  'tt0149460', 'tt0436992', 'tt1839578', 'tt3230854', 'tt4179452',
  'tt2575988', 'tt0487831', 'tt12343534', 'tt3526078', 'tt0458290',
  'tt0290978', 'tt7908628', 'tt5189670', 'tt0112159', 'tt6077448',
  'tt3502248', 'tt10638036', 'tt4093826', 'tt1492966', 'tt0421357',
  'tt0088509', 'tt0280249', 'tt7120662', 'tt3428912', 'tt11912196',
  'tt0863046', 'tt0068098', 'tt0278238', 'tt0423731', 'tt5897304',
  'tt0187664', 'tt8289930', 'tt0290988', 'tt0275137', 'tt0402711',
  'tt2100976', 'tt0237123', 'tt0163507', 'tt2359704', 'tt3895150',
  'tt0373732', 'tt10802170', 'tt1526318', 'tt1299368', 'tt0043208',
  'tt9398466', 'tt9522300', 'tt12074628', 'tt1353056', 'tt0475784',
  'tt1632701', 'tt0460681', 'tt2467372', 'tt5071412', 'tt5675620',
  'tt1442449', 'tt0285403', 'tt1119644', 'tt3920596', 'tt7221388',
  'tt9561862', 'tt0285331', 'tt0387199', 'tt7657124', 'tt8398600',
  'tt1474684', 'tt0409591', 'tt2017109', 'tt2149175', 'tt0491738',
  'tt0118480', 'tt2788432', 'tt1220617', 'tt0060028', 'tt31510819',
  'tt6473300', 'tt4189022', 'tt1759761', 'tt0262150', 'tt0925266',
];

export class CuratedListsService {
  /**
   * Get all available curated lists
   */
  getLists(): CuratedList[] {
    return [
      {
        id: 'imdb-top-250-movies',
        name: 'IMDB Top 250 Movies',
        description: 'The greatest movies of all time according to IMDB users',
        type: 'movie',
        imdbIds: IMDB_TOP_250_MOVIES,
      },
      {
        id: 'imdb-top-250-tv',
        name: 'IMDB Top 250 TV Shows',
        description: 'The greatest TV shows of all time according to IMDB users',
        type: 'tv',
        imdbIds: IMDB_TOP_250_TV,
      },
    ];
  }

  /**
   * Get a specific curated list by ID
   */
  getList(listId: string): CuratedList | null {
    const lists = this.getLists();
    return lists.find(list => list.id === listId) || null;
  }

  /**
   * Get movies from IMDB Top 250
   */
  async getIMDBTop250Movies(userId?: string): Promise<any[]> {
    const movies = [];

    for (const imdbId of IMDB_TOP_250_MOVIES) {
      try {
        // Search TMDB for the movie by IMDB ID
        const results = await tmdbService.searchMovieByIMDBId(imdbId, userId);
        if (results) {
          movies.push({
            ...results,
            poster_url: tmdbService.getImageUrl(results.poster_path, 'w500'),
            backdrop_url: tmdbService.getImageUrl(results.backdrop_path, 'w780'),
            year: results.release_date ? results.release_date.substring(0, 4) : null,
            imdb_id: imdbId,
          });
        }
      } catch (err) {
        console.error(`[Curated] Failed to fetch movie ${imdbId}:`, err);
      }
    }

    return movies;
  }

  /**
   * Get TV shows from IMDB Top 250
   */
  async getIMDBTop250TV(userId?: string): Promise<any[]> {
    const shows = [];

    for (const imdbId of IMDB_TOP_250_TV) {
      try {
        // Search TMDB for the TV show by IMDB ID
        const results = await tmdbService.searchTVByIMDBId(imdbId, userId);
        if (results) {
          shows.push({
            ...results,
            poster_url: tmdbService.getImageUrl(results.poster_path, 'w500'),
            backdrop_url: tmdbService.getImageUrl(results.backdrop_path, 'w780'),
            year: results.first_air_date ? results.first_air_date.substring(0, 4) : null,
            imdb_id: imdbId,
          });
        }
      } catch (err) {
        console.error(`[Curated] Failed to fetch TV show ${imdbId}:`, err);
      }
    }

    return shows;
  }
}

export const curatedListsService = new CuratedListsService();
