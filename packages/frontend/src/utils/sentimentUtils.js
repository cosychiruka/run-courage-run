/**
 * sentimentUtils.js
 * Keyword-based headline sentiment — runs entirely in the browser, no API needed.
 * Returns 'happy' | 'scared' | 'neutral'
 */

const POSITIVE_WORDS = [
  'bull', 'moon', 'surge', 'rally', 'green', 'record', 'high', 'growth',
  'win', 'wins', 'won', 'save', 'peace', 'cure', 'breakthrough', 'soar',
  'soars', 'celebrate', 'celebrates', 'rise', 'rises', 'gain', 'gains',
  'recover', 'recovers', 'recovery', 'success', 'succeed', 'improved',
  'improve', 'boost', 'boosts', 'historic', 'milestone', 'hope', 'agreement',
  'deal', 'profit', 'profits', 'discovered', 'discovery', 'breakthrough',
  'launch', 'launches', 'new', 'innovation', 'thriving', 'safe', 'saved',
  'rescued', 'rescue', 'good', 'great', 'best', 'positive', 'joy', 'happy',
];

const NEGATIVE_WORDS = [
  'crash', 'crashes', 'crashed', 'dump', 'dumps', 'hack', 'hacked', 'bear',
  'red', 'fall', 'falls', 'fell', 'loss', 'losses', 'scam', 'death', 'dead',
  'war', 'wars', 'crisis', 'collapse', 'collapses', 'disaster', 'attack',
  'attacks', 'bankrupt', 'fraud', 'kill', 'kills', 'killed', 'shooting',
  'explosion', 'explosions', 'fire', 'flood', 'floods', 'earthquake', 'storm',
  'hurricane', 'tornado', 'drought', 'famine', 'disease', 'outbreak', 'virus',
  'pandemic', 'recession', 'layoffs', 'layoff', 'fired', 'bankrupt',
  'bankruptcy', 'debt', 'default', 'sanction', 'sanctions', 'conflict',
  'riot', 'riots', 'protest', 'protests', 'violence', 'terror', 'terrorist',
  'explosion', 'bomb', 'bombing', 'murder', 'murders', 'arrest', 'arrested',
  'scandal', 'corruption', 'corrupt', 'fail', 'fails', 'failed', 'failure',
  'threat', 'threats', 'danger', 'dangerous', 'toxic', 'poisoned', 'poison',
  'inflation', 'stagflation', 'downturn', 'slump', 'slumps',
];

/**
 * Analyse a news headline and return Courage's emotional reaction.
 * @param {string} headline
 * @returns {'happy' | 'scared' | 'neutral'}
 */
export function analyzeSentiment(headline) {
  if (!headline) return 'neutral';
  const words = headline.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/);

  let positiveScore = 0;
  let negativeScore = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.includes(word)) positiveScore++;
    if (NEGATIVE_WORDS.includes(word)) negativeScore++;
  }

  if (negativeScore > positiveScore) return 'scared';
  if (positiveScore > negativeScore) return 'happy';

  // If equal but both non-zero, lean scared (Courage is a coward after all)
  if (positiveScore > 0 && negativeScore > 0) return 'scared';

  return 'neutral';
}

/**
 * Get a Courage reaction quote for a given emotion.
 */
export function getCourageReaction(emotion) {
  const reactions = {
    happy: [
      "The things I do for good news... *wags tail nervously*",
      "Oh! Oh! Did you see that?! GOOD NEWS! I'm not scared! Well... maybe a little.",
      "This is wonderful! I think. Is it? It is! *runs in circles*",
      "W-w-WAGMI, ser! Courage believes in you! ...mostly.",
    ],
    scared: [
      "AAAAAAH! The news! IT'S TOO MUCH! *hides behind couch*",
      "Oh no. Oh no no no. The things I do for you people... NGMI!",
      "I was NOT prepared for this headline. NOT. PREPARED.",
      "*whimpers* Someone hold me. This is very bad for the vibes.",
    ],
    neutral: [
      "Mm. Just another day in the trenches, ser.",
      "The news is... news. Courage is watching. Courage is always watching.",
      "*sniffs the air* Something is happening. Somewhere. Probably.",
      "I've seen things you wouldn't believe. Also this headline.",
    ],
  };

  const pool = reactions[emotion] || reactions.neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}
