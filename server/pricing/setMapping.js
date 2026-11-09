/**
 * Mapping between internal database set names / codes and TCGPlayer marketplace set names.
 */

// Explicit manual overrides for sets with non-obvious TCGPlayer naming conventions
const POKEMON_NAME_OVERRIDES = {
  // Mega Evolution / Modern 2025-2026
  'pokemon-me1': 'ME01: Mega Evolution',
  'pokemon-me2': 'ME02: Phantasmal Flames',
  'pokemon-me2pt5': 'ME: Ascended Heroes',
  'pokemon-me3': 'ME03: Perfect Order',
  'pokemon-me4': 'ME04: Chaos Rising',
  'pokemon-me5': 'ME05: Pitch Black',
  'pokemon-me6': 'ME06: Delta Reign',
  'pokemon-me55': 'ME: 30th Celebration',
  'pokemon-me55c': 'ME: 30th Celebration Classic Collection',
  'pokemon-zsv10pt5': 'SV: Black Bolt',
  'pokemon-sv8pt5': 'SV: Prismatic Evolutions',
  'pokemon-sv8': 'SV08: Surging Sparks',
  'pokemon-sv7': 'SV07: Stellar Crown',
  'pokemon-sv6pt5': 'SV: Shrouded Fable',
  'pokemon-sv6': 'SV06: Twilight Masquerade',
  'pokemon-sv5': 'SV05: Temporal Forces',
  'pokemon-sv4pt5': 'SV: Paldean Fates',
  'pokemon-sv4': 'SV04: Paradox Rift',
  'pokemon-sv3pt5': 'SV: Scarlet & Violet 151',
  'pokemon-sv3': 'SV03: Obsidian Flames',
  'pokemon-sv2': 'SV02: Paldea Evolved',
  'pokemon-sv1': 'SV01: Scarlet & Violet Base Set',
  'pokemon-sve': 'Scarlet & Violet Energies',
  'pokemon-svp': 'SV: Scarlet & Violet Promo Cards',

  // Sword & Shield
  'pokemon-swsh12pt5': 'SWSH12: Crown Zenith',
  'pokemon-swsh12': 'SWSH11: Silver Tempest',
  'pokemon-swsh11': 'SWSH11: Lost Origin',
  'pokemon-swsh10': 'SWSH10: Astral Radiance',
  'pokemon-swsh9': 'SWSH09: Brilliant Stars',
  'pokemon-swsh8': 'SWSH08: Fusion Strike',
  'pokemon-swsh7': 'SWSH07: Evolving Skies',
  'pokemon-swsh6': 'SWSH06: Chilling Reign',
  'pokemon-swsh5': 'SWSH05: Battle Styles',
  'pokemon-swsh45': 'Shining Fates',
  'pokemon-swsh4': 'SWSH04: Vivid Voltage',
  'pokemon-swsh35': "Champion's Path",
  'pokemon-swsh3': 'SWSH03: Darkness Ablaze',
  'pokemon-swsh2': 'SWSH02: Rebel Clash',
  'pokemon-swsh1': 'SWSH01: Sword & Shield Base Set',
  'pokemon-swshp': 'SWSH: Sword & Shield Promo Cards',

  // Sun & Moon
  'pokemon-sm12': 'SM - Cosmic Eclipse',
  'pokemon-sm115': 'Hidden Fates',
  'pokemon-sm11': 'SM - Unified Minds',
  'pokemon-sm10': 'SM - Unbroken Bonds',
  'pokemon-sm9': 'SM - Team Up',
  'pokemon-sm8': 'SM - Lost Thunder',
  'pokemon-sm75': 'Dragon Majesty',
  'pokemon-sm7': 'SM - Celestial Storm',
  'pokemon-sm6': 'SM - Forbidden Light',
  'pokemon-sm5': 'SM - Ultra Prism',
  'pokemon-sm4': 'SM - Crimson Invasion',
  'pokemon-sm35': 'Shining Legends',
  'pokemon-sm3': 'SM - Burning Shadows',
  'pokemon-sm2': 'SM - Guardians Rising',
  'pokemon-sm1': 'Sun & Moon Base Set',
  'pokemon-smp': 'SM Promos',

  // XY
  'pokemon-xy12': 'XY - Evolutions',
  'pokemon-xy11': 'XY - Steam Siege',
  'pokemon-xy10': 'XY - Fates Collide',
  'pokemon-xy9': 'XY - BREAKpoint',
  'pokemon-xy8': 'XY - BREAKthrough',
  'pokemon-xy7': 'XY - Ancient Origins',
  'pokemon-xy6': 'XY - Roaring Skies',
  'pokemon-xy5': 'XY - Primal Clash',
  'pokemon-xy4': 'XY - Phantom Forces',
  'pokemon-xy3': 'XY - Furious Fists',
  'pokemon-xy2': 'XY - Flashfire',
  'pokemon-xy1': 'XY Base Set',
  'pokemon-xyp': 'XY Promos',

  // Black & White
  'pokemon-bw11': 'Legendary Treasures',
  'pokemon-bw10': 'Plasma Blast',
  'pokemon-bw9': 'Plasma Freeze',
  'pokemon-bw8': 'Plasma Storm',
  'pokemon-bw7': 'Boundaries Crossed',
  'pokemon-bw6': 'Dragons Exalted',
  'pokemon-bw5': 'Dark Explorers',
  'pokemon-bw4': 'Next Destinies',
  'pokemon-bw3': 'Noble Victories',
  'pokemon-bw2': 'Emerging Powers',
  'pokemon-bw1': 'Black and White',
  'pokemon-bwp': 'Black and White Promos',

  // HeartGold & SoulSilver
  'pokemon-hgss4': 'HS - Triumphant',
  'pokemon-hgss3': 'HS - Undaunted',
  'pokemon-hgss2': 'HS - Unleashed',
  'pokemon-hgss1': 'HeartGold SoulSilver',
  'pokemon-hsp': 'HGSS Promos',

  // Diamond & Pearl / Platinum
  'pokemon-pl4': 'Platinum - Arceus',
  'pokemon-pl3': 'Platinum - Supreme Victors',
  'pokemon-pl2': 'Platinum - Rising Rivals',
  'pokemon-pl1': 'Platinum',
  'pokemon-dp7': 'Stormfront',
  'pokemon-dp6': 'Legends Awakened',
  'pokemon-dp5': 'Majestic Dawn',
  'pokemon-dp4': 'Great Encounters',
  'pokemon-dp3': 'Secret Wonders',
  'pokemon-dp2': 'Mysterious Treasures',
  'pokemon-dp1': 'Diamond and Pearl',
  'pokemon-dpp': 'Diamond and Pearl Promos',

  // EX Era
  'pokemon-ex16': 'Power Keepers',
  'pokemon-ex15': 'Dragon Frontiers',
  'pokemon-ex14': 'Crystal Guardians',
  'pokemon-ex13': 'Holon Phantoms',
  'pokemon-ex12': 'Legend Maker',
  'pokemon-ex11': 'Delta Species',
  'pokemon-ex10': 'Unseen Forces',
  'pokemon-ex9': 'Emerald',
  'pokemon-ex8': 'Deoxys',
  'pokemon-ex7': 'Team Rocket Returns',
  'pokemon-ex6': 'FireRed & LeafGreen',
  'pokemon-ex5': 'EX Hidden Legends',
  'pokemon-ex4': 'Team Magma vs Team Aqua',
  'pokemon-ex3': 'Dragon',
  'pokemon-ex2': 'Sandstorm',
  'pokemon-ex1': 'EX Ruby and Sapphire',

  // e-Card Series
  'pokemon-ecard1': 'Expedition',
  'pokemon-ecard2': 'Aquapolis',
  'pokemon-ecard3': 'Skyridge',

  // Trainer Galleries & Special Vaults
  'pokemon-swsh09tg': 'SWSH09: Brilliant Stars Trainer Gallery',
  'pokemon-swsh9tg': 'SWSH09: Brilliant Stars Trainer Gallery',
  'pokemon-swsh10tg': 'SWSH10: Astral Radiance Trainer Gallery',
  'pokemon-swsh11tg': 'SWSH11: Lost Origin Trainer Gallery',
  'pokemon-swsh12tg': 'SWSH12: Silver Tempest Trainer Gallery',
  'pokemon-swsh12pt5gg': 'SWSH: Crown Zenith: Galarian Gallery',
  'pokemon-swsh45sv': 'Shining Fates: Shiny Vault',
  'pokemon-sma': 'Hidden Fates: Shiny Vault',
  'pokemon-dv1': 'Dragon Vault',
  'pokemon-cel25c': 'Celebrations: Classic Collection',

  // Vintage WotC
  'pokemon-base1': 'Base Set',
  'pokemon-base2': 'Jungle',
  'pokemon-base3': 'Fossil',
  'pokemon-base4': 'Base Set 2',
  'pokemon-base5': 'Team Rocket',
  'pokemon-base6': 'Legendary Collection',
  'pokemon-gym1': 'Gym Heroes',
  'pokemon-gym2': 'Gym Challenge',
  'pokemon-neo1': 'Neo Genesis',
  'pokemon-neo2': 'Neo Discovery',
  'pokemon-neo3': 'Neo Revelation',
  'pokemon-neo4': 'Neo Destiny',
  'pokemon-basep': 'WoTC Promo',
  'pokemon-np': 'Nintendo Promos',
  'pokemon-bp': 'Best of Promos',
  'pokemon-pgo': 'Pokemon GO',

  // McDonald's promos
  'pokemon-mcd22': "McDonald's Promos 2022",
  'pokemon-mcd21': "McDonald's 25th Anniversary Promos",
  'pokemon-mcd19': "McDonald's Promos 2019",
  'pokemon-mcd18': "McDonald's Promos 2018",
  'pokemon-mcd17': "McDonald's Promos 2017",
  'pokemon-mcd16': "McDonald's Promos 2016",
  'pokemon-mcd15': "McDonald's Promos 2015",
  'pokemon-mcd14': "McDonald's Promos 2014",
  'pokemon-mcd12': "McDonald's Promos 2012",
  'pokemon-mcd11': "McDonald's Promos 2011",
};

// Gundam mapping
const GUNDAM_NAME_OVERRIDES = {
  'gundam-GD01': 'Newtype Rising',
  'gundam-GD02': 'Dual Impact',
  'gundam-GD03': 'Steel Requiem',
  'gundam-GD04': 'Phantom Aria',
  'gundam-GD05': 'Freedom Ascension',
  'gundam-GD06': 'Stardust Trails',
  'gundam-ST01': 'Starter Deck 01: Heroic Beginnings',
  'gundam-ST02': 'Starter Deck 02: Wings of Advance',
  'gundam-ST03': "Starter Deck 03: Zeon's Rush",
  'gundam-ST04': 'Starter Deck 04: SEED Strike',
  'gundam-ST05': 'Starter Deck 05: Iron Bloom',
  'gundam-ST06': 'Starter Deck 06: Clan Unity',
  'gundam-ST07': 'Starter Deck 07: Celestial Drive',
  'gundam-ST08': 'Starter Deck 08: Flash of Radiance',
  'gundam-ST09': 'Starter Deck 09: Destiny Ignition',
  'gundam-ST10': 'Starter Deck 10: Generation Pulse',
  'gundam-ST11': 'Starter Deck 11: Aquatic Assault',
  'gundam-ST12': 'Starter Deck 12: Raging Onslaught',
  'gundam-ST13': 'Starter Deck 13: Silent Barrage',
  'gundam-ST14': 'Starter Deck 14: Heavy Dominion',
  'gundam-EB01': 'Eternal Nexus',
  'gundam-SC01': 'Deck Build Box Freedom Ascension',
  'gundam-R': 'Edition Beta',
  'gundam-EXB': 'Edition Beta',
  'gundam-EXR': 'Edition Beta',
};

// Dragon Ball Super: Fusion World mapping
const FUSION_WORLD_NAME_OVERRIDES = {
  'fusionworld-FB01': 'Awakened Pulse',
  'fusionworld-FB02': 'Blazing Aura',
  'fusionworld-FB03': 'Raging Roar',
  'fusionworld-FB04': 'Ultra Limit',
  'fusionworld-FB05': 'New Adventure',
  'fusionworld-FB06': 'Rivals Clash',
  'fusionworld-FB07': 'Wish For Shenron',
  'fusionworld-FB08': "Saiyan's Pride",
  'fusionworld-FB09': 'Dual Evolution',
  'fusionworld-FB10': 'Cross Force',
  'fusionworld-FB11': 'Brightness of Hope',
  'fusionworld-ST01': 'Story Booster 01',
  'fusionworld-SB01': 'Manga Booster 01',
  'fusionworld-SB02': 'Manga Booster 02',
  'fusionworld-FS01': 'Starter Deck 1: Son Goku',
  'fusionworld-FS02': 'Starter Deck 2: Vegeta',
  'fusionworld-FS03': 'Starter Deck 3: Broly',
  'fusionworld-FS04': 'Starter Deck 4: Frieza',
  'fusionworld-FS05': 'Starter Deck 5: Bardock',
  'fusionworld-FS06': 'Starter Deck 6: Son Goku (Mini)',
  'fusionworld-FS07': 'Starter Deck 7: Vegeta (Mini)',
  'fusionworld-FS08': 'Starter Deck 8: Vegeta (Mini) Super Saiyan 3',
  'fusionworld-FS09': 'Starter Deck 9: Shallot',
  'fusionworld-FS10': 'Starter Deck 10: Giblet',
  'fusionworld-FS11': 'Starter Deck EX: The Beat of Ki',
  'fusionworld-FS12': 'Starter Deck EX: The Phase of Evolution',
  'fusionworld-FS13': 'Starter Deck 13: The Saiyan Raised on Earth',
  'fusionworld-FS14': 'Starter Deck 14: The Prince of Saiyan',
  'fusionworld-FP': 'Fusion World Promotion Cards and Packs',
};

// One Piece mapping
const ONE_PIECE_NAME_OVERRIDES = {
  'onepiece-569301': 'Premium Booster -The Best-',
  'onepiece-569302': 'Premium Booster -The Best- Vol. 2',
};

/**
 * Returns the exact TCGPlayer set name for a given internal set ID or name.
 */
function getTcgSetName(gameId, setId, setName) {
  if (gameId === 'pokemon') {
    if (POKEMON_NAME_OVERRIDES[setId]) return POKEMON_NAME_OVERRIDES[setId];
    // Fallback: clean set name
    return setName;
  }
  if (gameId === 'gundam') {
    if (GUNDAM_NAME_OVERRIDES[setId]) return GUNDAM_NAME_OVERRIDES[setId];
    return setName;
  }
  if (gameId === 'fusionworld') {
    if (FUSION_WORLD_NAME_OVERRIDES[setId]) return FUSION_WORLD_NAME_OVERRIDES[setId];
    return setName;
  }
  if (gameId === 'riftbound') {
    return setName;
  }
  if (gameId === 'onepiece') {
    if (ONE_PIECE_NAME_OVERRIDES[setId]) return ONE_PIECE_NAME_OVERRIDES[setId];
    return setName;
  }
  return setName;
}

module.exports = {
  POKEMON_NAME_OVERRIDES,
  GUNDAM_NAME_OVERRIDES,
  FUSION_WORLD_NAME_OVERRIDES,
  ONE_PIECE_NAME_OVERRIDES,
  getTcgSetName
};
