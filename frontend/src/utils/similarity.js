// Utility functions for finding similar locations based on demographics

// Get a unique identifier for a location based on clustering level
export const getLocationIdentifier = (item, level) => {
  if (!item) return '';
  switch (level) {
    case 'town':
      return `${item.county} / ${item.town}`;
    case 'polling':
      return `${item.county} / ${item.town} / ${item.polling_station}`;
    case 'county':
    default:
      return item.county;
  }
};

// Calculate cosine similarity between two items based on demographic percentage features
export const calculateCosineSimilarity = (itemA, itemB) => {
  // Extract percentage features from demographics_pct
  const pctA = itemA.demographics_pct || {};
  const pctB = itemB.demographics_pct || {};
  // Fixed feature list matching backend demographics_pct keys
  const features = [
    'male_18_24', 'male_25_34', 'male_35_44', 'male_45_64', 'male_65_plus',
    'female_18_24', 'female_25_34', 'female_35_44', 'female_45_64', 'female_65_plus'
  ];
  // Map percentage values from demographics_pct
  const vectorA = features.map(f => pctA[f] || 0);
  const vectorB = features.map(f => pctB[f] || 0);
  let dot = 0, magA = 0, magB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dot += vectorA[i] * vectorB[i];
    magA += vectorA[i] * vectorA[i];
    magB += vectorB[i] * vectorB[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  return (!magA || !magB) ? 0 : dot / (magA * magB);
};

// Find top N locations most similar to the selected one
export const findTopSimilarLocations = (selectedIdentifier, data, level, count = 5) => {
  if (!selectedIdentifier || !data?.length) return [];
  const selectedItem = data.find(item => getLocationIdentifier(item, level) === selectedIdentifier);
  if (!selectedItem) return [];

  return data
    .filter(item => getLocationIdentifier(item, level) !== selectedIdentifier)
    .map(item => ({
      identifier: getLocationIdentifier(item, level),
      similarity: calculateCosineSimilarity(selectedItem, item),
      cluster: item.cluster + 1,
      votes: item.total_votes
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, count);
};
