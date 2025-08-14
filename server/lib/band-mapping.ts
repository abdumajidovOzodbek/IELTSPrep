// IELTS Band Mapping Table (approximation - can be updated by admin)
// Raw score to band score conversion for Listening and Reading

interface BandMapping {
  minScore: number;
  maxScore: number;
  band: number;
}

export const LISTENING_BAND_MAPPING: BandMapping[] = [
  { minScore: 39, maxScore: 40, band: 9.0 },
  { minScore: 37, maxScore: 38, band: 8.5 },
  { minScore: 35, maxScore: 36, band: 8.0 },
  { minScore: 33, maxScore: 34, band: 7.5 },
  { minScore: 30, maxScore: 32, band: 7.0 },
  { minScore: 27, maxScore: 29, band: 6.5 },
  { minScore: 23, maxScore: 26, band: 6.0 },
  { minScore: 20, maxScore: 22, band: 5.5 },
  { minScore: 16, maxScore: 19, band: 5.0 },
  { minScore: 13, maxScore: 15, band: 4.5 },
  { minScore: 10, maxScore: 12, band: 4.0 },
  { minScore: 7, maxScore: 9, band: 3.5 },
  { minScore: 5, maxScore: 6, band: 3.0 },
  { minScore: 3, maxScore: 4, band: 2.5 },
  { minScore: 1, maxScore: 2, band: 1.0 },
  { minScore: 0, maxScore: 0, band: 0.0 },
];

export const READING_BAND_MAPPING: BandMapping[] = [
  { minScore: 39, maxScore: 40, band: 9.0 },
  { minScore: 37, maxScore: 38, band: 8.5 },
  { minScore: 35, maxScore: 36, band: 8.0 },
  { minScore: 33, maxScore: 34, band: 7.5 },
  { minScore: 30, maxScore: 32, band: 7.0 },
  { minScore: 27, maxScore: 29, band: 6.5 },
  { minScore: 23, maxScore: 26, band: 6.0 },
  { minScore: 20, maxScore: 22, band: 5.5 },
  { minScore: 16, maxScore: 19, band: 5.0 },
  { minScore: 13, maxScore: 15, band: 4.5 },
  { minScore: 10, maxScore: 12, band: 4.0 },
  { minScore: 7, maxScore: 9, band: 3.5 },
  { minScore: 5, maxScore: 6, band: 3.0 },
  { minScore: 3, maxScore: 4, band: 2.5 },
  { minScore: 1, maxScore: 2, band: 1.0 },
  { minScore: 0, maxScore: 0, band: 0.0 },
];

export function rawScoreToBand(rawScore: number, section: 'listening' | 'reading'): number {
  const mapping = section === 'listening' ? LISTENING_BAND_MAPPING : READING_BAND_MAPPING;
  
  for (const range of mapping) {
    if (rawScore >= range.minScore && rawScore <= range.maxScore) {
      return range.band;
    }
  }
  
  return 0.0; // Default if no match found
}

export function calculateOverallBand(
  listeningBand: number,
  readingBand: number,
  writingBand: number,
  speakingBand: number
): number {
  const average = (listeningBand + readingBand + writingBand + speakingBand) / 4;
  
  // IELTS rounding rules:
  // .25 rounds up to .5
  // .75 rounds up to next integer
  const decimal = average % 1;
  
  if (decimal >= 0.75) {
    return Math.ceil(average);
  } else if (decimal >= 0.25) {
    return Math.floor(average) + 0.5;
  } else {
    return Math.floor(average);
  }
}
