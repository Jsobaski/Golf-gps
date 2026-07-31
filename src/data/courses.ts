export interface HoleData {
  holeNumber: number;
  par: number;
  greenCenter: { lat: number; lng: number; elevation: number };
  greenFront: { lat: number; lng: number };
  greenBack: { lat: number; lng: number };
}

export interface GolfCourse {
  id: string;
  name: string;
  location: string;
  type: 'Public' | 'Resort' | 'Private' | 'Semi-Private';
  holes: HoleData[];
}

interface RealHoleCoordinates {
  front: { lat: number; lng: number };
  center: { lat: number; lng: number };
  back: { lat: number; lng: number };
}

// Real green coordinates collected via Google Maps/Earth by testers,
// keyed by course id then hole number. Falls back to the generated
// placeholder below for any course/hole not yet in here.
const REAL_HOLE_COORDINATES: Record<string, Record<number, RealHoleCoordinates>> = {
  'tpc-summerlin': {
    1: { front: { lat: 36.184684863912, lng: -115.294655882519 }, center: { lat: 36.1846001484538, lng: -115.294473386061 }, back: { lat: 36.1844781274098, lng: -115.294343150013 } },
    2: { front: { lat: 36.1853174129811, lng: -115.289293912837 }, center: { lat: 36.1853905196818, lng: -115.289074217965 }, back: { lat: 36.1854681900161, lng: -115.288909037014 } },
    3: { front: { lat: 36.1829807181407, lng: -115.292736647899 }, center: { lat: 36.1829563026846, lng: -115.29294308701 }, back: { lat: 36.1829629114011, lng: -115.293145333268 } },
    4: { front: { lat: 36.1809748253563, lng: -115.288436695552 }, center: { lat: 36.1809877965866, lng: -115.288240908428 }, back: { lat: 36.1810473573483, lng: -115.288044556102 } },
    5: { front: { lat: 36.179147205968, lng: -115.288917399336 }, center: { lat: 36.179031017873, lng: -115.289105330234 }, back: { lat: 36.1789561907594, lng: -115.289247146462 } },
    6: { front: { lat: 36.1792076258651, lng: -115.293166588573 }, center: { lat: 36.1792450630284, lng: -115.293386196773 }, back: { lat: 36.1793134914667, lng: -115.29357582096 } },
    7: { front: { lat: 36.1812350866757, lng: -115.296164330772 }, center: { lat: 36.1812392408568, lng: -115.296348571664 }, back: { lat: 36.1811589588324, lng: -115.296497125889 } },
    8: { front: { lat: 36.1832522496, lng: -115.294101867274 }, center: { lat: 36.1833821806278, lng: -115.293907152976 }, back: { lat: 36.1834648700482, lng: -115.293704831924 } },
    9: { front: { lat: 36.1870035109362, lng: -115.29823296106 }, center: { lat: 36.1871941003991, lng: -115.298237702142 }, back: { lat: 36.187355766335, lng: -115.298262785421 } },
    10: { front: { lat: 36.1915606064982, lng: -115.296162357797 }, center: { lat: 36.1916751281365, lng: -115.296009299562 }, back: { lat: 36.1917868066062, lng: -115.295839685956 } },
    11: { front: { lat: 36.19399334684, lng: -115.29254551698 }, center: { lat: 36.1940824173684, lng: -115.292375447694 }, back: { lat: 36.1942764241535, lng: -115.292330247175 } },
    12: { front: { lat: 36.1969498003467, lng: -115.29089377196 }, center: { lat: 36.1970345400861, lng: -115.290743331897 }, back: { lat: 36.1971691325445, lng: -115.290612066306 } },
    13: { front: { lat: 36.1920998304978, lng: -115.289552579559 }, center: { lat: 36.1920262525845, lng: -115.289463344313 }, back: { lat: 36.1919559841382, lng: -115.289370678368 } },
    14: { front: { lat: 36.1909116880493, lng: -115.289072441779 }, center: { lat: 36.1908475774949, lng: -115.288967563195 }, back: { lat: 36.190799000227, lng: -115.288843300975 } },
    15: { front: { lat: 36.1888967350589, lng: -115.290745557742 }, center: { lat: 36.1887465512341, lng: -115.290855052389 }, back: { lat: 36.1886320926811, lng: -115.29098690564 } },
    16: { front: { lat: 36.1864167853557, lng: -115.295752686832 }, center: { lat: 36.1865352957937, lng: -115.295919644173 }, back: { lat: 36.1866145607373, lng: -115.296067268017 } },
    17: { front: { lat: 36.187371223604, lng: -115.294333582661 }, center: { lat: 36.1874714206444, lng: -115.294099792539 }, back: { lat: 36.1875276215917, lng: -115.293863806253 } },
    18: { front: { lat: 36.1880595608716, lng: -115.297170870058 }, center: { lat: 36.1879329231871, lng: -115.29745194475 }, back: { lat: 36.1878469549369, lng: -115.29768035423 } },
  },
};

function generateMockHoles(courseId: string, baseLat: number, baseLng: number, baseElevation: number): HoleData[] {
  const holes: HoleData[] = [];
  const realCoordinates = REAL_HOLE_COORDINATES[courseId];

  for (let i = 1; i <= 18; i++) {
    const offsetLat = (i * 0.0015);
    const offsetLng = (i * 0.0012);
    const elevationVariance = Math.sin(i) * 25;
    const real = realCoordinates?.[i];

    holes.push({
      holeNumber: i,
      par: [3, 4, 5][(i % 3)],
      greenCenter: {
        lat: real?.center.lat ?? baseLat + offsetLat,
        lng: real?.center.lng ?? baseLng + offsetLng,
        elevation: baseElevation + elevationVariance,
      },
      greenFront: {
        lat: real?.front.lat ?? baseLat + offsetLat - 0.0001,
        lng: real?.front.lng ?? baseLng + offsetLng - 0.0001,
      },
      greenBack: {
        lat: real?.back.lat ?? baseLat + offsetLat + 0.0001,
        lng: real?.back.lng ?? baseLng + offsetLng + 0.0001,
      },
    });
  }
  return holes;
}

export const LAS_VEGAS_COURSES: GolfCourse[] = [
  { id: 'bali-hai', name: 'Bali Hai Golf Club', location: 'Las Vegas (Strip)', type: 'Resort', holes: generateMockHoles('bali-hai', 36.0863, -115.1706, 2011) },
  { id: 'lv-country-club', name: 'Las Vegas Country Club', location: 'Las Vegas', type: 'Private', holes: generateMockHoles('lv-country-club', 36.1284, -115.1481, 2040) },
  { id: 'lv-national', name: 'Las Vegas National Golf Club', location: 'Las Vegas', type: 'Resort', holes: generateMockHoles('lv-national', 36.1221, -115.1235, 1995) },
  { id: 'wynn', name: 'Wynn Golf Club', location: 'Las Vegas (Strip)', type: 'Resort', holes: generateMockHoles('wynn', 36.1278, -115.1612, 2020) },
  { id: 'revere-lexington', name: 'The Revere Golf Club (Lexington)', location: 'Henderson', type: 'Public', holes: generateMockHoles('revere-lexington', 35.9892, -115.0861, 2650) },
  { id: 'revere-concord', name: 'The Revere Golf Club (Concord)', location: 'Henderson', type: 'Public', holes: generateMockHoles('revere-concord', 35.9915, -115.0822, 2680) },
  { id: 'rio-secco', name: 'Rio Secco Golf Club', location: 'Henderson', type: 'Resort', holes: generateMockHoles('rio-secco', 35.9984, -115.0683, 2410) },
  { id: 'legacy-nv', name: 'The Legacy Golf Club', location: 'Henderson', type: 'Public', holes: generateMockHoles('legacy-nv', 36.0272, -115.0794, 2150) },
  { id: 'chimera', name: 'Chimera Golf Club', location: 'Henderson', type: 'Public', holes: generateMockHoles('chimera', 36.0355, -114.9701, 1850) },
  { id: 'dragonridge', name: 'DragonRidge Country Club', location: 'Henderson', type: 'Private', holes: generateMockHoles('dragonridge', 35.9961, -115.0485, 2720) },
  { id: 'anthem-cc', name: 'Anthem Country Club', location: 'Henderson', type: 'Private', holes: generateMockHoles('anthem-cc', 35.9855, -115.0991, 2810) },
  { id: 'reflection-bay', name: 'Reflection Bay Golf Club', location: 'Lake Las Vegas', type: 'Resort', holes: generateMockHoles('reflection-bay', 36.1139, -114.9281, 1420) },
  { id: 'southshore', name: 'SouthShore Country Club', location: 'Lake Las Vegas', type: 'Private', holes: generateMockHoles('southshore', 36.1122, -114.9125, 1490) },
  { id: 'tpc-las-vegas', name: 'TPC Las Vegas', location: 'Summerlin', type: 'Resort', holes: generateMockHoles('tpc-las-vegas', 36.1867, -115.3061, 2910) },
  { id: 'tpc-summerlin', name: 'TPC Summerlin', location: 'Summerlin', type: 'Private', holes: generateMockHoles('tpc-summerlin', 36.1912, -115.2995, 2890) },
  { id: 'bears-best', name: 'Bears Best Las Vegas', location: 'Summerlin', type: 'Resort', holes: generateMockHoles('bears-best', 36.1264, -115.3211, 3120) },
  { id: 'paiute-snow-mountain', name: 'Las Vegas Paiute Golf Resort (Snow Mountain)', location: 'Las Vegas', type: 'Public', holes: generateMockHoles('paiute-snow-mountain', 36.3533, -115.3235, 3050) },
  { id: 'paiute-sun-mountain', name: 'Las Vegas Paiute Golf Resort (Sun Mountain)', location: 'Las Vegas', type: 'Public', holes: generateMockHoles('paiute-sun-mountain', 36.3591, -115.3188, 3080) },
  { id: 'paiute-wolf', name: 'Las Vegas Paiute Golf Resort (Wolf)', location: 'Las Vegas', type: 'Public', holes: generateMockHoles('paiute-wolf', 36.3654, -115.3341, 3150) },
  { id: 'aliante', name: 'Aliante Golf Club', location: 'North Las Vegas', type: 'Public', holes: generateMockHoles('aliante', 36.2794, -115.1833, 2310) },
  { id: 'shadow-creek', name: 'Shadow Creek Golf Course', location: 'North Las Vegas', type: 'Resort', holes: generateMockHoles('shadow-creek', 36.2422, -115.1118, 2110) },
  { id: 'boulder-creek', name: 'Boulder Creek Golf Club', location: 'Boulder City', type: 'Public', holes: generateMockHoles('boulder-creek', 35.9522, -114.8625, 2450) },
  { id: 'cascata', name: 'Cascata Golf Club', location: 'Boulder City', type: 'Resort', holes: generateMockHoles('cascata', 35.9712, -114.8961, 3210) }
];
