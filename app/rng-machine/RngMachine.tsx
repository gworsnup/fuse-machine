"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import styles from "./rng-machine.module.css";

type Rarity =
  | "Legendary"
  | "Mythic"
  | "Godly"
  | "Secret"
  | "OG";

type Oddling = {
  id: string;
  name: string;
  image: string;
  description: string;
  rarity: Rarity;
  price: number;
  income: number;
  weight: number;
  eventOnly?: boolean;
};

type Mutation = "normal" | "gold" | "diamond" | "rainbow";

type OwnedOddling = Oddling & { count: number; mutation: Mutation };
type RolledOddling = Oddling & { mutation: Mutation; oddsOneIn: number };
type UpgradeBranch = "luck" | "speed" | "mutation";
type Upgrades = Record<UpgradeBranch, number>;
type PotionKind = "luck" | "mutation" | "turbo" | "double";
type SpecialEvent = "meteor" | "glitch" | "golden" | "double" | null;

type GameStats = {
  totalRolls: number;
  highestLuck: number;
  rarestOdds: number;
  totalEarned: number;
  mutationsFound: Mutation[];
  charactersSold: number;
};

type CloverTheme = "green" | "gold" | "purple" | "rainbow" | "noir" | "cosmic";

type LuckToken = {
  id: string;
  kind: "luck";
  multiplier: number;
  name: string;
  clovers: number;
  theme: CloverTheme;
};

type ReelEntry = Oddling | LuckToken;

type CharacterPerformance = {
  line: string;
  pitches: number[];
  wave: OscillatorType;
  voicePitch: number;
  voiceRate: number;
};

const SPIN_COST = 2_000;
const STARTING_CASH = 60_000;
const MAX_ACTIVE_ODDLINGS = 5;
const MAX_UPGRADE_LEVEL = 5;
const LUCK_LEVELS = [1, 2, 4, 6, 8, 10, 20] as const;
const MUTATIONS: Mutation[] = ["normal", "gold", "diamond", "rainbow"];
const PITY_MAX = 40;

const potionShop: Record<PotionKind, { name: string; price: number; detail: string }> = {
  luck: { name: "Lucky Fizz", price: 250_000, detail: "+5% luck · 5 rolls" },
  mutation: { name: "Mutation Mix", price: 500_000, detail: "+15% mutation · 5 rolls" },
  turbo: { name: "Turbo Pop", price: 150_000, detail: "+20% reel speed · 5 rolls" },
  double: { name: "Income Juice", price: 1_000_000, detail: "2× income · 5 minutes" },
};

const rebirthRecipes = [
  { characters: ["trollini-gamerini", "snoozi-mozzi"], cash: 1_000_000 },
  { characters: ["lava-llama", "ramen-ronin"], cash: 25_000_000 },
  { characters: ["solar-samurai", "midnight-mole"], cash: 250_000_000 },
  { characters: ["phantom-fox", "night-seraph"], cash: 2_000_000_000 },
  { characters: ["star-eater", "heavenly-dragon"], cash: 25_000_000_000 },
] as const;

const mutationMultipliers: Record<Mutation, number> = {
  normal: 1,
  gold: 1.25,
  diamond: 1.75,
  rainbow: 10,
};

function getSpinCost(upgrades: Upgrades) {
  const purchasedLevels = Object.values(upgrades).reduce(
    (total, level) => total + level,
    0,
  );
  return Math.round((SPIN_COST * Math.pow(1.3, purchasedLevels)) / 100) * 100;
}

function getLuckChance(upgrades: Upgrades, rebirths: number) {
  return Math.min(0.35, 0.15 + upgrades.luck * 0.015 + rebirths * 0.005);
}

function getRebirthRecipe(rebirths: number) {
  const finalRecipe = rebirthRecipes[rebirthRecipes.length - 1];
  if (rebirths < rebirthRecipes.length) return rebirthRecipes[rebirths];
  return {
    characters: finalRecipe.characters,
    cash: finalRecipe.cash * Math.pow(4, rebirths - rebirthRecipes.length + 1),
  };
}

const upgradeCosts: Record<UpgradeBranch, number[]> = {
  luck: [25_000, 100_000, 500_000, 2_000_000, 10_000_000],
  speed: [20_000, 80_000, 350_000, 1_500_000, 7_000_000],
  mutation: [50_000, 250_000, 1_000_000, 5_000_000, 25_000_000],
};

const luckTokens: Record<number, LuckToken> = {
  2: { id: "luck-2", kind: "luck", multiplier: 2, name: "Green Clover", clovers: 1, theme: "green" },
  4: { id: "luck-4", kind: "luck", multiplier: 4, name: "Golden Pair", clovers: 2, theme: "gold" },
  6: { id: "luck-6", kind: "luck", multiplier: 6, name: "Purple Stack", clovers: 3, theme: "purple" },
  8: { id: "luck-8", kind: "luck", multiplier: 8, name: "Rainbow Cluster", clovers: 4, theme: "rainbow" },
  10: { id: "luck-10", kind: "luck", multiplier: 10, name: "Black & Silver", clovers: 2, theme: "noir" },
  20: { id: "luck-20", kind: "luck", multiplier: 20, name: "Pink Nebula", clovers: 2, theme: "cosmic" },
  50: { id: "luck-50", kind: "luck", multiplier: 50, name: "Meme Storm Clover", clovers: 4, theme: "cosmic" },
};

const oddlings: Oddling[] = [
  { id: "trollini-gamerini", name: "Fairs Meme", image: "/characters/fairs-cutout.png", description: "The masked OK-sign legend who always knows when the roll is fair.", rarity: "Legendary", price: 10_000, income: 1_000, weight: 64 },
  { id: "le-godly-developer-chester", name: "Le Godly Developer Chester", image: "/characters/le-godly-developer-chester.jpeg", description: "The tiny coding mastermind whose next update is always legendary.", rarity: "Legendary", price: 30_000, income: 3_000, weight: 52 },
  { id: "snoozi-mozzi", name: "Verity", image: "/characters/verity-reference.webp", description: "A simple yellow smiley with unstoppable positive energy.", rarity: "Legendary", price: 50_000, income: 5_000, weight: 42 },

  { id: "lava-llama", name: "67", image: "/characters/sixty-seven-cutout.png", description: "The glowing, wide-mouthed sixty-seven energy meme in its final form.", rarity: "Mythic", price: 180_000, income: 15_000, weight: 16 },
  { id: "astro-axolotl", name: "My Mom Is Kinda Homeless", image: "/characters/mom-homeless-cutout.png", description: "A dramatic streamer caught in the most emotional pause imaginable.", rarity: "Mythic", price: 220_000, income: 17_500, weight: 11 },
  { id: "ramen-ronin", name: "Homer Drops His Donut", image: "/characters/homer-donut-cutout.png", description: "Homer watches in horror as his precious pink-frosted donut hits the kitchen floor.", rarity: "Mythic", price: 275_000, income: 20_000, weight: 7 },

  { id: "disco-kraken", name: "City Boy", image: "/characters/city-boy-cutout.png", description: "The park ranger who can call out across the whole meme wilderness.", rarity: "Godly", price: 750_000, income: 50_000, weight: 4.5 },
  { id: "solar-samurai", name: "Skibidi Toilet", image: "/characters/skibidi-toilet.png", description: "The impossible toilet-headed visitor who refuses to stay flushed.", rarity: "Godly", price: 1_100_000, income: 75_000, weight: 3.8 },
  { id: "thunder-yeti", name: "DanTDM 2015", image: "/characters/dantdm-2015-cutout.png", description: "A red-sleeved gaming throwback with the classic swept fringe.", rarity: "Godly", price: 1_500_000, income: 100_000, weight: 3.1 },
  { id: "quantum-capybara", name: "Neegy", image: "/characters/neegy-gold-manny.png", description: "The golden Manny with the long neck, legendary nose and priceless sideways stare.", rarity: "Godly", price: 2_000_000, income: 125_000, weight: 2.5 },
  { id: "mecha-mantis", name: "La Peace", image: "/characters/la-peace.png", description: "A peaceful philosopher whose ancient wisdom keeps the money flowing.", rarity: "Godly", price: 2_600_000, income: 160_000, weight: 2 },
  { id: "crowned-cobra", name: "I Can't Do Nathan", image: "/characters/i-cant-do-nathan-cat-cutout.png", description: "The uniformed cat who has reached the absolute limit of what Nathan can ask.", rarity: "Godly", price: 3_400_000, income: 200_000, weight: 1.5 },
  { id: "galaxy-gorilla", name: "For Example Nothing", image: "/characters/for-example-nothing-cutout.png", description: "The smile that appears when the perfect example is absolutely nothing.", rarity: "Godly", price: 4_500_000, income: 250_000, weight: 1.05 },

  { id: "midnight-mole", name: "Tung Tung Tung Sahur", image: "/characters/tung-tung-tung-sahur-cutout.png", description: "The wooden night caller who arrives carrying his unmistakable bat.", rarity: "Secret", price: 6_000_000, income: 300_000, weight: 0.65 },
  { id: "silver-slime", name: "Chicken Jockey", image: "/characters/chicken-jockey.webp", description: "A furious tiny rider charging into battle on one fearless chicken.", rarity: "Secret", price: 10_000_000, income: 500_000, weight: 0.44 },
  { id: "obsidian-owl", name: "Dubistgutgenug", image: "/characters/dubistgutgenug-cutout.png", description: "The moonlit guitarist whose serious stare says you are good enough.", rarity: "Secret", price: 35_000_000, income: 1_500_000, weight: 0.28 },
  { id: "phantom-fox", name: "Angry Bird Meme", image: "/characters/angry-bird-cutout.gif", description: "The angriest bird channels enough golden power to crack the entire reel.", rarity: "Secret", price: 75_000_000, income: 3_000_000, weight: 0.16 },
  { id: "eclipse-golem", name: "Chill Guy Meme", image: "/characters/chill-guy-meme.png", description: "He is simply a chill guy—and five million a second will not change that.", rarity: "Secret", price: 130_000_000, income: 5_000_000, weight: 0.09 },

  { id: "night-seraph", name: "Barbershop Haircut Meme", image: "/characters/barbershop-haircut-cutout.png", description: "The haircut reveal so powerful it takes over the whole stage.", rarity: "Secret", price: 350_000_000, income: 15_000_000, weight: 0.035 },
  { id: "shadow-sphinx", name: "Adrian Meme", image: "/characters/adrian-cutout.gif", description: "Adrian has been summoned to explain the friend group one final time.", rarity: "Secret", price: 750_000_000, income: 30_000_000, weight: 0.018 },
  { id: "chrome-phantom", name: "Trollface", image: "/characters/trollface.png", description: "The original grin appears only when the roll knows exactly what it has done.", rarity: "Secret", price: 1_600_000_000, income: 65_000_000, weight: 0.009 },
  { id: "void-emperor", name: "Niche Baby Meme", image: "/characters/niche-baby-cutout.png", description: "The niche baby has arrived to announce one very specific opinion.", rarity: "Secret", price: 2_500_000_000, income: 100_000_000, weight: 0.0045 },
  { id: "star-eater", name: "Low Taper Fade Meme", image: "/characters/low-taper-fade-cutout.png", description: "Imagine if the low taper fade meme was still absolutely massive.", rarity: "Secret", price: 4_200_000_000, income: 165_000_000, weight: 0.0018 },

  { id: "heavenly-dragon", name: "Funky Ehh", image: "/characters/i-cant-do-nathan.png", description: "The exhausted green Gumball whose expression has reached legendary meme status.", rarity: "OG", price: 10_000_000_000, income: 350_000_000, weight: 0.00035 },
];

const fusionOddlings: Oddling[] = [
  { id: "vault-vulture", name: "Gucci Morty Meme", image: "/characters/gucci-morty-cutout.png", description: "Morty has discovered designer fashion and refuses to explain the fit.", rarity: "Secret", price: 80_000_000, income: 3_000_000, weight: 0 },
  { id: "neon-narwhal", name: "Last Name Is Burger Meme", image: "/characters/last-name-is-burger-cutout.png", description: "Evan delivers the last name with enough confidence to power the fuse machine.", rarity: "Secret", price: 190_000_000, income: 8_500_000, weight: 0 },
  { id: "chrono-chameleon", name: "John Pork Meme", image: "/characters/john-pork-cutout.png", description: "John Pork is calling—and this time the fusion machine answered.", rarity: "Secret", price: 520_000_000, income: 22_000_000, weight: 0 },
  { id: "nova-leviathan", name: "Gedagedigedagedago Meme", image: "/characters/gedagedigedagedago-cutout.png", description: "The nugget-shaped legend has been singing since the first fusion.", rarity: "Secret", price: 1_700_000_000, income: 70_000_000, weight: 0 },
  { id: "crowned-cosmos", name: "Mustard Meme", image: "/characters/mustard-cutout.png", description: "A wild-eyed grin announces that the mustard has reached maximum power.", rarity: "Secret", price: 3_200_000_000, income: 125_000_000, weight: 0 },
  { id: "realistic-bart", name: "Realistic Bart Meme", image: "/characters/realistic-bart-cutout.png", description: "Bart has become far too realistic for the normal roll machine.", rarity: "Secret", price: 6_000_000_000, income: 250_000_000, weight: 0 },
  { id: "origin-phoenix", name: "Lord Kirk Meme", image: "/characters/lord-kirk-cutout.png", description: "The angelic Lord Kirk watches over the rarest fusion chamber.", rarity: "OG", price: 14_000_000_000, income: 500_000_000, weight: 0 },
];

const allOddlings = [...oddlings, ...fusionOddlings];

const characterPerformances: Record<string, CharacterPerformance> = {
  "trollini-gamerini": { line: "Heh-heh… GG. Too easy!", pitches: [180, 145, 190], wave: "square", voicePitch: 0.72, voiceRate: 1.08 },
  "snoozi-mozzi": { line: "Five more minutes… then we earn.", pitches: [220, 185, 155], wave: "sine", voicePitch: 0.72, voiceRate: 0.72 },
  "lava-llama": { line: "Things are about to heat up!", pitches: [170, 230, 310], wave: "sawtooth", voicePitch: 0.9, voiceRate: 1.05 },
  "astro-axolotl": { line: "Next stop: the edge of everything!", pitches: [420, 620, 840], wave: "sine", voicePitch: 1.25, voiceRate: 1.08 },
  "ramen-ronin": { line: "The broth is calm. The blade is ready.", pitches: [330, 247, 392], wave: "triangle", voicePitch: 0.9, voiceRate: 0.88 },
  "disco-kraken": { line: "Eight arms. One unstoppable groove!", pitches: [196, 247, 294, 392], wave: "square", voicePitch: 1.08, voiceRate: 1.12 },
  "solar-samurai": { line: "Face the light of a thousand suns.", pitches: [262, 392, 523], wave: "triangle", voicePitch: 0.88, voiceRate: 0.9 },
  "thunder-yeti": { line: "The mountain answers with thunder!", pitches: [110, 165, 82], wave: "sawtooth", voicePitch: 0.58, voiceRate: 0.82 },
  "quantum-capybara": { line: "Relax. I already won in another universe.", pitches: [310, 465, 349], wave: "sine", voicePitch: 0.95, voiceRate: 0.92 },
  "mecha-mantis": { line: "Target locked. Fortune acquired.", pitches: [520, 390, 780], wave: "square", voicePitch: 0.72, voiceRate: 1.15 },
  "crowned-cobra": { line: "Bow before the ruler of the ruins.", pitches: [196, 247, 294], wave: "triangle", voicePitch: 0.68, voiceRate: 0.86 },
  "galaxy-gorilla": { line: "That pull was written in the stars!", pitches: [98, 147, 196], wave: "sawtooth", voicePitch: 0.62, voiceRate: 0.9 },
  "midnight-mole": { line: "Shh… treasure sounds better in the dark.", pitches: [240, 210, 180], wave: "sine", voicePitch: 0.78, voiceRate: 0.84 },
  "silver-slime": { line: "Shiny, squishy and seriously profitable!", pitches: [440, 520, 660], wave: "sine", voicePitch: 1.3, voiceRate: 1.12 },
  "obsidian-owl": { line: "I saw this victory before you rolled.", pitches: [185, 277, 208], wave: "triangle", voicePitch: 0.68, voiceRate: 0.78 },
  "phantom-fox": { line: "You found me… or did I find you?", pitches: [370, 555, 415], wave: "sine", voicePitch: 1.14, voiceRate: 0.9 },
  "eclipse-golem": { line: "Day fades. The guardian awakens.", pitches: [82, 123, 164], wave: "sawtooth", voicePitch: 0.52, voiceRate: 0.72 },
  "night-seraph": { line: "Even the darkness has a guardian.", pitches: [294, 440, 587], wave: "sine", voicePitch: 1.08, voiceRate: 0.82 },
  "shadow-sphinx": { line: "One answer. Infinite rewards.", pitches: [147, 220, 330], wave: "triangle", voicePitch: 0.7, voiceRate: 0.76 },
  "chrome-phantom": { line: "Reflection confirmed. Reality optional.", pitches: [620, 465, 700], wave: "square", voicePitch: 0.82, voiceRate: 1.02 },
  "void-emperor": { line: "The void does not choose twice.", pitches: [73, 110, 146], wave: "sawtooth", voicePitch: 0.5, voiceRate: 0.68 },
  "star-eater": { line: "Still hungry. Bring me another sun.", pitches: [65, 98, 78], wave: "sawtooth", voicePitch: 0.46, voiceRate: 0.72 },
  "heavenly-dragon": { line: "The heavens have judged you worthy.", pitches: [262, 392, 523, 784], wave: "sine", voicePitch: 0.88, voiceRate: 0.74 },
};

const rarityRank: Record<Rarity, number> = {
  Legendary: 0,
  Mythic: 1,
  Godly: 2,
  Secret: 3,
  OG: 4,
};

function formatCash(value: number) {
  return new Intl.NumberFormat("en-GB", {
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Math.floor(value));
}

function randomUnit() {
  return Math.random();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentTimestamp() {
  return Date.now();
}

function buildLuckChain(chance: number) {
  const chain: number[] = [1];

  for (const level of LUCK_LEVELS.slice(1)) {
    if (Math.random() >= chance) break;
    chain.push(level);
  }

  return chain;
}

function getMutationChances(upgradeLevel: number, bonus = 0): Record<Mutation, number> {
  const rainbowChance = 0.01 + upgradeLevel * 0.0025;
  const diamondChance = 0.05 + upgradeLevel * 0.0075;
  const goldChance = 0.24 + upgradeLevel * 0.02 + bonus;
  return {
    normal: 1 - rainbowChance - diamondChance - goldChance,
    gold: goldChance,
    diamond: diamondChance,
    rainbow: rainbowChance,
  };
}

function pickMutation(upgradeLevel: number, bonus = 0, guaranteed = false): Mutation {
  const chances = getMutationChances(upgradeLevel, bonus);
  const ticket = Math.random();

  if (guaranteed) {
    const mutationTotal = chances.gold + chances.diamond + chances.rainbow;
    const mutationTicket = ticket * mutationTotal;
    if (mutationTicket < chances.rainbow) return "rainbow";
    if (mutationTicket < chances.rainbow + chances.diamond) return "diamond";
    return "gold";
  }

  if (ticket < chances.rainbow) return "rainbow";
  if (ticket < chances.rainbow + chances.diamond) return "diamond";
  if (ticket < chances.rainbow + chances.diamond + chances.gold) return "gold";
  return "normal";
}

function ownedKey(id: string, mutation: Mutation) {
  return `${id}:${mutation}`;
}

function mutatedIncome(oddling: Oddling, mutation: Mutation) {
  return oddling.income * mutationMultipliers[mutation];
}

function pickOddling(luck: number, pity = 0, bossRoll = false) {
  if (luck >= 2) {
    const commonSecrets = oddlings.filter(
      (oddling) => oddling.rarity === "Secret" && oddling.income <= 5_000_000,
    );
    const highTierSecretsAndOgs = oddlings.filter(
      (oddling) =>
        (oddling.rarity === "Secret" && oddling.income >= 15_000_000) ||
        oddling.rarity === "OG",
    );
    const highTierChance = bossRoll
      ? 1
      : luck >= 50
        ? Math.min(0.55 + pity * 0.002, 0.7)
        : Math.min(0.01 * (luck / 2) + pity * 0.002, 0.2);
    const pool = Math.random() < highTierChance ? highTierSecretsAndOgs : commonSecrets;
    const boostedWeights: Record<string, number> = {
      "midnight-mole": 62,
      "silver-slime": 23,
      "obsidian-owl": 9,
      "phantom-fox": 4,
      "eclipse-golem": 2,
      "night-seraph": 55,
      "shadow-sphinx": 25,
      "chrome-phantom": 12,
      "void-emperor": 6,
      "star-eater": 2,
      "heavenly-dragon": 0.04,
    };
    const total = pool.reduce(
      (sum, oddling) => sum + boostedWeights[oddling.id],
      0,
    );
    let ticket = Math.random() * total;

    for (const oddling of pool) {
      ticket -= boostedWeights[oddling.id];
      if (ticket <= 0) return oddling;
    }

    return pool[0];
  }

  const weighted = oddlings.map((oddling) => ({
    oddling,
    adjustedWeight:
      oddling.weight *
      (oddling.rarity === "OG"
        ? 1 + pity * 0.12
        : oddling.rarity === "Secret"
          ? 1 + pity * 0.06
          : 1),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.adjustedWeight, 0);
  let ticket = Math.random() * total;

  for (const entry of weighted) {
    ticket -= entry.adjustedWeight;
    if (ticket <= 0) return entry.oddling;
  }

  return oddlings[0];
}

function oddlingChanceAtLuck(oddling: Oddling, luck: number, pity = 0, bossRoll = false) {
  if (luck >= 2) {
    if (oddling.rarity !== "Secret" && oddling.rarity !== "OG") return 0;
    const isHighTier = oddling.rarity === "OG" || oddling.income >= 15_000_000;
    const pool = oddlings.filter((entry) =>
      isHighTier
        ? (entry.rarity === "Secret" && entry.income >= 15_000_000) || entry.rarity === "OG"
        : entry.rarity === "Secret" && entry.income <= 5_000_000,
    );
    const weights: Record<string, number> = {
      "midnight-mole": 62, "silver-slime": 23, "obsidian-owl": 9,
      "phantom-fox": 4, "eclipse-golem": 2, "night-seraph": 55,
      "shadow-sphinx": 25, "chrome-phantom": 12, "void-emperor": 6,
      "star-eater": 2,
      "heavenly-dragon": 0.04,
    };
    const tierChance = bossRoll
      ? 1
      : luck >= 50
        ? Math.min(0.55 + pity * 0.002, 0.7)
        : Math.min(0.01 * (luck / 2) + pity * 0.002, 0.2);
    const poolChance = isHighTier ? tierChance : 1 - tierChance;
    const totalWeight = pool.reduce((sum, entry) => sum + weights[entry.id], 0);
    return poolChance * weights[oddling.id] / totalWeight;
  }

  const adjustedWeight = (entry: Oddling) => entry.weight *
    (entry.rarity === "OG"
      ? 1 + pity * 0.12
      : entry.rarity === "Secret"
        ? 1 + pity * 0.06
        : 1);
  const totalWeight = oddlings.reduce((sum, entry) => sum + adjustedWeight(entry), 0);
  return adjustedWeight(oddling) / totalWeight;
}

function calculateRollOdds(
  oddling: Oddling,
  mutation: Mutation,
  luckChance: number,
  mutationLevel: number,
  pity = 0,
  mutationBonus = 0,
  guaranteedMutation = false,
  goldenHour = false,
  bossRoll = false,
  forcedLuck = 0,
) {
  let characterChance = 0;

  if (forcedLuck > 0) {
    characterChance = oddlingChanceAtLuck(oddling, forcedLuck, pity, bossRoll);
  } else if (bossRoll) {
    characterChance = oddlingChanceAtLuck(oddling, 20, pity, true);
  } else {
    LUCK_LEVELS.forEach((level, index) => {
      const successes = index;
      const isFinalLevel = index === LUCK_LEVELS.length - 1;
      const chainChance = Math.pow(luckChance, successes) *
        (isFinalLevel ? 1 : 1 - luckChance);
      characterChance += chainChance * oddlingChanceAtLuck(oddling, level, pity);
    });
  }

  const mutationChances = getMutationChances(mutationLevel, mutationBonus);
  if (guaranteedMutation) {
    const mutationTotal = mutationChances.gold + mutationChances.diamond + mutationChances.rainbow;
    mutationChances.normal = 0;
    mutationChances.gold /= mutationTotal;
    mutationChances.diamond /= mutationTotal;
    mutationChances.rainbow /= mutationTotal;
  } else if (goldenHour) {
    mutationChances.gold += mutationChances.normal;
    mutationChances.normal = 0;
  }
  const totalChance = characterChance * mutationChances[mutation];
  return Math.max(1, Math.round(1 / totalChance));
}

function formatOdds(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

type FusionOutcome = { oddling: Oddling; chance: number };

function getFusionOdds(inputs: OwnedOddling[]): FusionOutcome[] {
  if (inputs.length !== 4) return [];
  const allSecretOrHigher = inputs.every((entry) => entry.rarity === "Secret" || entry.rarity === "OG");

  if (!allSecretOrHigher) {
    const rarityValue: Record<Rarity, number> = { Legendary: 0, Mythic: 1, Godly: 2, Secret: 3, OG: 4 };
    const averageQuality = inputs.reduce((sum, entry) => sum + rarityValue[entry.rarity], 0) / 4;
    const godlyChance = Math.min(80, 8 + averageQuality * 15);
    const mythicChance = 100 - godlyChance;
    const candidates = [
      oddlings.find((entry) => entry.id === "lava-llama")!,
      oddlings.find((entry) => entry.id === "astro-axolotl")!,
      oddlings.find((entry) => entry.id === "ramen-ronin")!,
      oddlings.find((entry) => entry.id === "disco-kraken")!,
      oddlings.find((entry) => entry.id === "solar-samurai")!,
    ];
    return [
      { oddling: candidates[0], chance: mythicChance * 0.45 },
      { oddling: candidates[1], chance: mythicChance * 0.33 },
      { oddling: candidates[2], chance: mythicChance * 0.22 },
      { oddling: candidates[3], chance: godlyChance * 0.62 },
      { oddling: candidates[4], chance: godlyChance * 0.38 },
    ];
  }

  const mutationQuality: Record<Mutation, number> = { normal: 0, gold: 0.03, diamond: 0.07, rainbow: 0.15 };
  const quality = Math.min(1, inputs.reduce((sum, entry) => {
    const incomeQuality = Math.max(0, Math.log10(entry.income / 5_000_000) / Math.log10(70));
    return sum + Math.min(1, incomeQuality) + mutationQuality[entry.mutation];
  }, 0) / 4);
  const rawWeights = [
    70 * (1 - 0.88 * quality),
    20 * (1 - 0.62 * quality),
    9 * (1 - 0.28 * quality),
    0.8 + 25 * quality,
    0.19 + 12 * quality,
    0.04 + 4 * quality * quality,
    0.01 + 1.5 * quality * quality,
  ];
  const total = rawWeights.reduce((sum, weight) => sum + weight, 0);
  return fusionOddlings.map((oddling, index) => ({
    oddling,
    chance: rawWeights[index] / total * 100,
  }));
}

function pickFusionOutcome(outcomes: FusionOutcome[]) {
  let ticket = randomUnit() * 100;
  for (const outcome of outcomes) {
    ticket -= outcome.chance;
    if (ticket <= 0) return outcome.oddling;
  }
  return outcomes[0].oddling;
}

function restingReel(oddling: Oddling) {
  const index = oddlings.findIndex((entry) => entry.id === oddling.id);
  return [
    oddlings[(index - 1 + oddlings.length) % oddlings.length],
    oddling,
    oddlings[(index + 1) % oddlings.length],
  ];
}

function isLuckToken(entry: ReelEntry): entry is LuckToken {
  return "kind" in entry && entry.kind === "luck";
}

function randomReelEntry(visibleLuckLevel: number): ReelEntry {
  if (Math.random() < 0.14) {
    return luckTokens[visibleLuckLevel];
  }
  return oddlings[Math.floor(Math.random() * oddlings.length)];
}

function restingEntries(entry: ReelEntry, visibleLuckLevel: number): ReelEntry[] {
  return [
    randomReelEntry(visibleLuckLevel),
    entry,
    randomReelEntry(visibleLuckLevel),
  ];
}

function CloverArtwork({ token }: { token: LuckToken }) {
  return (
    <div
      className={styles.cloverArtwork}
      data-count={token.clovers}
      data-theme={token.theme}
      aria-hidden="true"
    >
      {Array.from({ length: token.clovers }, (_, cloverIndex) => (
        <span
          className={styles.clover}
          key={cloverIndex}
          style={
            {
              "--clover-index": cloverIndex,
              "--clover-count": token.clovers,
            } as React.CSSProperties
          }
        >
          <i /><i /><i /><i /><b />
        </span>
      ))}
      <strong>{token.multiplier}×</strong>
    </div>
  );
}

export default function RngMachine() {
  const [gameStarted, setGameStarted] = useState(false);
  const [showRebirth, setShowRebirth] = useState(false);
  const [showFuseMachine, setShowFuseMachine] = useState(false);
  const [fuseSlots, setFuseSlots] = useState<string[]>([]);
  const [isFusing, setIsFusing] = useState(false);
  const [fuseResult, setFuseResult] = useState<Oddling | null>(null);
  const [cash, setCash] = useState(STARTING_CASH);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [isRolling, setIsRolling] = useState(false);
  const [isReelMoving, setIsReelMoving] = useState(false);
  const [displayedOddling, setDisplayedOddling] = useState(oddlings[0]);
  const [reelItems, setReelItems] = useState<ReelEntry[]>(() => restingReel(oddlings[0]));
  const [winningIndex, setWinningIndex] = useState(1);
  const [reelDuration, setReelDuration] = useState(1_800);
  const [reelCycle, setReelCycle] = useState(0);
  const [result, setResult] = useState<RolledOddling | null>(null);
  const [resultDeadline, setResultDeadline] = useState<number | null>(null);
  const [resultSecondsLeft, setResultSecondsLeft] = useState(60);
  const [activeMutation, setActiveMutation] = useState<Mutation>("normal");
  const [mutationIntro, setMutationIntro] = useState<Mutation | null>(null);
  const [upgrades, setUpgrades] = useState<Upgrades>({ luck: 0, speed: 0, mutation: 0 });
  const [rebirths, setRebirths] = useState(0);
  const [characterLevels, setCharacterLevels] = useState<Record<string, number>>({});
  const [pity, setPity] = useState(0);
  const [stats, setStats] = useState<GameStats>({
    totalRolls: 0,
    highestLuck: 1,
    rarestOdds: 0,
    totalEarned: 0,
    mutationsFound: [],
    charactersSold: 0,
  });
  const [claimedQuests, setClaimedQuests] = useState<string[]>([]);
  const [lastDailyClaim, setLastDailyClaim] = useState("");
  const [dailyStreak, setDailyStreak] = useState(0);
  const [mutationGuarantees, setMutationGuarantees] = useState(0);
  const [potions, setPotions] = useState<Record<PotionKind, number>>({ luck: 0, mutation: 0, turbo: 0, double: 0 });
  const [activePotionRolls, setActivePotionRolls] = useState({ luck: 0, mutation: 0, turbo: 0 });
  const [doubleIncomeUntil, setDoubleIncomeUntil] = useState(0);
  const [clockNow, setClockNow] = useState(0);
  const [bossTickets, setBossTickets] = useState(0);
  const [specialEvent, setSpecialEvent] = useState<SpecialEvent>(null);
  const [bonusChoices, setBonusChoices] = useState<RolledOddling[] | null>(null);
  const [showIndex, setShowIndex] = useState(false);
  const [luckFeverUntil, setLuckFeverUntil] = useState(0);
  const [feverPreviewUsed, setFeverPreviewUsed] = useState(false);
  const [luck, setLuck] = useState(1);
  const [message, setMessage] = useState("Machine ready");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const timers = useRef<number[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const musicGain = useRef<GainNode | null>(null);
  const musicTimer = useRef<number | null>(null);
  const musicStep = useRef(0);
  const soundEnabledRef = useRef(true);

  const collection = useMemo<OwnedOddling[]>(
    () =>
      allOddlings.flatMap((oddling) =>
        MUTATIONS.flatMap((mutation) => {
          const count = owned[ownedKey(oddling.id, mutation)] ?? 0;
          return count ? [{ ...oddling, mutation, count }] : [];
        }),
      ),
    [owned],
  );
  const weekendEventActive = clockNow > 0 && [0, 6].includes(new Date(clockNow).getDay());
  const hasTrolliniAbility = MUTATIONS.some((mutation) =>
    (owned[ownedKey("trollini-gamerini", mutation)] ?? 0) > 0);
  const hasSilverSlimeAbility = MUTATIONS.some((mutation) =>
    (owned[ownedKey("silver-slime", mutation)] ?? 0) > 0);
  const hasQuantumAbility = MUTATIONS.some((mutation) =>
    (owned[ownedKey("quantum-capybara", mutation)] ?? 0) > 0);
  const incomeMultiplier =
    (1 + rebirths * 0.25) *
    (weekendEventActive ? 1.1 : 1) *
    (clockNow > 0 && clockNow < doubleIncomeUntil ? 2 : 1);
  const incomePerSecond = useMemo(
    () => collection.reduce(
      (sum, oddling) =>
        sum + mutatedIncome(oddling, oddling.mutation) *
          (1 + ((characterLevels[ownedKey(oddling.id, oddling.mutation)] ?? 1) - 1) * 0.5) *
          oddling.count,
      0,
    ) * incomeMultiplier,
    [characterLevels, collection, incomeMultiplier],
  );
  const ownedTotal = useMemo(
    () => Object.values(owned).reduce((sum, count) => sum + count, 0),
    [owned],
  );
  const maxCharacterSlots = MAX_ACTIVE_ODDLINGS + rebirths;
  const fuseInputs = fuseSlots.map((key) => {
    const [id, mutation = "normal"] = key.split(":") as [string, Mutation];
    const oddling = allOddlings.find((entry) => entry.id === id)!;
    return { ...oddling, mutation, count: 1 };
  });
  const fusionOdds = getFusionOdds(fuseInputs);
  const spinCost = useMemo(
    () => Math.round(getSpinCost(upgrades) * (hasTrolliniAbility ? 0.95 : 1) / 100) * 100,
    [hasTrolliniAbility, upgrades],
  );
  const rebirthRecipe = getRebirthRecipe(rebirths);
  const rebirthCharacters = rebirthRecipe.characters.map((id) =>
    oddlings.find((oddling) => oddling.id === id)!,
  );
  const hasRebirthCharacters = rebirthRecipe.characters.every((id) =>
    MUTATIONS.some((mutation) => (owned[ownedKey(id, mutation)] ?? 0) > 0),
  );
  const canRebirth = cash >= rebirthRecipe.cash && hasRebirthCharacters;
  const luckFeverActive = clockNow > 0 && clockNow < luckFeverUntil;
  const luckFeverSeconds = luckFeverActive
    ? Math.max(0, Math.ceil((luckFeverUntil - clockNow) / 1_000))
    : 0;

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("oddling-machine-save-v3");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as {
            cash?: number;
            owned?: Record<string, number>;
            upgrades?: Partial<Upgrades>;
            rebirths?: number;
            characterLevels?: Record<string, number>;
            pity?: number;
            stats?: GameStats;
            claimedQuests?: string[];
            lastDailyClaim?: string;
            dailyStreak?: number;
            mutationGuarantees?: number;
            potions?: Record<PotionKind, number>;
            activePotionRolls?: { luck: number; mutation: number; turbo: number };
            doubleIncomeUntil?: number;
            bossTickets?: number;
            savedAt?: number;
            incomePerSecond?: number;
            luckFeverUntil?: number;
            feverPreviewUsed?: boolean;
          };
          if (typeof parsed.cash === "number") setCash(parsed.cash);
          if (parsed.owned) {
            const migratedOwned = Object.fromEntries(
              Object.entries(parsed.owned).map(([key, count]) => [
                key.includes(":") ? key : ownedKey(key, "normal"),
                count,
              ]),
            );
            setOwned(migratedOwned);
          }
          if (parsed.upgrades) {
            setUpgrades({
              luck: parsed.upgrades.luck ?? 0,
              speed: parsed.upgrades.speed ?? 0,
              mutation: parsed.upgrades.mutation ?? 0,
            });
          }
          if (typeof parsed.rebirths === "number") setRebirths(parsed.rebirths);
          if (parsed.characterLevels) setCharacterLevels(parsed.characterLevels);
          if (typeof parsed.pity === "number") setPity(parsed.pity);
          if (parsed.stats) setStats(parsed.stats);
          if (parsed.claimedQuests) setClaimedQuests(parsed.claimedQuests);
          if (parsed.lastDailyClaim) setLastDailyClaim(parsed.lastDailyClaim);
          if (typeof parsed.dailyStreak === "number") setDailyStreak(parsed.dailyStreak);
          if (typeof parsed.mutationGuarantees === "number") setMutationGuarantees(parsed.mutationGuarantees);
          if (parsed.potions) setPotions(parsed.potions);
          if (parsed.activePotionRolls) setActivePotionRolls(parsed.activePotionRolls);
          if (typeof parsed.doubleIncomeUntil === "number") setDoubleIncomeUntil(parsed.doubleIncomeUntil);
          if (typeof parsed.bossTickets === "number") setBossTickets(parsed.bossTickets);
          if (typeof parsed.luckFeverUntil === "number") setLuckFeverUntil(parsed.luckFeverUntil);
          if (typeof parsed.feverPreviewUsed === "boolean") setFeverPreviewUsed(parsed.feverPreviewUsed);
          if (parsed.savedAt && parsed.incomePerSecond && typeof parsed.cash === "number") {
            const awaySeconds = Math.min(28_800, Math.max(0, (Date.now() - parsed.savedAt) / 1_000));
            const offlineCash = Math.floor(awaySeconds * parsed.incomePerSecond * 0.5);
            if (offlineCash > 0) {
              setCash(parsed.cash + offlineCash);
              setStats((current) => ({ ...current, totalEarned: current.totalEarned + offlineCash }));
              setMessage(`Welcome back — $${formatCash(offlineCash)} offline income collected`);
            }
          }
        } catch {
          window.localStorage.removeItem("oddling-machine-save-v3");
        }
      }
      setHasLoaded(true);
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    window.localStorage.setItem(
      "oddling-machine-save-v3",
      JSON.stringify({
        cash, owned, upgrades, rebirths, characterLevels, pity, stats,
        claimedQuests, lastDailyClaim, dailyStreak, mutationGuarantees,
        potions, activePotionRolls, doubleIncomeUntil, bossTickets,
        luckFeverUntil, feverPreviewUsed,
        savedAt: Date.now(), incomePerSecond,
      }),
    );
  }, [activePotionRolls, bossTickets, cash, characterLevels, claimedQuests,
    dailyStreak, doubleIncomeUntil, hasLoaded, incomePerSecond, lastDailyClaim,
    feverPreviewUsed, luckFeverUntil, mutationGuarantees, owned, pity, potions,
    rebirths, stats, upgrades]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const incomeTimer = window.setInterval(() => {
      if (incomePerSecond > 0) {
        setCash((current) => current + incomePerSecond);
        setStats((current) => ({ ...current, totalEarned: current.totalEarned + incomePerSecond }));
      }
    }, 1_000);
    return () => window.clearInterval(incomeTimer);
  }, [incomePerSecond]);

  useEffect(() => {
    if (!result || !resultDeadline) return;

    const updateCountdown = () => {
      const secondsLeft = Math.max(
        0,
        Math.ceil((resultDeadline - Date.now()) / 1_000),
      );
      setResultSecondsLeft(secondsLeft);

      if (secondsLeft === 0) {
        setResult(null);
        setBonusChoices(null);
        setSpecialEvent(null);
        setResultDeadline(null);
        setActiveMutation("normal");
        setLuck(1);
        setMessage("Roll expired — machine ready");
      }
    };

    updateCountdown();
    const countdownTimer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(countdownTimer);
  }, [result, resultDeadline]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      if (musicTimer.current !== null) window.clearInterval(musicTimer.current);
      void audioContext.current?.close();
    },
    [],
  );

  function startAudioEngine() {
    let context = audioContext.current;

    if (!context) {
      context = new AudioContext();
      audioContext.current = context;

      const master = context.createGain();
      const filter = context.createBiquadFilter();
      master.gain.value = 0.065;
      filter.type = "lowpass";
      filter.frequency.value = 2_600;
      filter.Q.value = 0.55;
      master.connect(filter);
      filter.connect(context.destination);
      musicGain.current = master;
    }

    if (context.state === "suspended") void context.resume();
    startMusicLoop();
    return context;
  }

  function startMusicLoop() {
    if (musicTimer.current !== null || !soundEnabledRef.current) return;

    const melody = [
      659.25, 783.99, 880, 783.99,
      659.25, 523.25, 587.33, 659.25,
      698.46, 880, 1_046.5, 880,
      698.46, 587.33, 659.25, 783.99,
    ];
    const bass = [261.63, 220, 174.61, 196];

    const playBeat = () => {
      const context = audioContext.current;
      const master = musicGain.current;
      if (!context || !master || context.state !== "running") return;

      const step = musicStep.current;
      const now = context.currentTime;
      const note = context.createOscillator();
      const noteGain = context.createGain();
      note.type = step % 4 === 2 ? "sine" : "triangle";
      note.frequency.value = melody[step % melody.length];
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      note.connect(noteGain);
      noteGain.connect(master);
      note.start(now);
      note.stop(now + 0.24);

      if (step % 4 === 0) {
        const bassNote = context.createOscillator();
        const bassGain = context.createGain();
        bassNote.type = "sine";
        bassNote.frequency.value = bass[(step / 4) % bass.length];
        bassGain.gain.setValueAtTime(0.12, now);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        bassNote.connect(bassGain);
        bassGain.connect(master);
        bassNote.start(now);
        bassNote.stop(now + 0.44);
      }

      musicStep.current = (step + 1) % melody.length;
    };

    playBeat();
    musicTimer.current = window.setInterval(playBeat, 280);
  }

  function stopMusicLoop() {
    if (musicTimer.current !== null) {
      window.clearInterval(musicTimer.current);
      musicTimer.current = null;
    }
  }

  function playTone(
    frequency: number,
    duration = 0.08,
    volume = 0.035,
    type: OscillatorType = "triangle",
    delay = 0,
  ) {
    if (!soundEnabledRef.current) return;
    const context = startAudioEngine();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime + delay;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }

  function playRollTicks(duration: number) {
    const tickCount = 22;

    for (let index = 1; index <= tickCount; index += 1) {
      const progress = index / tickCount;
      const delay = duration * Math.pow(progress, 1.7);
      timers.current.push(
        window.setTimeout(() => {
          playTone(470 - progress * 120, 0.035, 0.011, "triangle");
        }, delay),
      );
    }
  }

  function playBoostSound(multiplier: number) {
    const base = 440 + multiplier * 8;
    playTone(base, 0.2, 0.055, "sine");
    playTone(base * 1.25, 0.28, 0.045, "sine", 0.08);
    playTone(base * 1.5, 0.36, 0.04, "sine", 0.16);
  }

  function playRevealSound(rarity: Rarity) {
    const base = 220 + rarityRank[rarity] * 55;
    playTone(base, 0.22, 0.05, "triangle");
    playTone(base * 1.5, 0.34, 0.045, "triangle", 0.1);
    playTone(base * 2, 0.48, 0.04, "sine", 0.2);
  }

  function playMutationSound(mutation: Mutation) {
    if (mutation === "gold") {
      playTone(523, 0.22, 0.05, "triangle");
      playTone(784, 0.36, 0.045, "triangle", 0.12);
    } else if (mutation === "diamond") {
      playTone(740, 0.2, 0.05, "sine");
      playTone(1_109, 0.4, 0.04, "sine", 0.12);
    } else if (mutation === "rainbow") {
      [523, 659, 784, 1_047].forEach((pitch, index) =>
        playTone(pitch, 0.3, 0.045, "sine", index * 0.08),
      );
    }
  }

  function playCharacterPerformance(oddling: Oddling) {
    const performance = characterPerformances[oddling.id];
    if (!performance) return;

    performance.pitches.forEach((pitch, index) => {
      playTone(pitch, 0.16 + index * 0.04, 0.032, performance.wave, index * 0.09);
    });
  }

  function toggleSound() {
    if (soundEnabled) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      stopMusicLoop();
      void audioContext.current?.suspend();
    } else {
      soundEnabledRef.current = true;
      setSoundEnabled(true);
      void startAudioEngine().resume();
    }
  }

  function startLuckFever(preview = false) {
    const endsAt = currentTimestamp() + 30_000;
    setLuckFeverUntil(endsAt);
    if (preview) setFeverPreviewUsed(true);
    setMessage("MEME STORM! 50× luck active for 30 seconds!");
    [392, 523, 659, 784, 1_047].forEach((pitch, index) =>
      playTone(pitch, 0.5, 0.045, "triangle", index * 0.08),
    );
  }

  function roll(bossRoll = false) {
    const rollPrice = bossRoll ? spinCost * 25 : spinCost;
    if (isRolling || result || cash < rollPrice || (bossRoll && bossTickets < 1)) return;

    if (soundEnabledRef.current) startAudioEngine();
    setCash((current) => current - rollPrice);
    if (bossRoll) setBossTickets((current) => current - 1);
    setIsRolling(true);
    setLuck(1);
    setMessage("Scanning the Memeverse…");

    const feverTriggered = !luckFeverActive && randomUnit() < 1 / 750;
    const feverForThisRoll = luckFeverActive || feverTriggered;
    if (feverTriggered) startLuckFever();

    const eventTicket = bossRoll ? 1 : randomUnit();
    const rollSpecial: SpecialEvent = eventTicket < 0.03
      ? "meteor"
      : eventTicket < 0.06
        ? "glitch"
        : eventTicket < 0.09
          ? "golden"
          : eventTicket < 0.12
            ? "double"
            : null;
    setSpecialEvent(rollSpecial);
    setBonusChoices(null);
    const mutationBonus =
      (activePotionRolls.mutation > 0 ? 0.15 : 0) +
      (hasSilverSlimeAbility ? 0.02 : 0) +
      (rollSpecial === "glitch" ? 0.25 : 0);
    let rollMutation = pickMutation(
      upgrades.mutation,
      mutationBonus,
      mutationGuarantees > 0,
    );
    if (rollSpecial === "golden" && rollMutation === "normal") rollMutation = "gold";
    if (mutationGuarantees > 0) setMutationGuarantees((current) => current - 1);
    const luckChance = Math.min(
      0.45,
      getLuckChance(upgrades, rebirths) +
      (activePotionRolls.luck > 0 ? 0.05 : 0) +
      (hasQuantumAbility ? 0.02 : 0) +
      (weekendEventActive ? 0.01 : 0),
    );
    const chain = bossRoll ? [1, 20] : feverForThisRoll ? [1, 50] : buildLuckChain(luckChance);
    const finalLuck = chain.at(-1) ?? 1;
    const winner = pickOddling(finalLuck, pity, bossRoll);
    const winnerPosition = 22;
    const phases: ReelEntry[] = [
      ...chain.slice(1).map((boost) => luckTokens[boost]),
      winner,
    ];
    let phaseStart = rollMutation === "normal" ? 0 : 1_150;

    setActiveMutation(rollMutation);
    if (rollMutation !== "normal") {
      setMutationIntro(rollMutation);
      setMessage(`${rollMutation} mutation detected`);
      playMutationSound(rollMutation);
      timers.current.push(
        window.setTimeout(() => setMutationIntro(null), 1_000),
      );
    }

    phases.forEach((phaseWinner, phaseIndex) => {
      const baseDuration = isLuckToken(phaseWinner) ? 2_800 : 3_400;
      const phaseDuration = Math.round(
        baseDuration * Math.pow(0.92, upgrades.speed) *
        (activePotionRolls.turbo > 0 ? 0.8 : 1),
      );
      const visibleLuckLevel = isLuckToken(phaseWinner)
        ? phaseWinner.multiplier
        : finalLuck === 50
          ? 50
          : LUCK_LEVELS[Math.min(phaseIndex + 1, LUCK_LEVELS.length - 1)];
      const spinningItems = Array.from({ length: 26 }, (_, index) =>
        index === winnerPosition
          ? phaseWinner
          : randomReelEntry(visibleLuckLevel),
      );

      timers.current.push(
        window.setTimeout(() => {
          setMessage(phaseIndex === 0 ? "Spinning the Memeverse…" : "Bonus reel spinning…");
          setReelItems(spinningItems);
          setWinningIndex(winnerPosition);
          setReelDuration(phaseDuration);
          setIsReelMoving(true);
          setReelCycle((current) => current + 1);
          playRollTicks(phaseDuration);
        }, phaseStart),
      );

      timers.current.push(
        window.setTimeout(() => {
          setIsReelMoving(false);
          setReelItems(restingEntries(phaseWinner, visibleLuckLevel));
          setWinningIndex(1);

          if (isLuckToken(phaseWinner)) {
            playBoostSound(phaseWinner.multiplier);
            setLuck(phaseWinner.multiplier);
            setMessage(`${phaseWinner.multiplier}× LUCK — SPIN AGAIN!`);
          } else {
            playRevealSound(phaseWinner.rarity);
            playCharacterPerformance(phaseWinner);
            setDisplayedOddling(phaseWinner);
            const rolledResult: RolledOddling = {
              ...phaseWinner,
              mutation: rollMutation,
              oddsOneIn: calculateRollOdds(
                phaseWinner,
                rollMutation,
                luckChance,
                upgrades.mutation,
                pity,
                mutationBonus,
                mutationGuarantees > 0,
                rollSpecial === "golden",
                bossRoll,
                feverForThisRoll ? 50 : 0,
              ),
            };
            setResult(rolledResult);
            if (rollSpecial === "meteor") {
              const choices = [rolledResult, ...Array.from({ length: 2 }, () => {
                const choice = pickOddling(finalLuck, pity, bossRoll);
                const choiceMutation = pickMutation(upgrades.mutation, mutationBonus);
                return {
                  ...choice,
                  mutation: choiceMutation,
                  oddsOneIn: calculateRollOdds(
                    choice, choiceMutation, luckChance, upgrades.mutation,
                    pity, mutationBonus, false, false, bossRoll,
                    feverForThisRoll ? 50 : 0,
                  ),
                };
              })];
              setBonusChoices(choices);
            }
            setResultSecondsLeft(60);
            setResultDeadline(Date.now() + 60_000);
            setIsRolling(false);
            setPity(phaseWinner.rarity === "Secret" || phaseWinner.rarity === "OG"
              ? 0
              : (current) => Math.min(PITY_MAX, current + 1));
            setStats((current) => ({
              ...current,
              totalRolls: current.totalRolls + 1,
              highestLuck: Math.max(current.highestLuck, finalLuck),
              rarestOdds: Math.max(current.rarestOdds, rolledResult.oddsOneIn),
              mutationsFound: rollMutation === "normal" || current.mutationsFound.includes(rollMutation)
                ? current.mutationsFound
                : [...current.mutationsFound, rollMutation],
            }));
            setMessage(rollSpecial
              ? `${rollSpecial.toUpperCase()} EVENT — ${phaseWinner.rarity} discovered`
              : `${phaseWinner.rarity} discovered`);
          }
        }, phaseStart + phaseDuration),
      );

      phaseStart += phaseDuration + 520;
    });

    setActivePotionRolls((current) => ({
      luck: Math.max(0, current.luck - 1),
      mutation: Math.max(0, current.mutation - 1),
      turbo: Math.max(0, current.turbo - 1),
    }));
  }

  function collectResult() {
    if (!result) return;
    const quantity = specialEvent === "double" ? 2 : 1;
    const totalPrice = result.price * quantity;
    if (ownedTotal + quantity > maxCharacterSlots) {
      setMessage(`All ${maxCharacterSlots} slots are full — sell a meme to make space`);
      return;
    }
    if (cash < totalPrice) {
      setMessage(`You need $${formatCash(totalPrice - cash)} more`);
      return;
    }

    setCash((current) => current - totalPrice);
    setOwned((current) => ({
      ...current,
      [ownedKey(result.id, result.mutation)]:
        (current[ownedKey(result.id, result.mutation)] ?? 0) + quantity,
    }));
    playTone(740, 0.18, 0.05, "sine");
    playTone(980, 0.3, 0.045, "sine", 0.1);
    setMessage(`${result.name} joined your collection!`);
    setResult(null);
    setBonusChoices(null);
    setSpecialEvent(null);
    setResultDeadline(null);
    setIsReelMoving(false);
    setActiveMutation("normal");
    setLuck(1);
  }

  function sellOddling(oddling: OwnedOddling) {
    const sellPrice = Math.floor(oddling.price / 2);

    setOwned((current) => {
      const next = { ...current };
      const key = ownedKey(oddling.id, oddling.mutation);
      const nextCount = (next[key] ?? 0) - 1;

      if (nextCount > 0) next[key] = nextCount;
      else delete next[key];

      return next;
    });
    setCash((current) => current + sellPrice);
    setStats((current) => ({ ...current, charactersSold: current.charactersSold + 1 }));
    playTone(520, 0.12, 0.045, "triangle");
    playTone(360, 0.22, 0.04, "triangle", 0.08);
    setMessage(`${oddling.name} sold for $${formatCash(sellPrice)}`);
  }

  function discardResult() {
    playTone(190, 0.18, 0.035, "triangle");
    setMessage("Result released — ready to roll again");
    setResult(null);
    setBonusChoices(null);
    setSpecialEvent(null);
    setResultDeadline(null);
    setActiveMutation("normal");
    setLuck(1);
  }

  function buyUpgrade(branch: UpgradeBranch) {
    const level = upgrades[branch];
    if (level >= MAX_UPGRADE_LEVEL) return;
    const price = upgradeCosts[branch][level];

    if (cash < price) {
      setMessage(`You need $${formatCash(price - cash)} more for that upgrade`);
      return;
    }

    setCash((current) => current - price);
    setUpgrades((current) => ({ ...current, [branch]: current[branch] + 1 }));
    playTone(494, 0.18, 0.05, "triangle");
    playTone(740, 0.32, 0.045, "sine", 0.1);
    setMessage(`${branch} upgrade installed`);
  }

  function combineOddling(oddling: OwnedOddling) {
    const key = ownedKey(oddling.id, oddling.mutation);
    if ((owned[key] ?? 0) < 3) return;
    setOwned((current) => ({ ...current, [key]: current[key] - 2 }));
    setCharacterLevels((current) => ({ ...current, [key]: (current[key] ?? 1) + 1 }));
    playTone(659, 0.2, 0.05, "triangle");
    playTone(988, 0.42, 0.045, "sine", 0.12);
    setMessage(`${oddling.name} combined — level ${(characterLevels[key] ?? 1) + 1}!`);
  }

  function buyPotion(kind: PotionKind) {
    const potion = potionShop[kind];
    if (cash < potion.price) {
      setMessage(`You need $${formatCash(potion.price - cash)} more`);
      return;
    }
    setCash((current) => current - potion.price);
    setPotions((current) => ({ ...current, [kind]: current[kind] + 1 }));
    setMessage(`${potion.name} added to your bag`);
  }

  function activatePotion(kind: PotionKind) {
    if (potions[kind] < 1) return;
    setPotions((current) => ({ ...current, [kind]: current[kind] - 1 }));
    if (kind === "double") {
      setDoubleIncomeUntil(Date.now() + 300_000);
    } else {
      setActivePotionRolls((current) => ({ ...current, [kind]: current[kind] + 5 }));
    }
    setMessage(`${potionShop[kind].name} activated!`);
  }

  function claimDailyReward() {
    const today = todayKey();
    if (lastDailyClaim === today) return;
    const nextDay = dailyStreak >= 7 ? 1 : dailyStreak + 1;
    const reward = nextDay * 50_000;
    setCash((current) => current + reward);
    setDailyStreak(nextDay);
    setLastDailyClaim(today);
    if (nextDay === 7) setMutationGuarantees((current) => current + 1);
    setMessage(`Day ${nextDay} reward: $${formatCash(reward)}${nextDay === 7 ? " + guaranteed mutation" : ""}`);
  }

  function claimQuest(id: string, reward: number, bossTicket = false) {
    if (claimedQuests.includes(id)) return;
    setClaimedQuests((current) => [...current, id]);
    setCash((current) => current + reward);
    if (bossTicket) setBossTickets((current) => current + 1);
    setMessage(`Quest complete — $${formatCash(reward)}${bossTicket ? " and a Boss Ticket" : ""}`);
  }

  function chooseMeteorResult(choice: RolledOddling) {
    setResult(choice);
    setDisplayedOddling(choice);
    setStats((current) => ({
      ...current,
      rarestOdds: Math.max(current.rarestOdds, choice.oddsOneIn),
      mutationsFound: choice.mutation === "normal" || current.mutationsFound.includes(choice.mutation)
        ? current.mutationsFound
        : [...current.mutationsFound, choice.mutation],
    }));
    setMessage(`Meteor choice locked: ${choice.name}`);
  }

  function addFuseMaterial(key: string) {
    if (isFusing || fuseSlots.length >= 4) return;
    const alreadySelected = fuseSlots.filter((slot) => slot === key).length;
    if (alreadySelected >= (owned[key] ?? 0)) return;
    setFuseResult(null);
    setFuseSlots((current) => [...current, key]);
    playTone(330 + fuseSlots.length * 70, 0.12, 0.025, "triangle");
  }

  function removeFuseMaterial(index: number) {
    if (isFusing) return;
    setFuseResult(null);
    setFuseSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  }

  function runFusion() {
    if (isFusing || fusionOdds.length === 0) return;
    const selectionIsOwned = Object.entries(
      fuseSlots.reduce<Record<string, number>>((counts, key) => ({
        ...counts,
        [key]: (counts[key] ?? 0) + 1,
      }), {}),
    ).every(([key, count]) => (owned[key] ?? 0) >= count);
    if (!selectionIsOwned) {
      setFuseSlots([]);
      setMessage("Fusion materials changed — please reload the four slots");
      return;
    }
    if (!window.confirm("Fuse these four memes? They will be permanently consumed.")) return;
    setIsFusing(true);
    setFuseResult(null);
    playTone(180, 1.8, 0.035, "sawtooth");
    playTone(270, 1.6, 0.03, "triangle", 0.25);
    timers.current.push(window.setTimeout(() => {
      const winner = pickFusionOutcome(fusionOdds);
      const consumedCounts = fuseSlots.reduce<Record<string, number>>((counts, key) => ({
        ...counts,
        [key]: (counts[key] ?? 0) + 1,
      }), {});
      setOwned((current) => {
        const next = { ...current };
        Object.entries(consumedCounts).forEach(([key, count]) => {
          const remaining = (next[key] ?? 0) - count;
          if (remaining > 0) next[key] = remaining;
          else delete next[key];
        });
        const winnerKey = ownedKey(winner.id, "normal");
        next[winnerKey] = (next[winnerKey] ?? 0) + 1;
        return next;
      });
      setCharacterLevels((current) => {
        const next = { ...current };
        Object.entries(consumedCounts).forEach(([key, count]) => {
          if ((owned[key] ?? 0) <= count) delete next[key];
        });
        return next;
      });
      setFuseResult(winner);
      setFuseSlots([]);
      setIsFusing(false);
      playRevealSound(winner.rarity);
      setMessage(`Fusion complete — ${winner.name} created!`);
    }, 2_200));
  }

  function enterFuseMachine() {
    if (soundEnabledRef.current) startAudioEngine();
    setShowRebirth(false);
    setShowFuseMachine(true);
    setGameStarted(true);
  }

  function enterGame() {
    if (soundEnabledRef.current) startAudioEngine();
    if (!feverPreviewUsed) startLuckFever(true);
    setShowRebirth(false);
    setShowFuseMachine(false);
    setFuseSlots([]);
    setFuseResult(null);
    setGameStarted(true);
  }

  function performRebirth() {
    if (!canRebirth) return;
    const confirmed = window.confirm(
      `Rebirth ${rebirths + 1} will trade all cash, memes and machine upgrades. Continue?`,
    );
    if (!confirmed) return;

    setCash(STARTING_CASH);
    setOwned({});
    setUpgrades({ luck: 0, speed: 0, mutation: 0 });
    setCharacterLevels({});
    setPity(0);
    setFuseSlots([]);
    setFuseResult(null);
    setResult(null);
    setResultDeadline(null);
    setActiveMutation("normal");
    setMutationIntro(null);
    setLuck(1);
    setRebirths((current) => current + 1);
    setShowRebirth(false);
    setMessage("Rebirth complete — permanent power increased!");
    playTone(523, 0.25, 0.06, "triangle");
    playTone(784, 0.4, 0.055, "triangle", 0.12);
    playTone(1_047, 0.6, 0.05, "sine", 0.25);
  }

  function resetSave() {
    if (!window.confirm("Reset all cash, collected memes, upgrades and rebirths?")) return;
    setCash(STARTING_CASH);
    setOwned({});
    setUpgrades({ luck: 0, speed: 0, mutation: 0 });
    setRebirths(0);
    setCharacterLevels({});
    setPity(0);
    setFuseSlots([]);
    setFuseResult(null);
    setStats({ totalRolls: 0, highestLuck: 1, rarestOdds: 0, totalEarned: 0, mutationsFound: [], charactersSold: 0 });
    setClaimedQuests([]);
    setLastDailyClaim("");
    setDailyStreak(0);
    setMutationGuarantees(0);
    setPotions({ luck: 0, mutation: 0, turbo: 0, double: 0 });
    setActivePotionRolls({ luck: 0, mutation: 0, turbo: 0 });
    setDoubleIncomeUntil(0);
    setBossTickets(0);
    setLuckFeverUntil(0);
    setFeverPreviewUsed(false);
    setResult(null);
    setResultDeadline(null);
    setActiveMutation("normal");
    setMutationIntro(null);
    setLuck(1);
    setMessage("Fresh machine ready");
  }

  const mythicsOwned = collection.filter((oddling) => oddling.rarity === "Mythic")
    .reduce((total, oddling) => total + oddling.count, 0);
  const quests = [
    { id: "roll-20", name: "Spin Cycle", detail: "Complete 20 rolls", progress: stats.totalRolls, target: 20, reward: 100_000, boss: false },
    { id: "mythic-2", name: "Myth Makers", detail: "Own 2 Mythics", progress: mythicsOwned, target: 2, reward: 250_000, boss: false },
    { id: "luck-6", name: "Clover Climber", detail: "Reach 6× luck", progress: stats.highestLuck, target: 6, reward: 500_000, boss: true },
    { id: "earn-1m", name: "Meme Millionaire", detail: "Earn $1m passively", progress: stats.totalEarned, target: 1_000_000, reward: 1_000_000, boss: true },
  ];
  const achievements = [
    { name: "Beginner's Luck", unlocked: stats.highestLuck >= 4, detail: "Reached 4× luck" },
    { name: "Over the Rainbow", unlocked: stats.mutationsFound.includes("rainbow"), detail: "Found a Rainbow mutation" },
    { name: "Against All Odds", unlocked: MUTATIONS.some((mutation) => (owned[ownedKey("heavenly-dragon", mutation)] ?? 0) > 0), detail: "Own Funky Ehh" },
    { name: "Meme Millionaire", unlocked: stats.totalEarned >= 1_000_000_000, detail: "Earned $1 billion" },
  ];
  const currentDayKey = clockNow > 0 ? new Date(clockNow).toISOString().slice(0, 10) : "";

  return (
    <main
      className={styles.page}
      data-rebirth-tier={Math.min(rebirths, 5)}
      data-weekend-event={weekendEventActive}
      data-luck-fever={luckFeverActive}
    >
      <aside className={styles.rotatePrompt} aria-label="Landscape mode required">
        <span aria-hidden="true">↻</span>
        <strong>Rotate your phone</strong>
        <p>Meme RNG is built to play in landscape.</p>
      </aside>
      <div className={styles.skySprites} aria-hidden="true">
        <i>✦</i><i>◆</i><i>✧</i><i>●</i><i>★</i><i>◇</i><i>✦</i><i>●</i>
      </div>
      {luckFeverActive && (
        <div className={styles.luckFeverBanner}>
          <span>⚡ Meme Storm</span>
          <strong>50× LUCK</strong>
          <b>{luckFeverSeconds}s</b>
        </div>
      )}
      {!gameStarted && (
        <section className={styles.introScreen} aria-label="Meme RNG start screen">
          <div className={styles.introCard}>
            <p className={styles.introEyebrow}>Enter the Memeverse</p>
            <h1 className={styles.introTitle} aria-label="Meme RNG">
              {"Meme RNG".split("").map((letter, index) => (
                <span
                  aria-hidden="true"
                  key={`${letter}-${index}`}
                  style={{ "--letter": index } as React.CSSProperties}
                >
                  {letter === " " ? "\u00A0" : letter}
                </span>
              ))}
            </h1>
            <p className={styles.introTagline}>Roll memes. Get rich. Rule the Memeverse.</p>

            <div className={styles.rebirthSummary}>
              <span>Rebirth {rebirths}</span>
              <strong>{1 + rebirths * 0.25}× income</strong>
              <strong>+{(rebirths * 0.5).toFixed(1)}% luck</strong>
              <strong>{maxCharacterSlots} slots</strong>
            </div>

            <div className={styles.introButtons}>
              <button className={styles.playButton} onClick={enterGame}>Play</button>
              <button className={styles.fuseHomeButton} onClick={enterFuseMachine}>
                Fuse Machine
                <small>Combine four memes</small>
              </button>
              <button className={styles.rebirthButton} onClick={() => setShowRebirth((open) => !open)}>
                Rebirth
                <small>{canRebirth ? "Ready!" : `Level ${rebirths + 1}`}</small>
              </button>
            </div>

            {showRebirth && (
              <div className={styles.rebirthPanel}>
                <div>
                  <p>Next rebirth</p>
                  <strong>Permanent +25% income and +0.5% luck</strong>
                </div>
                <div className={styles.rebirthRequirements}>
                  {rebirthCharacters.map((oddling) => {
                    const hasCharacter = MUTATIONS.some(
                      (mutation) => (owned[ownedKey(oddling.id, mutation)] ?? 0) > 0,
                    );
                    return (
                      <div key={oddling.id} data-complete={hasCharacter}>
                        <Image src={oddling.image} alt="" width={76} height={76} />
                        <span>{hasCharacter ? "✓" : "○"} {oddling.name}</span>
                      </div>
                    );
                  })}
                  <div className={styles.cashRequirement} data-complete={cash >= rebirthRecipe.cash}>
                    <strong>{cash >= rebirthRecipe.cash ? "✓" : "○"} ${formatCash(rebirthRecipe.cash)}</strong>
                    <span>Cash required</span>
                  </div>
                </div>
                <p className={styles.rebirthWarning}>Trades all cash, memes and upgrades. You restart with $60,000.</p>
                <button disabled={!canRebirth} onClick={performRebirth}>
                  {canRebirth ? `Rebirth to level ${rebirths + 1}` : "Requirements not met"}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
      {gameStarted && showFuseMachine && (
        <section className={styles.fuseScreen} aria-label="Fuse Machine">
          <header className={styles.fuseHeader}>
            <div><p className={styles.eyebrow}>Meme Laboratory</p><h1>Fuse Machine</h1></div>
            <div><span>{ownedTotal}/{maxCharacterSlots} stored</span><button onClick={() => { setFuseSlots([]); setFuseResult(null); setShowFuseMachine(false); setGameStarted(false); }}>↩ Home</button></div>
          </header>

          <div className={styles.fuseLayout}>
            <div className={styles.fuseMachineShell} data-active={isFusing}>
              <div className={styles.fuseMachineTop}><i /> Molecular recombiner <span>FM–04</span></div>
              <div className={styles.fuseChamber}>
                <div className={styles.fuseSlots}>
                  {Array.from({ length: 4 }, (_, index) => {
                    const input = fuseInputs[index];
                    return (
                      <button key={index} data-filled={!!input} data-mutation={input?.mutation} onClick={() => input && removeFuseMaterial(index)}>
                        {input ? <><Image src={input.image} alt={input.name} width={120} height={120} /><strong>{input.name}</strong><small>{input.mutation} · {input.rarity}</small></> : <><b>+</b><span>Material {index + 1}</span></>}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.fusionCore} data-active={isFusing}><i /><i /><i /><strong>{isFusing ? "FUSING" : `${fuseSlots.length}/4`}</strong></div>
                {fuseResult ? (
                  <div className={styles.fuseReveal} data-rarity={fuseResult.rarity}>
                    <Image src={fuseResult.image} alt={fuseResult.name} width={240} height={240} />
                    <div><span>Fusion created</span><h2>{fuseResult.name}</h2><strong>{fuseResult.rarity} · ${formatCash(fuseResult.income)}/sec</strong><small>Added directly to character storage</small></div>
                  </div>
                ) : (
                  <div className={styles.fusePrompt}><strong>{fuseSlots.length === 4 ? "Fusion ready" : "Load four characters"}</strong><span>Click a loaded slot to remove it</span></div>
                )}
              </div>
              <button className={styles.fuseAction} disabled={fuseSlots.length !== 4 || isFusing} onClick={runFusion}>
                {isFusing ? "Recombining…" : "Fuse four characters"}
              </button>
            </div>

            <aside className={styles.fuseOddsPanel}>
              <div><p className={styles.eyebrow}>Live calculation</p><h2>Fusion odds</h2></div>
              {fusionOdds.length ? (
                <div className={styles.fusionOddsList}>
                  {fusionOdds.map((outcome) => (
                    <div key={outcome.oddling.id} data-rarity={outcome.oddling.rarity}>
                      <Image src={outcome.oddling.image} alt="" width={58} height={58} />
                      <span><strong>{outcome.oddling.name}</strong><small>{outcome.oddling.rarity} · ${formatCash(outcome.oddling.income)}/sec</small></span>
                      <b>{outcome.chance >= 1 ? outcome.chance.toFixed(1) : outcome.chance.toFixed(2)}%<small>1 in {formatOdds(Math.round(100 / outcome.chance))}</small></b>
                    </div>
                  ))}
                </div>
              ) : <p className={styles.fuseHelp}>Add four materials to see the exact odds. Four Secret-or-higher materials unlock the seven fusion-exclusive characters. Other recipes are capped at Mythic and Godly.</p>}
            </aside>
          </div>

          <section className={styles.fuseStorage}>
            <header><div><p className={styles.eyebrow}>Your storage</p><h2>Choose materials</h2></div><span>Better inputs improve the output</span></header>
            {collection.length ? <div>
              {collection.map((oddling) => {
                const key = ownedKey(oddling.id, oddling.mutation);
                const selected = fuseSlots.filter((slot) => slot === key).length;
                return (
                  <article key={key} data-rarity={oddling.rarity} data-mutation={oddling.mutation}>
                    <Image src={oddling.image} alt="" width={80} height={80} />
                    <span><strong>{oddling.name}</strong><small>{oddling.mutation} · {oddling.rarity} · ${formatCash(oddling.income)}/sec</small></span>
                    <button disabled={fuseSlots.length >= 4 || selected >= oddling.count || isFusing} onClick={() => addFuseMaterial(key)}>Add {selected}/{oddling.count}</button>
                  </article>
                );
              })}
            </div> : <p className={styles.fuseHelp}>Your storage is empty. Play Meme RNG and collect at least four characters first.</p>}
          </section>
        </section>
      )}
      <section className={styles.game} aria-labelledby="machine-title">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Meme RNG Arcade · Rebirth {rebirths}</p>
            <h1 id="machine-title">Meme RNG</h1>
          </div>
          <div className={styles.wallet}>
            <span>Balance</span>
            <strong>${formatCash(cash)}</strong>
            <small>+${formatCash(incomePerSecond)}/sec</small>
          </div>
          <button
            className={styles.soundButton}
            data-enabled={soundEnabled}
            onClick={toggleSound}
            aria-label={soundEnabled ? "Mute game audio" : "Turn on game audio"}
          >
            <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span>
            {soundEnabled ? "Sound on" : "Sound off"}
          </button>
          <button
            className={styles.menuButton}
            onClick={() => { setShowFuseMachine(false); setGameStarted(false); }}
            aria-label="Return to the Meme RNG title screen"
          >
            <span aria-hidden="true">↩</span>
            Menu
          </button>
        </header>

        <div className={styles.liveBar}>
          <div className={styles.eventChip} data-active={weekendEventActive}>
            <span>{weekendEventActive ? "✦ Weekend Warp LIVE" : "Next event: Weekend Warp"}</span>
            <small>{weekendEventActive ? "+10% income · +1% luck" : "Every Saturday and Sunday"}</small>
            {!feverPreviewUsed && <button onClick={() => startLuckFever(true)}>Test 50× now</button>}
          </div>
          <div className={styles.pityMeter}>
            <span>Pity power {pity}/{PITY_MAX}</span>
            <i><b style={{ width: `${pity / PITY_MAX * 100}%` }} /></i>
            <small>Builds until a Secret or OG lands</small>
          </div>
          <button className={styles.dailyButton} disabled={!currentDayKey || lastDailyClaim === currentDayKey} onClick={claimDailyReward}>
            {lastDailyClaim === currentDayKey ? "Daily claimed" : `Claim day ${dailyStreak >= 7 ? 1 : dailyStreak + 1}`}
            <small>{dailyStreak === 6 ? "Mutation guaranteed!" : "Daily reward"}</small>
          </button>
          <button className={styles.indexButton} onClick={() => setShowIndex(true)}>Meme-dex<small>Collection index</small></button>
        </div>

        <div className={styles.landscapeGrid}>
        <div className={styles.machineShell} data-rolling={isRolling}>
          <div className={styles.machineTop}>
            <div className={styles.statusLight} data-active={isRolling} />
            <span>{message}</span>
            <div className={styles.serial}>MRNG–01</div>
          </div>

          <div
            className={styles.screen}
            data-rolling={isRolling}
            data-character-rarity={displayedOddling.rarity}
          >
            <div className={styles.scanLines} aria-hidden="true" />
            {mutationIntro && (
              <div className={styles.mutationIntro} data-mutation={mutationIntro}>
                <span>Mutation detected</span>
                <strong>{mutationIntro} roll</strong>
                <small>{mutationMultipliers[mutationIntro]}× income</small>
              </div>
            )}
            {specialEvent && (
              <div className={styles.specialEventBadge} data-event={specialEvent}>
                {specialEvent === "meteor" && "☄ Meteor Shower · choose one"}
                {specialEvent === "glitch" && "⌁ Glitched Reel · mutation surge"}
                {specialEvent === "golden" && "✦ Golden Hour · Gold guaranteed"}
                {specialEvent === "double" && "×2 Double Trouble · buy two"}
              </div>
            )}
            <div className={styles.reelWindow}>
              {result ? (
                <div
                  className={styles.rollReveal}
                  data-rarity={result.rarity}
                  data-mutation={result.mutation}
                >
                  <div>
                    <span>You rolled</span>
                    <strong>{result.name}</strong>
                    <small>
                      {result.mutation !== "normal" && `${result.mutation} · `}
                      {result.rarity}
                    </small>
                    <b className={styles.oddsBadge}>1 in {formatOdds(result.oddsOneIn)}</b>
                  </div>
                  <Image
                    src={result.image}
                    alt={result.name}
                    width={280}
                    height={280}
                    priority
                  />
                </div>
              ) : (
                <>
                  <div className={styles.reelShadeLeft} aria-hidden="true" />
                  <div className={styles.reelShadeRight} aria-hidden="true" />
                  <div className={styles.centreMarker} aria-hidden="true" />
                  <div
                    className={`${styles.reelTrack} ${isReelMoving ? styles.reelSpinning : ""}`}
                    key={reelCycle}
                    style={
                      {
                        "--reel-end": `${-67 - winningIndex * 150}px`,
                        "--reel-duration": `${reelDuration}ms`,
                        transform: isReelMoving
                          ? undefined
                          : `translateX(${-67 - winningIndex * 150}px)`,
                      } as React.CSSProperties
                    }
                  >
                    {reelItems.map((entry, index) => (
                      <article
                        className={styles.reelCard}
                        data-rarity={isLuckToken(entry) ? "Luck" : entry.rarity}
                        data-luck-theme={isLuckToken(entry) ? entry.theme : undefined}
                        data-mutation={
                          !isLuckToken(entry) && activeMutation !== "normal"
                            ? activeMutation
                            : undefined
                        }
                        key={`${entry.id}-${index}`}
                      >
                        {isLuckToken(entry) ? (
                          <CloverArtwork token={entry} />
                        ) : (
                          <Image
                            src={entry.image}
                            alt={entry.name}
                            width={220}
                            height={220}
                            priority={index < 4}
                          />
                        )}
                        <span>{isLuckToken(entry) ? `${entry.multiplier}× Luck` : entry.rarity}</span>
                        <strong>{entry.name}</strong>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>

            {result && bonusChoices && (
              <div className={styles.meteorChoices}>
                {bonusChoices.map((choice, index) => (
                  <button
                    data-selected={choice.id === result.id && choice.mutation === result.mutation}
                    key={`${choice.id}-${choice.mutation}-${index}`}
                    onClick={() => chooseMeteorResult(choice)}
                  >
                    <Image src={choice.image} alt="" width={54} height={54} />
                    <span>{choice.name}</span>
                    <small>{choice.mutation} · 1 in {formatOdds(choice.oddsOneIn)}</small>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.resultIdentity} data-hidden={isRolling}>
              <p className={styles.rarity} data-rarity={displayedOddling.rarity}>
                {displayedOddling.rarity}
              </p>
              <h2>{displayedOddling.name}</h2>
              <p className={styles.description}>{displayedOddling.description}</p>
            </div>

            <div className={styles.luckTrack} aria-label={`Current luck: ${luck} times`}>
              {LUCK_LEVELS.slice(1).map((level) => (
                <span key={level} data-reached={luck >= level}>{level}×</span>
              ))}
            </div>
          </div>

          <div className={styles.machineControls}>
            {result ? (
              <div className={styles.resultActions}>
                <div>
                  <span>Produces</span>
                  <strong>
                    ${formatCash(
                      mutatedIncome(result, result.mutation) *
                      (1 + ((characterLevels[ownedKey(result.id, result.mutation)] ?? 1) - 1) * 0.5) *
                      incomeMultiplier,
                    )}/sec
                  </strong>
                  <small className={styles.resultOdds}>1 in {formatOdds(result.oddsOneIn)} roll</small>
                  <small data-urgent={resultSecondsLeft <= 10}>
                    Hold expires in {resultSecondsLeft}s
                  </small>
                </div>
                <button className={styles.collectButton} onClick={collectResult}>
                  {ownedTotal >= maxCharacterSlots
                    ? "Full · Sell one first"
                    : specialEvent === "double"
                      ? `Collect two · $${formatCash(result.price * 2)}`
                      : `Collect · $${formatCash(result.price)}`}
                </button>
                <button className={styles.discardButton} onClick={discardResult}>
                  Release
                </button>
              </div>
            ) : (
              <button
                className={styles.rollButton}
                disabled={isRolling || cash < spinCost}
                onClick={() => roll(false)}
              >
                <span>{isRolling ? "ROLLING" : "ROLL"}</span>
                <small>${formatCash(spinCost)}</small>
              </button>
            )}
          </div>
        </div>

        <section className={styles.collection} aria-labelledby="collection-title">
          <div className={styles.collectionHeading}>
            <div>
              <p className={styles.eyebrow}>Passive income</p>
              <h2 id="collection-title">My Memes</h2>
            </div>
            <span>{ownedTotal}/{maxCharacterSlots} active · +1 per rebirth</span>
          </div>

          {collection.length ? (
            <div className={styles.collectionGrid}>
              {collection.map((oddling) => (
                <article
                  key={ownedKey(oddling.id, oddling.mutation)}
                  className={styles.collectionCard}
                  data-rarity={oddling.rarity}
                  data-mutation={oddling.mutation}
                >
                  <div className={styles.miniOrb}>
                    <Image src={oddling.image} alt="" width={80} height={80} />
                  </div>
                  <div>
                    <h3>{oddling.name} <small>Lv.{characterLevels[ownedKey(oddling.id, oddling.mutation)] ?? 1}</small></h3>
                    <p>
                      {oddling.mutation !== "normal" && `${oddling.mutation} · `}
                      {oddling.rarity} · ${formatCash(
                        mutatedIncome(oddling, oddling.mutation) *
                        (1 + ((characterLevels[ownedKey(oddling.id, oddling.mutation)] ?? 1) - 1) * 0.5) *
                        incomeMultiplier,
                      )}/sec
                    </p>
                  </div>
                  <div className={styles.collectionActions}>
                    <strong>×{oddling.count}</strong>
                    <button onClick={() => sellOddling(oddling)}>
                      Sell +${formatCash(Math.floor(oddling.price / 2))}
                    </button>
                    {oddling.count >= 3 && (
                      <button onClick={() => combineOddling(oddling)}>Combine 3</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyCollection}>
              <span>?</span>
              <p>Your collection is empty. Roll the machine to discover your first meme.</p>
            </div>
          )}

          <div className={styles.upgradeTree}>
            <div className={styles.upgradeTitle}>
              <p className={styles.eyebrow}>Machine upgrades</p>
              <h3>Upgrade Tree</h3>
            </div>
            {([
              ["luck", "Lucky Circuit", `Luck step: ${(getLuckChance(upgrades, rebirths) * 100).toFixed(1)}%`],
              ["speed", "Turbo Motor", `Reel speed: +${upgrades.speed * 8}%`],
              ["mutation", "Mutation Lab", `Mutation chance: ${30 + upgrades.mutation * 3}%`],
            ] as const).map(([branch, name, detail]) => {
              const level = upgrades[branch];
              const isMaxed = level >= MAX_UPGRADE_LEVEL;
              return (
                <article className={styles.upgradeBranch} data-branch={branch} key={branch}>
                  <div>
                    <strong>{name}</strong>
                    <span>{detail}</span>
                  </div>
                  <div className={styles.levelPips} aria-label={`Level ${level} of ${MAX_UPGRADE_LEVEL}`}>
                    {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, index) => (
                      <i key={index} data-filled={index < level} />
                    ))}
                  </div>
                  <button onClick={() => buyUpgrade(branch)} disabled={isMaxed}>
                    {isMaxed ? "Maxed" : `Upgrade · $${formatCash(upgradeCosts[branch][level])}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
        </div>

        <section className={styles.progressionHub} aria-label="Meme RNG progression">
          <article className={styles.hubCard}>
            <div className={styles.hubHeading}><span>◎</span><div><p>Objectives</p><h3>Quests</h3></div></div>
            <div className={styles.questList}>
              {quests.map((quest) => {
                const complete = quest.progress >= quest.target;
                const claimed = claimedQuests.includes(quest.id);
                return (
                  <div key={quest.id} data-complete={complete}>
                    <div><strong>{quest.name}</strong><small>{quest.detail}</small></div>
                    <progress value={Math.min(quest.progress, quest.target)} max={quest.target} />
                    <button disabled={!complete || claimed} onClick={() => claimQuest(quest.id, quest.reward, quest.boss)}>
                      {claimed ? "Claimed" : complete ? `Claim $${formatCash(quest.reward)}` : `${formatCash(quest.progress)}/${formatCash(quest.target)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </article>

          <article className={styles.hubCard}>
            <div className={styles.hubHeading}><span>⚗</span><div><p>Boost shop</p><h3>Potions</h3></div></div>
            <div className={styles.potionGrid}>
              {(Object.entries(potionShop) as [PotionKind, typeof potionShop[PotionKind]][]).map(([kind, potion]) => {
                const active = kind === "double"
                  ? clockNow < doubleIncomeUntil
                  : activePotionRolls[kind];
                return (
                  <div key={kind} data-kind={kind}>
                    <strong>{potion.name}</strong><small>{potion.detail}</small>
                    <span>Bag ×{potions[kind]}{active ? ` · Active ${kind === "double" ? "now" : `${active} rolls`}` : ""}</span>
                    <div><button onClick={() => buyPotion(kind)}>Buy ${formatCash(potion.price)}</button><button disabled={!potions[kind]} onClick={() => activatePotion(kind)}>Use</button></div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className={styles.hubCard}>
            <div className={styles.hubHeading}><span>♛</span><div><p>Challenge reel</p><h3>Boss Roll</h3></div></div>
            <p className={styles.hubCopy}>Spend one Boss Ticket and 25× the normal roll price. The reel jumps to 20× luck and guarantees the high-tier pool.</p>
            <div className={styles.bossPanel}>
              <span>Tickets <strong>×{bossTickets}</strong></span>
              <button disabled={isRolling || !!result || bossTickets < 1 || cash < spinCost * 25} onClick={() => roll(true)}>
                Boss roll · ${formatCash(spinCost * 25)}
              </button>
            </div>
            <div className={styles.eventLegend}><span>☄ Choose 1 of 3</span><span>⌁ Mutation surge</span><span>✦ Gold guaranteed</span><span>×2 Double pull</span></div>
          </article>

          <article className={styles.hubCard}>
            <div className={styles.hubHeading}><span>⚡</span><div><p>Collection powers</p><h3>Abilities</h3></div></div>
            <div className={styles.abilityList}>
              <span data-active={hasTrolliniAbility}>Fairs Meme · 5% cheaper rolls</span>
              <span data-active={hasSilverSlimeAbility}>Chicken Jockey · +2% mutation</span>
              <span data-active={hasQuantumAbility}>Neegy · +2% luck</span>
            </div>
          </article>

          <article className={styles.hubCard}>
            <div className={styles.hubHeading}><span>▥</span><div><p>Lifetime</p><h3>Statistics</h3></div></div>
            <div className={styles.statsGrid}>
              <div><strong>{formatCash(stats.totalRolls)}</strong><span>Rolls</span></div>
              <div><strong>{stats.highestLuck}×</strong><span>Best luck</span></div>
              <div><strong>{stats.rarestOdds ? `1/${formatOdds(stats.rarestOdds)}` : "—"}</strong><span>Rarest pull</span></div>
              <div><strong>${formatCash(stats.totalEarned)}</strong><span>Passive earned</span></div>
              <div><strong>{stats.mutationsFound.length}/3</strong><span>Mutations</span></div>
              <div><strong>{stats.charactersSold}</strong><span>Sold</span></div>
            </div>
          </article>

          <article className={styles.hubCard}>
            <div className={styles.hubHeading}><span>★</span><div><p>Milestones</p><h3>Achievements</h3></div></div>
            <div className={styles.achievementList}>
              {achievements.map((achievement) => (
                <div key={achievement.name} data-unlocked={achievement.unlocked}>
                  <span>{achievement.unlocked ? "★" : "☆"}</span><div><strong>{achievement.name}</strong><small>{achievement.detail}</small></div>
                </div>
              ))}
            </div>
          </article>

          <article className={`${styles.hubCard} ${styles.dailyTrack}`}>
            <div className={styles.hubHeading}><span>☀</span><div><p>Come back tomorrow</p><h3>Daily Track</h3></div></div>
            <div>{Array.from({ length: 7 }, (_, index) => <span key={index} data-reached={dailyStreak > index}><b>Day {index + 1}</b><small>{index === 6 ? "Mutation" : `$${formatCash((index + 1) * 50_000)}`}</small></span>)}</div>
          </article>
        </section>

        {showIndex && (
          <div className={styles.indexOverlay} role="dialog" aria-modal="true" aria-label="Meme-dex collection index">
            <section className={styles.indexModal}>
              <header><div><p className={styles.eyebrow}>Collection index</p><h2>Meme-dex</h2></div><button onClick={() => setShowIndex(false)}>Close</button></header>
              <div className={styles.indexGrid}>
                {allOddlings.map((oddling) => {
                  const discovered = MUTATIONS.some((mutation) => (owned[ownedKey(oddling.id, mutation)] ?? 0) > 0);
                  return (
                    <article key={oddling.id} data-discovered={discovered} data-rarity={oddling.rarity}>
                      <Image src={oddling.image} alt={discovered ? oddling.name : "Undiscovered meme"} width={120} height={120} />
                      <strong>{discovered ? oddling.name : "???"}</strong>
                      <small>{oddling.rarity}</small>
                      <div>{MUTATIONS.map((mutation) => <i key={mutation} title={mutation} data-found={(owned[ownedKey(oddling.id, mutation)] ?? 0) > 0}>{mutation.slice(0, 1).toUpperCase()}</i>)}</div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        <button className={styles.resetButton} onClick={resetSave}>Reset saved game</button>
      </section>
    </main>
  );
}
