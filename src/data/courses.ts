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

function generateMockHoles(baseLat: number, baseLng: number, baseElevation: number): HoleData[] {
  const holes: HoleData[] = [];
  for (let i = 1; i <= 18; i++) {
    const offsetLat = (i * 0.0015);
    const offsetLng = (i * 0.0012);
    const elevationVariance = Math.sin(i) * 25;

    holes.push({
      holeNumber: i,
      par: [3, 4, 5][(i % 3)],
      greenCenter: { lat: baseLat + offsetLat, lng: baseLng + offsetLng, elevation: baseElevation + elevationVariance },
      greenFront: { lat: baseLat + offsetLat - 0.0001, lng: baseLng + offsetLng - 0.0001 },
      greenBack: { lat: baseLat + offsetLat + 0.0001, lng: baseLng + offsetLng + 0.0001 },
    });
  }
  return holes;
}

export const LAS_VEGAS_COURSES: GolfCourse[] = [
  { id: 'bali-hai', name: 'Bali Hai Golf Club', location: 'Las Vegas (Strip)', type: 'Resort', holes: generateMockHoles(36.0863, -115.1706, 2011) },
  { id: 'lv-country-club', name: 'Las Vegas Country Club', location: 'Las Vegas', type: 'Private', holes: generateMockHoles(36.1284, -115.1481, 2040) },
  { id: 'lv-national', name: 'Las Vegas National Golf Club', location: 'Las Vegas', type: 'Resort', holes: generateMockHoles(36.1221, -115.1235, 1995) },
  { id: 'wynn', name: 'Wynn Golf Club', location: 'Las Vegas (Strip)', type: 'Resort', holes: generateMockHoles(36.1278, -115.1612, 2020) },
  { id: 'revere-lexington', name: 'The Revere Golf Club (Lexington)', location: 'Henderson', type: 'Public', holes: generateMockHoles(35.9892, -115.0861, 2650) },
  { id: 'revere-concord', name: 'The Revere Golf Club (Concord)', location: 'Henderson', type: 'Public', holes: generateMockHoles(35.9915, -115.0822, 2680) },
  { id: 'rio-secco', name: 'Rio Secco Golf Club', location: 'Henderson', type: 'Resort', holes: generateMockHoles(35.9984, -115.0683, 2410) },
  { id: 'legacy-nv', name: 'The Legacy Golf Club', location: 'Henderson', type: 'Public', holes: generateMockHoles(36.0272, -115.0794, 2150) },
  { id: 'chimera', name: 'Chimera Golf Club', location: 'Henderson', type: 'Public', holes: generateMockHoles(36.0355, -114.9701, 1850) },
  { id: 'dragonridge', name: 'DragonRidge Country Club', location: 'Henderson', type: 'Private', holes: generateMockHoles(35.9961, -115.0485, 2720) },
  { id: 'anthem-cc', name: 'Anthem Country Club', location: 'Henderson', type: 'Private', holes: generateMockHoles(35.9855, -115.0991, 2810) },
  { id: 'reflection-bay', name: 'Reflection Bay Golf Club', location: 'Lake Las Vegas', type: 'Resort', holes: generateMockHoles(36.1139, -114.9281, 1420) },
  { id: 'southshore', name: 'SouthShore Country Club', location: 'Lake Las Vegas', type: 'Private', holes: generateMockHoles(36.1122, -114.9125, 1490) },
  { id: 'tpc-las-vegas', name: 'TPC Las Vegas', location: 'Summerlin', type: 'Resort', holes: generateMockHoles(36.1867, -115.3061, 2910) },
  { id: 'tpc-summerlin', name: 'TPC Summerlin', location: 'Summerlin', type: 'Private', holes: generateMockHoles(36.1912, -115.2995, 2890) },
  { id: 'bears-best', name: 'Bears Best Las Vegas', location: 'Summerlin', type: 'Resort', holes: generateMockHoles(36.1264, -115.3211, 3120) },
  { id: 'paiute-snow-mountain', name: 'Las Vegas Paiute Golf Resort (Snow Mountain)', location: 'Las Vegas', type: 'Public', holes: generateMockHoles(36.3533, -115.3235, 3050) },
  { id: 'paiute-sun-mountain', name: 'Las Vegas Paiute Golf Resort (Sun Mountain)', location: 'Las Vegas', type: 'Public', holes: generateMockHoles(36.3591, -115.3188, 3080) },
  { id: 'paiute-wolf', name: 'Las Vegas Paiute Golf Resort (Wolf)', location: 'Las Vegas', type: 'Public', holes: generateMockHoles(36.3654, -115.3341, 3150) },
  { id: 'aliante', name: 'Aliante Golf Club', location: 'North Las Vegas', type: 'Public', holes: generateMockHoles(36.2794, -115.1833, 2310) },
  { id: 'shadow-creek', name: 'Shadow Creek Golf Course', location: 'North Las Vegas', type: 'Resort', holes: generateMockHoles(36.2422, -115.1118, 2110) },
  { id: 'boulder-creek', name: 'Boulder Creek Golf Club', location: 'Boulder City', type: 'Public', holes: generateMockHoles(35.9522, -114.8625, 2450) },
  { id: 'cascata', name: 'Cascata Golf Club', location: 'Boulder City', type: 'Resort', holes: generateMockHoles(35.9712, -114.8961, 3210) }
];
