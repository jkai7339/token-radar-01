// Token radar model ("radar-2"): one sealed snapshot in, one ranked board out.
//
// The board ranks pre-token protocols only. Every slug on the snapshot's
// watchlist is ranked, and the early radar adds every other pre-token
// protocol that passes the same house-style screen the watchlist uses
// (no exchange, no versioned pool, no wrapped / staked / bridged product of
// a token that already trades). Protocols whose token already trades are
// never ranked: they are listed apart, at the market's own value, in the
// dashboard's "Already trading" panel.
//
// Implied value follows only from the snapshot's own figures. For a
// protocol with TVL T, seven-day change g, age a in days and n chains:
//
//   size      = (T / 1e6) ^ 0.92 x 1e6          a concave size curve: value
//                                              grows slower than TVL, so a
//                                              protocol 10x smaller is not
//                                              10x less valuable
//   catMult   = the category's FDV/TVL benchmark (table below; a category,
//                                              never a name, sets it)
//   growth    = 1 + 0.7 x clamp(g, -50, +100) / 100
//   maturity  = 0.70 + 0.30 x min(a, 1460) / 1460   (age unknown: 365 days)
//   breadth   = 1 + 0.03 x min(n - 1, 4)       a protocol live on more chains
//                                              reaches more future holders
//   implied   = round(size x catMult x growth x maturity x breadth)
//
// No protocol name is ever special-cased: the same function scores every
// row, and the dashboard shows each row's five factors so a reader can
// check the arithmetic.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  size_exponent: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
}

export const MODEL: ModelConstants = {
  size_exponent: 0.92,
  growth_weight: 0.7,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1460,
  unknown_age_days: 365,
  breadth_per_chain: 0.03,
  breadth_max_chains: 4,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the "Already trading" panel carries, by market cap. */
export const LIVE_ROWS = 24;

/**
 * A category's FDV/TVL benchmark: what the market has tended to pay for a
 * dollar of TVL in that kind of protocol. These are category-level
 * benchmarks, the same for every protocol in the category; they are the
 * model's one judgement call, and the dashboard states the whole table.
 */
export const CATEGORY_MULTIPLE: Record<string, number> = {
  'Prediction Market': 0.5,
  Derivatives: 0.45,
  Privacy: 0.45,
  Payments: 0.4,
  RWA: 0.4,
  'Basis Trading': 0.35,
  Insurance: 0.35,
  Dexs: 0.35,
  'Leveraged Farming': 0.3,
  Lending: 0.3,
  'Risk Curators': 0.3,
  'Onchain Capital Allocator': 0.3,
  Indexes: 0.3,
  Restaking: 0.3,
  CDP: 0.28,
  'Yield Aggregator': 0.25,
  'Liquidity Manager': 0.25,
  'Staking Pool': 0.25,
  Yield: 0.22,
  Farm: 0.22,
  'Uncollateralized Lending': 0.2,
  'Cross Chain Bridge': 0.2,
  'Anchor BTC': 0.2,
  'Decentralized BTC': 0.2,
  'Dual-Token Stablecoin': 0.2,
  'Stablecoin Wrapper': 0.2,
  'Interest Rate Derivatives': 0.25,
  'CDP Manager': 0.25,
  'OTC Marketplace': 0.25,
  CeDeFi: 0.25,
  'Crypto Card Issuer': 0.25,
  Chain: 0.35,
};

/** The multiple for a protocol's category, or the default for an unlisted one. */
export function categoryMultiple(category: string | null): number {
  if (category === null) return 0.22;
  return CATEGORY_MULTIPLE[category] ?? 0.25;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    size_value_usd: number;
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the model's factors. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  size_value_usd: number;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  watchlist_slugs: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export interface ImpliedBreakdown {
  implied: number;
  sizeValue: number;
  catMult: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
}

/** The five factors and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): ImpliedBreakdown {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains);
  const breadthMult = 1 + extraChains * model.breadth_per_chain;
  const catMult = categoryMultiple(protocol.category);
  const sizeValue = Math.pow(protocol.tvl_usd / 1_000_000, model.size_exponent) * 1_000_000;
  const implied = Math.max(1, Math.round(sizeValue * catMult * growthMult * maturityMult * breadthMult));
  return { implied, sizeValue: Math.round(sizeValue), catMult, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Categories the watchlist rule treats as a wrapped, staked or bridged product of a token that trades. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** Exchange names a genuine pre-token protocol never begins with. */
const EXCHANGE_NAME = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** A whole word that marks a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a pre-token protocol is a genuine launch candidate under the
 * house's own screen: not an exchange, not a versioned pool, not a wrapped,
 * staked or bridged product of a token that already trades.
 */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (WRAPPED_CATEGORIES.has(p.category ?? '')) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_NAME.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other launch candidate below the watchlist floor.
  // Never a replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isLaunchCandidate(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => ({ p, v: impliedValue(p, snapshot.as_of, model) }));
  scored.sort(
    (a, b) =>
      b.v.implied - a.v.implied ||
      b.p.tvl_usd - a.p.tvl_usd ||
      (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      size_value_usd: s.v.sizeValue,
      category_multiple: s.v.catMult,
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      breadth_multiplier: round4(s.v.breadthMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** A small deterministic hash of a slug, so template variants differ per protocol but never change. */
function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A second chain when the protocol runs on more than one, else null. */
function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  if (age < 730) return 45;
  return 30;
}

/** Gas wording for a chain: cheap chains cost cents, Ethereum costs dollars. */
function gasFor(chain: string): { tx: string; weekly: string } {
  const cheap = ['Base', 'Arbitrum', 'Optimism', 'Polygon', 'Solana', 'BSC', 'BNB Chain', 'Avalanche', 'Berachain', 'Sonic', 'Linea', 'Scroll', 'Blast', 'Mantle', 'zkSync Era', 'Starknet'];
  if (cheap.includes(chain)) return { tx: 'under $0.50 of gas', weekly: 'under $1 of gas a week' };
  if (chain === 'Ethereum') return { tx: 'about $3 to $8 of gas, more when the network is busy', weekly: 'about $5 of gas a week' };
  return { tx: 'about $1 to $3 of gas', weekly: 'about $2 of gas a week' };
}

/**
 * The category's main farming action, in the words a farmer can follow.
 * Each group carries two or three variants; the slug's hash picks one, so
 * two protocols in one category do not read identically.
 */
function actionFor(p: SnapshotProtocol, capital: number, chain: string, variant: number): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const pick = (options: string[]): string => options[variant % options.length]!;
  if (c.includes('dex')) {
    return pick([
      `Provide $${capital} of liquidity to ${name}'s largest pool on ${chain}, in the pair the app lists first, and keep the position in range.`,
      `Swap $${capital} through ${name} on ${chain} in two trades a week apart, then add $${capital / 2} to its deepest pool.`,
      `Deposit $${capital} into ${name}'s main liquidity pool on ${chain} and stake the LP receipt if the app offers staking.`,
    ]);
  }
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return pick([
      `Supply $${capital} of USDC to ${name} on ${chain} as collateral, then borrow $20 of a stablecoin against it and repay it the same week.`,
      `Deposit $${capital} of ETH or a liquid staking token as collateral on ${name} (${chain}) and open a borrow of no more than 30% of its value.`,
      `Supply $${capital} of USDC to ${name} on ${chain} and keep the supply position open without borrowing.`,
    ]);
  }
  if (c.includes('yield') || c.includes('vault') || c.includes('aggregator')) {
    return pick([
      `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and leave the shares untouched.`,
      `Split $${capital} across two ${name} vaults on ${chain}, the largest one and one that pays in a different asset.`,
      `Deposit $${capital} into a ${name} vault on ${chain} and claim the vault's yield back into the same vault once a month.`,
    ]);
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return pick([
      `Deposit $${capital} of USDC as margin on ${name} (${chain}), open one small long of $25 notional, and close it within a day.`,
      `Deposit $${capital} of USDC as collateral on ${name} on ${chain} and place one limit order of $25 notional, filled or not.`,
      `Fund $${capital} on ${name} (${chain}) and open a $25 hedge that you close before the funding interval ends.`,
    ]);
  }
  if (c.includes('risk') || c.includes('curator') || c.includes('allocator') || c.includes('capital')) {
    return pick([
      `Deposit $${capital} into a ${name} vault on ${chain}, choosing the vault with the largest TVL the app lists.`,
      `Allocate $${capital} to a ${name} curated vault on ${chain} and keep the vault shares for the full hold period.`,
      `Deposit $${capital} into ${name} on ${chain}, then read the vault's curator page and note the strategy it runs.`,
    ]);
  }
  if (c.includes('rwa')) {
    return pick([
      `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in the same wallet.`,
      `Buy $${capital} of the tokenised asset ${name} offers on ${chain} and keep it until the hold period ends.`,
    ]);
  }
  if (c.includes('basis') || c.includes('stable')) {
    return pick([
      `Mint $${capital} of the stable asset through ${name} on ${chain} and hold it in your farming wallet.`,
      `Deposit $${capital} of collateral into ${name} on ${chain}, mint the stable asset, and keep the position above a 200% ratio.`,
    ]);
  }
  if (c.includes('prediction')) {
    return pick([
      `Fund $${capital} on ${name} and take one $10 position on a market that settles within two weeks.`,
      `Deposit $${capital} on ${name}, place one $10 market position, and add liquidity of $25 to a market pool if the app offers it.`,
    ]);
  }
  if (c.includes('bridge') || c.includes('cross chain')) {
    return pick([
      `Bridge $${capital} of USDC into ${chain} through ${name} and use the bridged funds in an app on that chain.`,
      `Send $${capital} of USDC through ${name} to ${chain}, then send half of it back a week later through the same route.`,
    ]);
  }
  if (c.includes('staking') || c.includes('restak')) {
    return pick([
      `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in your wallet.`,
      `Deposit $${capital} into ${name}'s staking pool on ${chain} and restake any rewards the app pays out.`,
    ]);
  }
  if (c.includes('chain')) {
    return pick([
      `Bridge $${capital} of USDC to ${name}'s chain and use it in the chain's largest app, keeping a small balance for gas.`,
      `Hold $${capital} of the chain's native gas asset in a wallet on ${name} and make one transaction a week on the chain.`,
    ]);
  }
  if (c.includes('payment') || c.includes('card')) {
    return pick([
      `Spend $${capital} through ${name} on ${chain} across at least three separate payments in the hold period.`,
      `Fund ${name} with $${capital} on ${chain} and use it for one real payment each week.`,
    ]);
  }
  if (c.includes('insurance')) {
    return pick([
      `Buy $${capital} of cover from ${name} on ${chain} for a position you already hold, and keep the policy active.`,
      `Deposit $${capital} into ${name}'s cover pool on ${chain} and leave the underwriting position open.`,
    ]);
  }
  if (c.includes('farm') || c.includes('leveraged')) {
    return pick([
      `Open a $${capital} leveraged position on ${name} (${chain}) at no more than 2x, and close it within a week.`,
      `Deposit $${capital} into ${name}'s main farm on ${chain} and harvest the rewards back into the position once.`,
    ]);
  }
  if (c.includes('btc') || c.includes('anchor')) {
    return pick([
      `Deposit $${capital} of BTC-backed collateral through ${name} on ${chain} and keep the position open.`,
      `Mint $${capital} of ${name}'s BTC-backed asset on ${chain} and hold it in your farming wallet.`,
    ]);
  }
  return pick([
    `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    `Use ${name} on ${chain} with $${capital}, making one real transaction a week for the whole hold period.`,
    `Open a $${capital} position in ${name} on ${chain} and interact with its app once a week.`,
  ]);
}

/** The second, different action: a weekly habit that keeps the wallet active. */
function habitFor(p: SnapshotProtocol, chain: string, variant: number): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const pick = (options: string[]): string => options[variant % options.length]!;
  if (c.includes('dex')) return pick([`Swap $10 through ${name} on ${chain} once a week, alternating the direction of the trade.`, `Add or remove $10 of liquidity on ${name} (${chain}) once a week so the wallet shows repeated use.`]);
  if (c.includes('lend') || c.includes('cdp')) return pick([`Adjust the ${name} position once a week: add $10 of collateral or repay $10 of the borrow.`, `Check the ${name} borrow rate weekly on ${chain} and top up collateral when the health factor falls.`]);
  if (c.includes('yield') || c.includes('vault') || c.includes('aggregator') || c.includes('risk') || c.includes('curator') || c.includes('allocator') || c.includes('capital')) return pick([`Check the ${name} vault's yield once a week and claim or compound any rewards the app shows.`, `Move $10 between the two largest ${name} vaults on ${chain} once a month.`]);
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('prediction') || c.includes('options')) return pick([`Place one $10 trade on ${name} (${chain}) each week and close it the same day.`, `Set one $10 limit order on ${name} each week and cancel it if it does not fill.`]);
  if (c.includes('rwa') || c.includes('basis') || c.includes('stable') || c.includes('btc') || c.includes('anchor')) return pick([`Check the ${name} asset's backing or yield page once a week and record the figure.`, `Add $10 to the ${name} position on ${chain} once a month.`]);
  if (c.includes('bridge') || c.includes('cross chain')) return pick([`Bridge $10 through ${name} once a month, to a different destination chain than the first transfer.`, `Use ${name} for one $10 transfer a month and keep the receipt hash in your log.`]);
  if (c.includes('staking') || c.includes('restak')) return pick([`Claim and restake ${name} staking rewards once a month on ${chain}.`, `Check the ${name} staking yield weekly and add $10 of stake once a month.`]);
  if (c.includes('chain')) return pick([`Make one transaction a week on ${name}'s chain, in an app other than the bridge you arrived on.`, `Keep a small balance on ${name}'s chain and use one of its apps weekly.`]);
  return pick([`Open ${name} on ${chain} once a week and use one feature you have not used before.`, `Make one $10 transaction in ${name} (${chain}) each week.`]);
}

/** The gas asset a chain's wallet needs. */
function gasAsset(chain: string): string {
  if (chain === 'Solana') return 'SOL';
  if (chain === 'BSC' || chain === 'BNB Chain') return 'BNB';
  if (chain === 'Polygon') return 'POL';
  if (chain === 'Avalanche') return 'AVAX';
  if (chain === 'Tron') return 'TRX';
  if (chain === 'Near') return 'NEAR';
  if (chain === 'Sui') return 'SUI';
  if (chain === 'Aptos') return 'APT';
  if (chain === 'Cardano') return 'ADA';
  if (chain === 'Bittensor') return 'TAO';
  if (chain === 'Monad') return 'MON';
  if (chain === 'Berachain') return 'BERA';
  if (chain === 'Sonic') return 'S';
  if (chain === 'Sei') return 'SEI';
  if (chain === 'Hyperliquid' || chain === 'HyperEVM') return 'HYPE';
  if (chain === 'Injective') return 'INJ';
  if (chain === 'Osmosis') return 'OSMO';
  return 'ETH';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains,
 * TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const v = hashSlug(p.slug);
  const variant = v % 3;
  const steps: FarmStep[] = [
    {
      text: `Set up a fresh wallet that holds only the funds you plan to farm with ${p.name}, keep its seed phrase offline, and fund it with enough ${gasAsset(chain)} for gas on ${chain}.`,
      cost: gas.tx,
      time: '10 minutes',
    },
    { text: actionFor(p, capital, chain, variant), cost: `$${capital} of capital and ${gas.tx}`, time: '15 minutes to set up' },
    {
      text: habitFor(p, chain, (v >>> 2) % 3),
      cost: gas.tx,
      time: '10 minutes each time',
    },
  ];
  if (second !== null) {
    steps.push({
      text: `Repeat the main position on ${second}, with half the capital ($${capital / 2}), so the wallet shows activity on two of ${p.name}'s ${p.chains.length} chains.`,
      cost: `$${capital / 2} of capital and ${gasFor(second).tx}`,
      time: '15 minutes',
    });
  } else {
    steps.push({
      text: `After two weeks, add another $${capital / 2} to the same ${p.name} position on ${chain} instead of opening a second wallet.`,
      cost: `$${capital / 2} of extra capital and ${gas.tx}`,
      time: '10 minutes',
    });
  }
  steps.push(
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and do not withdraw early.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page from the link the protocol itself publishes, claim only there, and never pay anyone to claim for you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates, the chains and every transaction hash in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  );
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's "Already trading" panel. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan the page shows. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    size_value_usd: row.model.size_value_usd,
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    watchlist_slugs: [...snapshot.watchlist],
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
