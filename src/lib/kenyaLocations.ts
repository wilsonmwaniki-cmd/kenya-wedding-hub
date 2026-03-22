export const kenyaCounties = [
  'Baringo',
  'Bomet',
  'Bungoma',
  'Busia',
  'Elgeyo-Marakwet',
  'Embu',
  'Garissa',
  'Homa Bay',
  'Isiolo',
  'Kajiado',
  'Kakamega',
  'Kericho',
  'Kiambu',
  'Kilifi',
  'Kirinyaga',
  'Kisii',
  'Kisumu',
  'Kitui',
  'Kwale',
  'Laikipia',
  'Lamu',
  'Machakos',
  'Makueni',
  'Mandera',
  'Marsabit',
  'Meru',
  'Migori',
  'Mombasa',
  'Murang’a',
  'Nairobi City',
  'Nakuru',
  'Nandi',
  'Narok',
  'Nyamira',
  'Nyandarua',
  'Nyeri',
  'Samburu',
  'Siaya',
  'Taita-Taveta',
  'Tana River',
  'Tharaka-Nithi',
  'Trans Nzoia',
  'Turkana',
  'Uasin Gishu',
  'Vihiga',
  'Wajir',
  'West Pokot',
] as const;

export type KenyaCounty = (typeof kenyaCounties)[number];

export const kenyaCountyTowns: Record<KenyaCounty, string[]> = {
  Baringo: ['Kabarnet', 'Marigat', 'Eldama Ravine', 'Mogotio'],
  Bomet: ['Bomet', 'Sotik', 'Longisa', 'Mulot'],
  Bungoma: ['Bungoma', 'Webuye', 'Kimilili', 'Chwele'],
  Busia: ['Busia', 'Malaba', 'Funyula', 'Port Victoria'],
  'Elgeyo-Marakwet': ['Iten', 'Kapsowar', 'Tambach', 'Chebara'],
  Embu: ['Embu', 'Runyenjes', 'Siakago', 'Manyatta'],
  Garissa: ['Garissa', 'Dadaab', 'Fafi', 'Modogashe'],
  'Homa Bay': ['Homa Bay', 'Mbita', 'Oyugis', 'Rongo'],
  Isiolo: ['Isiolo', 'Garbatulla', 'Merti', 'Kinna'],
  Kajiado: ['Kajiado', 'Kitengela', 'Ngong', 'Ongata Rongai', 'Namanga'],
  Kakamega: ['Kakamega', 'Mumias', 'Malava', 'Butere'],
  Kericho: ['Kericho', 'Litein', 'Ainamoi', 'Londiani'],
  Kiambu: ['Kiambu', 'Thika', 'Ruiru', 'Juja', 'Limuru', 'Kikuyu'],
  Kilifi: ['Kilifi', 'Malindi', 'Watamu', 'Mariakani'],
  Kirinyaga: ['Kerugoya', 'Kutus', 'Wang’uru', 'Kagio'],
  Kisii: ['Kisii', 'Ogembo', 'Suneka', 'Keroka'],
  Kisumu: ['Kisumu', 'Maseno', 'Ahero', 'Muhoroni'],
  Kitui: ['Kitui', 'Mwingi', 'Mutomo', 'Ikutha'],
  Kwale: ['Kwale', 'Ukunda', 'Diani', 'Msambweni'],
  Laikipia: ['Nanyuki', 'Nyahururu', 'Rumuruti', 'Dol Dol'],
  Lamu: ['Lamu', 'Mpeketoni', 'Witu', 'Faza'],
  Machakos: ['Machakos', 'Athi River', 'Mlolongo', 'Kangundo', 'Masinga'],
  Makueni: ['Wote', 'Emali', 'Makindu', 'Kibwezi'],
  Mandera: ['Mandera', 'Elwak', 'Takaba', 'Rhamu'],
  Marsabit: ['Marsabit', 'Moyale', 'Sololo', 'Laisamis'],
  Meru: ['Meru', 'Nkubu', 'Maua', 'Timau'],
  Migori: ['Migori', 'Kehancha', 'Awendo', 'Isebania'],
  Mombasa: ['Mombasa', 'Nyali', 'Likoni', 'Bamburi', 'Changamwe'],
  'Murang’a': ['Murang’a', 'Kenol', 'Maragua', 'Kangema'],
  'Nairobi City': ['CBD', 'Westlands', 'Kilimani', 'Karen', 'Kasarani', 'Embakasi', 'Runda', 'Ngong Road'],
  Nakuru: ['Nakuru', 'Naivasha', 'Gilgil', 'Molo', 'Njoro'],
  Nandi: ['Kapsabet', 'Nandi Hills', 'Mosoriot', 'Kobujoi'],
  Narok: ['Narok', 'Kilgoris', 'Ololulunga', 'Suswa'],
  Nyamira: ['Nyamira', 'Keroka', 'Nyansiongo', 'Ekerenyo'],
  Nyandarua: ['Ol Kalou', 'Engineer', 'Njabini', 'Ol Joro Orok'],
  Nyeri: ['Nyeri', 'Karatina', 'Othaya', 'Naro Moru'],
  Samburu: ['Maralal', 'Baragoi', 'Wamba', 'Archers Post'],
  Siaya: ['Siaya', 'Bondo', 'Ugunja', 'Ukwala'],
  'Taita-Taveta': ['Voi', 'Taveta', 'Wundanyi', 'Mwatate'],
  'Tana River': ['Hola', 'Garsen', 'Bura', 'Madogo'],
  'Tharaka-Nithi': ['Chuka', 'Kathwana', 'Marimanti', 'Chiakariga'],
  'Trans Nzoia': ['Kitale', 'Kiminini', 'Endebess', 'Saboti'],
  Turkana: ['Lodwar', 'Kakuma', 'Lokichogio', 'Lokitaung'],
  'Uasin Gishu': ['Eldoret', 'Turbo', 'Burnt Forest', 'Moi’s Bridge'],
  Vihiga: ['Mbale', 'Luanda', 'Chavakali', 'Majengo'],
  Wajir: ['Wajir', 'Habaswein', 'Griftu', 'Tarbaj'],
  'West Pokot': ['Kapenguria', 'Makutano', 'Ortum', 'Sigor'],
};

export const travelScopeOptions = [
  { value: 'local_only', label: 'Local only' },
  { value: 'selected_counties', label: 'Selected counties' },
  { value: 'nationwide', label: 'Nationwide' },
] as const;

export type TravelScope = (typeof travelScopeOptions)[number]['value'];

export function getTownsForCounty(county: string | null | undefined) {
  if (!county || !(county in kenyaCountyTowns)) return [];
  return kenyaCountyTowns[county as KenyaCounty];
}

export function buildKenyaLocationLabel(county?: string | null, town?: string | null) {
  if (town && county) return `${town}, ${county}`;
  return town || county || null;
}

type LocationMatchInput = {
  weddingCounty?: string | null;
  weddingTown?: string | null;
  primaryCounty?: string | null;
  primaryTown?: string | null;
  serviceAreas?: string[] | null;
  travelScope?: string | null;
};

export function getLocationMatch(input: LocationMatchInput) {
  const weddingCounty = input.weddingCounty?.trim();
  const weddingTown = input.weddingTown?.trim();
  const primaryCounty = input.primaryCounty?.trim();
  const primaryTown = input.primaryTown?.trim();
  const serviceAreas = (input.serviceAreas ?? []).map((area) => area.trim()).filter(Boolean);

  const reasons: string[] = [];
  let score = 0;

  if (!weddingCounty) {
    return { score, reasons };
  }

  if (
    weddingTown &&
    primaryTown &&
    weddingCounty.toLowerCase() === primaryCounty?.toLowerCase() &&
    weddingTown.toLowerCase() === primaryTown.toLowerCase()
  ) {
    score += 6;
    reasons.push('Near your wedding location');
  } else if (primaryCounty && weddingCounty.toLowerCase() === primaryCounty.toLowerCase()) {
    score += 4;
    reasons.push('Serves your county');
  } else if (serviceAreas.some((area) => area.toLowerCase() === weddingCounty.toLowerCase())) {
    score += 3;
    reasons.push('Serves your county');
  } else if (input.travelScope === 'nationwide') {
    score += 1;
    reasons.push('Available nationwide');
  }

  return { score, reasons };
}

export function getBudgetFit(coupleBudget: number | null, minimumBudgetKes?: number | null, maximumBudgetKes?: number | null) {
  if (!coupleBudget || (minimumBudgetKes == null && maximumBudgetKes == null)) {
    return { score: 0, label: null as string | null };
  }

  const min = minimumBudgetKes ?? 0;
  const max = maximumBudgetKes ?? Number.MAX_SAFE_INTEGER;

  if (coupleBudget >= min && coupleBudget <= max) {
    return { score: 2, label: 'Fits your budget' };
  }

  return { score: 0, label: null };
}

export function formatBudgetBand(minimumBudgetKes?: number | null, maximumBudgetKes?: number | null) {
  if (minimumBudgetKes == null && maximumBudgetKes == null) return null;

  const min = minimumBudgetKes != null ? `KES ${Number(minimumBudgetKes).toLocaleString()}` : 'Flexible';
  const max = maximumBudgetKes != null ? `KES ${Number(maximumBudgetKes).toLocaleString()}` : 'and above';

  if (minimumBudgetKes != null && maximumBudgetKes != null) {
    return `${min} - ${max}`;
  }

  if (minimumBudgetKes != null) return `From ${min}`;
  return `Up to ${max}`;
}
