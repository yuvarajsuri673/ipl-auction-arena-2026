const fs = require('fs');
const path = require('path');

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

// Famous player baseline ratings when stats were not in 2026 leaderboard extract
const FAMOUS_PLAYER_RATINGS = {
  'MS Dhoni': { rating: 92, basePrice: 2.0 },
  'Sarfaraz Khan': { rating: 78, basePrice: 1.0 },
  'Rahul Chahar': { rating: 80, basePrice: 1.5 },
  'Khaleel Ahmed': { rating: 82, basePrice: 1.5 },
  'Mukesh Choudhary': { rating: 75, basePrice: 1.0 },
  'Jamie Overton': { rating: 78, basePrice: 1.0 },
  'Dewald Brevis': { rating: 81, basePrice: 1.5 },
  'Matthew Short': { rating: 77, basePrice: 1.0 },
  'Spencer Johnson': { rating: 83, basePrice: 1.5 },
  'Zak Foulkes': { rating: 74, basePrice: 0.75 },
  'Matt Henry': { rating: 84, basePrice: 1.5 },
  'Noor Ahmad': { rating: 87, basePrice: 2.0 },
  'Shreyas Gopal': { rating: 75, basePrice: 1.0 },
  'Aman Khan': { rating: 72, basePrice: 0.75 },
  'Prashant Veer': { rating: 70, basePrice: 0.75 },
  'Ayush Mhatre': { rating: 71, basePrice: 0.75 },
  'Urvil Patel': { rating: 73, basePrice: 0.75 },
  'Ramakrishna Ghosh': { rating: 69, basePrice: 0.75 },
  'Gurjapneet Singh': { rating: 72, basePrice: 0.75 }
};

// Standardised Player Base Price System (₹75 Lakhs min to ₹2.00 Cr max)
function determineBasePrice(rating, isOverseas, isUncapped, stats = {}) {
  // Premium / Top-rated players start directly at ₹2 Crore
  if (rating >= 84 || (stats.runs && stats.runs >= 400) || (stats.wickets && stats.wickets >= 14)) {
    return 2.00;
  }
  // High-tier players (₹1.50 Crore)
  if (rating >= 78 || (isOverseas && rating >= 74) || (stats.runs && stats.runs >= 250) || (stats.wickets && stats.wickets >= 10)) {
    return 1.50;
  }
  // Mid-tier players (₹1.00 Crore)
  if (rating >= 70 || isOverseas) {
    return 1.00;
  }
  // Minimum starting price: ₹75 Lakhs (0.75 Cr)
  return 0.75;
}

function normalizeRole(role) {
  if (!role) return 'All-rounder';
  const r = role.toLowerCase();
  if (r.includes('wicketkeeper')) return 'Wicketkeeper-Batter';
  if (r.includes('spin-bowling all-rounder') || r.includes('all-rounder')) return 'All-rounder';
  if (r.includes('fast bowler')) return 'Fast Bowler';
  if (r.includes('spinner')) return 'Spinner';
  if (r.includes('bowler')) return 'Bowler';
  if (r.includes('batter')) return 'Batter';
  return role;
}

const csvPath = path.join(__dirname, '..', 'IPL_Auction_Arena_2026_Player_Pool_250_Antigravity.csv');
const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.trim().split(/\r?\n/);
const headers = parseCSVLine(lines[0]);

const players = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const cols = parseCSVLine(line);
  const row = {};
  headers.forEach((h, idx) => {
    row[h] = cols[idx] !== undefined ? cols[idx] : '';
  });

  const name = row['player_name'] || `Player ${i}`;
  const isOverseas = row['is_overseas'] === 'True';
  const isWk = row['is_wicketkeeper'] === 'True';
  const isUncapped = row['is_uncapped_indian'] === 'True';
  const rawRating = parseFloat(row['overall_rating_100']);

  let rating = null;
  let basePrice = parseFloat(row['base_price_cr']);

  if (!isNaN(rawRating) && rawRating > 0) {
    rating = Math.round(rawRating);
  } else if (FAMOUS_PLAYER_RATINGS[name]) {
    rating = FAMOUS_PLAYER_RATINGS[name].rating;
    if (isNaN(basePrice)) basePrice = FAMOUS_PLAYER_RATINGS[name].basePrice;
  } else {
    // Generate realistic balanced rating
    if (isUncapped) {
      rating = 60 + Math.floor((name.charCodeAt(0) * 7 + i * 13) % 15);
    } else if (isOverseas) {
      rating = 72 + Math.floor((name.charCodeAt(0) * 11 + i * 17) % 16);
    } else {
      rating = 70 + Math.floor((name.charCodeAt(0) * 5 + i * 19) % 17);
    }
  }

  const stats = {
    matchesBatted: parseInt(row['2026_matches_batted']) || 0,
    runs: parseInt(row['2026_runs']) || 0,
    highScore: parseInt(row['2026_high_score']) || 0,
    strikeRate: parseFloat(row['2026_batting_strike_rate']) || 0,
    fours: parseInt(row['2026_fours']) || 0,
    sixes: parseInt(row['2026_sixes']) || 0,
    matchesBowled: parseInt(row['2026_matches_bowled']) || 0,
    overs: parseFloat(row['2026_overs']) || 0,
    wickets: parseInt(row['2026_wickets']) || 0,
    economy: parseFloat(row['2026_economy_rate']) || 0,
    bowlingAvg: parseFloat(row['2026_bowling_average']) || 0
  };

  if (isNaN(basePrice) || basePrice < 0.75 || basePrice > 2.00) {
    basePrice = determineBasePrice(rating, isOverseas, isUncapped, stats);
  }

  const role = normalizeRole(row['primary_role']);
  const battingRating = parseFloat(row['batting_rating_100']) || (role.includes('Batter') || role.includes('Wicketkeeper') || role.includes('All-rounder') ? rating : Math.round(rating * 0.4));
  const bowlingRating = parseFloat(row['bowling_rating_100']) || (role.includes('Bowler') || role.includes('Spinner') || role.includes('All-rounder') ? rating : Math.round(rating * 0.3));

  players.push({
    id: row['player_id'] || `IPL26-${String(i).padStart(3, '0')}`,
    name: name,
    nationality: row['nationality'] || (isOverseas ? 'Overseas' : 'India'),
    playerType: row['player_type'] || (isOverseas ? 'Overseas' : 'Indian'),
    role: role,
    category: role.includes('Batter') ? 'Batting' : (role.includes('Bowler') || role.includes('Spinner') ? 'Bowling' : 'All-round'),
    isOverseas: isOverseas,
    isWicketkeeper: isWk,
    isUncapped: isUncapped,
    battingRating: Math.round(battingRating),
    bowlingRating: Math.round(bowlingRating),
    overallRating: rating,
    basePrice: Number(basePrice.toFixed(2)),
    stats: stats,
    status: 'Available', // Available, Current, Sold, Unsold
    soldTo: null,
    soldPrice: 0
  });
}

const outDir = path.join(__dirname);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'players.json');
fs.writeFileSync(outPath, JSON.stringify(players, null, 2), 'utf8');

console.log(`Successfully processed ${players.length} players! Saved to ${outPath}`);
console.log(`Rating range: Min=${Math.min(...players.map(p => p.overallRating))}, Max=${Math.max(...players.map(p => p.overallRating))}`);
console.log(`Base price range: Min=${Math.min(...players.map(p => p.basePrice))} Cr, Max=${Math.max(...players.map(p => p.basePrice))} Cr`);
