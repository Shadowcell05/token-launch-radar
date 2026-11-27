// Launch Radar model: one sealed DefiLlama snapshot in, one ranked board out.
//
// The idea, in one paragraph. A protocol that has not launched a token is
// worth roughly what the market already pays for similar protocols that
// have. The catch is that the market does not pay a flat price per TVL
// dollar: measured on the snapshot's traded protocols, market cap grows
// like TVL to the power of about one half, so a flat multiple overprices
// big protocols and underprices small ones. This model therefore fits
// the curve ln(market cap) = a + b x ln(TVL) on the traded peers: one
// shared slope, plus a level per category (three or more peers earn a
// level, shrunk toward the global curve so small categories stay
// honest), and
// prices a pre-token protocol off that curve. One adjustment follows:
// maturity. A protocol that has run for years with no token is a more
// credible launch candidate than a two-week-old one, so the fitted value
// is scaled from 0.75x at listing to 1.20x after four tokenless years.
// Two further adjustments an earlier version of this model shipped —
// seven-day TVL momentum and chain breadth — were removed in this
// version, because when the backtest below was extended to score the
// shipped model exactly as it ranks the board, the set of three made
// blind pricing worse, not better; maturity alone improved it. The
// board ranks by the resulting implied value. A separate launch prior
// per category and a confidence grade from the peer count are shown on
// the dashboard as farming guidance; they never move the value ranking.
//
// The model is not asserted, it is measured: a deterministic five-fold
// cross-validation (protocols assigned to folds by a hash of their slug,
// so anyone can reproduce the split) fits every candidate model on four
// fifths of the traded protocols and scores it against the held-out
// fifth's actual market caps, rotating until every peer has been scored
// blind. The candidate list is an audit, not a beauty contest: it
// includes the flat multiples the curve replaced, the curve with no
// adjustments, the previous version's full adjustment set, and the
// model that actually ranks this board — measured exactly as shipped,
// adjustments included. The dashboard publishes the result next to the
// board.
//
// Nothing here knows a protocol's name. The same arithmetic scores every
// row, and the dashboard recomputes each value from the same inputs so a
// reader can check the board against the code.

export interface Protocol {
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

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

/** Category peer statistics: what the market pays per dollar of TVL. */
export interface PeerStats {
  category: string;
  peers: number;
  median: number;
  low: number;
  high: number;
}

/**
 * A fitted pricing curve for one peer set: ln(market cap) = intercept +
 * slope x ln(TVL). The slope is shared (fit on all traded peers); each
 * category with enough peers gets its own intercept — its level —
 * shrunk toward the global intercept so a handful of peers cannot drag
 * the level far. The residual quartiles price the honest range around a
 * point estimate.
 */
export interface FitStats {
  category: string;
  peers: number;
  intercept: number;
  slope: number;
  resid_low: number;
  resid_high: number;
}

/** One candidate model scored on the held-out half of the traded protocols. */
export interface ValidationModel {
  name: string;
  median_ape_pct: number;
  within_2x_pct: number;
  within_3x_pct: number;
}

/** One band of the board model's blind-pricing spread: the share of held-out peers priced within a factor of their actual cap. */
export interface SpreadBand {
  factor: number;
  pct: number;
}

/** The five-fold cross-validation, computed by this program from the snapshot itself. */
export interface ValidationReport {
  method: string;
  usable_peers: number;
  folds: number;
  global_slope: number;
  models: ValidationModel[];
  board_spread: SpreadBand[];
}

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
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  launch_prior: number;
  confidence: 'high' | 'medium' | 'low';
  model: {
    peer_median: number;
    peer_low: number;
    peer_high: number;
    peers: number;
    peer_scope: 'category' | 'global';
    fit_intercept: number;
    fit_slope: number;
    fit_scope: 'category' | 'global';
    median_implied_usd: number;
    farm_capital_usd: number;
    maturity_multiplier: number;
  };
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  multiple: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model_summary: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  pre_token_size: number;
  live_size: number;
  categories: PeerStats[];
  fits: FitStats[];
  global_fit: FitStats;
  validation: ValidationReport;
  rows: BoardRow[];
  live: LiveRow[];
}

export const MODEL_VERSION = 'launch-radar-5';

export const MODEL_SUMMARY =
  'Implied value comes from a curve fitted on the protocols whose token already trades: ' +
  'ln(market cap) = a + b x ln(TVL), one shared slope with a level per category (three or more ' +
  'traded peers earn a level, shrunk toward the global curve; otherwise the global curve ' +
  'prices it). A flat multiple is not ' +
  'used: on this snapshot market cap grows like TVL to about the power 0.5, so a flat price per ' +
  'TVL dollar overprices large protocols. The fitted value carries one adjustment: maturity ' +
  '(0.75x at listing rising to 1.20x after four tokenless years). An earlier version of this ' +
  'model also adjusted for 7-day TVL momentum and chain breadth; both were removed after the ' +
  'backtest was extended to score the shipped model exactly as it ranks the board — as a set ' +
  'they made blind pricing worse, while maturity alone improved it. The range uses the ' +
  'fit\u2019s residual quartiles. A deterministic five-fold cross-validation, published on the ' +
  'dashboard, scores this exact model — adjustments included — against the flat multiples it ' +
  'replaced and against its own earlier recipes: every traded peer is ' +
  'priced blind, by a model that never saw it. Launch prior and confidence are ' +
  'farming guidance only and never change the value rank. ' +
  'The board also leaves out wrapped, staked and bridged products of tokens that already trade: ' +
  'a wrapper with no ticker of its own is not a launch that has not happened yet.';

/** At most this many rows: the whole watchlist plus the strongest early candidates. */
export const MAX_ROWS = 240;

/** How many already-launched peers the dashboard's peer view carries. */
export const LIVE_ROWS = 30;

const DAY = 86_400_000;

export function isPreToken(p: Protocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const DERIVATIVE_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * Categories that are products of a token that already trades, not
 * protocols waiting on a launch of their own: a wrapped BTC bridge or a
 * liquid staking product does not become a token launch because the
 * wrapper itself has no ticker. The watchlist's own rule, applied to the
 * whole board.
 */
const DERIVATIVE_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Rankable: pre-token, and not a wrapped, staked, bridged or versioned product of one that trades. */
export function isRankable(p: Protocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name) || DERIVATIVE_WORD.test(p.name) || EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY));
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const at = (sorted.length - 1) * q;
  const base = Math.floor(at);
  const rest = at - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base]! : sorted[base]! + rest * (next - sorted[base]!);
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** Peer multiples for every category that has at least one traded protocol, plus the global fallback. */
export function peerStats(snapshot: Snapshot): { byCategory: Map<string, PeerStats>; global: PeerStats } {
  const groups = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const multiple = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(multiple) || multiple <= 0) continue;
    all.push(multiple);
    const key = p.category ?? 'Uncategorised';
    const list = groups.get(key) ?? [];
    list.push(multiple);
    groups.set(key, list);
  }
  const summarise = (category: string, values: number[]): PeerStats => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      category,
      peers: sorted.length,
      median: round4(quantile(sorted, 0.5)),
      low: round4(quantile(sorted, 0.25)),
      high: round4(quantile(sorted, 0.75)),
    };
  };
  const byCategory = new Map<string, PeerStats>();
  for (const [category, values] of groups) byCategory.set(category, summarise(category, values));
  return { byCategory, global: summarise('All categories', all) };
}

function statsFor(
  p: Protocol,
  peers: { byCategory: Map<string, PeerStats>; global: PeerStats },
): { stats: PeerStats; scope: 'category' | 'global' } {
  const own = p.category === null ? undefined : peers.byCategory.get(p.category);
  // Fewer than three traded peers is anecdote, not a market: fall back to the global median.
  if (own !== undefined && own.peers >= 3) return { stats: own, scope: 'category' };
  return { stats: peers.global, scope: 'global' };
}

/** Traded protocols a curve can be fit or scored on: a real market cap and real TVL. */
export function usablePeers(snapshot: Snapshot): Protocol[] {
  return snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
}

/** Least-squares fit of ln(market cap) on ln(TVL), with the residual quartiles as the range. */
function fitCurve(category: string, rows: Protocol[]): FitStats {
  const xs = rows.map((p) => Math.log(p.tvl_usd));
  const ys = rows.map((p) => Math.log(p.mcap_usd!));
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = my - slope * mx;
  const residuals = rows
    .map((p) => Math.log(p.mcap_usd!) - (intercept + slope * Math.log(p.tvl_usd)))
    .sort((a, b) => a - b);
  return {
    category,
    peers: rows.length,
    intercept: round4(intercept),
    slope: round4(slope),
    resid_low: round4(quantile(residuals, 0.25)),
    resid_high: round4(quantile(residuals, 0.75)),
  };
}

/** How hard a category's own level is shrunk toward the global curve: n peers count n, the prior counts this many. */
export const LEVEL_PRIOR_PEERS = 4;

/**
 * Fitted curves: one global curve, plus a level per category. The slope
 * is fit once on every usable peer — per-category slopes on a dozen
 * noisy peers swing wildly, and the backtest below punishes them — while
 * each category's intercept is the mean log gap between its peers'
 * actual caps and the global curve, shrunk toward the global intercept
 * with a prior worth LEVEL_PRIOR_PEERS peers.
 */
export function peerFits(snapshot: Snapshot): { byCategory: Map<string, FitStats>; global: FitStats } {
  const usable = usablePeers(snapshot);
  const global = fitCurve('All categories', usable);
  const groups = new Map<string, Protocol[]>();
  for (const p of usable) {
    const key = p.category ?? 'Uncategorised';
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  const byCategory = new Map<string, FitStats>();
  for (const [category, rows] of groups) {
    const rawLevel =
      rows.reduce((s, p) => s + (Math.log(p.mcap_usd!) - global.slope * Math.log(p.tvl_usd)), 0) / rows.length;
    const n = rows.length;
    const intercept = (n * rawLevel + LEVEL_PRIOR_PEERS * global.intercept) / (n + LEVEL_PRIOR_PEERS);
    const residuals = rows
      .map((p) => Math.log(p.mcap_usd!) - (intercept + global.slope * Math.log(p.tvl_usd)))
      .sort((a, b) => a - b);
    byCategory.set(category, {
      category,
      peers: n,
      intercept: round4(intercept),
      slope: global.slope,
      resid_low: round4(quantile(residuals, 0.25)),
      resid_high: round4(quantile(residuals, 0.75)),
    });
  }
  return { byCategory, global };
}

/** A category earns its own level at three traded peers; below that the global curve prices it. */
export const MIN_FIT_PEERS = 3;

function fitFor(
  p: Protocol,
  fits: { byCategory: Map<string, FitStats>; global: FitStats },
): { fit: FitStats; scope: 'category' | 'global' } {
  const own = p.category === null ? undefined : fits.byCategory.get(p.category);
  if (own !== undefined && own.peers >= MIN_FIT_PEERS) return { fit: own, scope: 'category' };
  return { fit: fits.global, scope: 'global' };
}

function predict(fit: FitStats, tvl: number): number {
  return Math.exp(fit.intercept + fit.slope * Math.log(tvl));
}

/** FNV-1a over the slug: the backtest's coin flip, reproducible by anyone from the snapshot alone. */
function slugHash(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function scoreModel(name: string, preds: number[], actuals: number[]): ValidationModel {
  const apes = preds.map((pred, i) => Math.abs(pred - actuals[i]!) / actuals[i]!).sort((a, b) => a - b);
  const within = (factor: number): number =>
    Math.round((preds.filter((pred, i) => pred >= actuals[i]! / factor && pred <= actuals[i]! * factor).length / preds.length) * 1000) / 10;
  return {
    name,
    median_ape_pct: Math.round(quantile(apes, 0.5) * 1000) / 10,
    within_2x_pct: within(2),
    within_3x_pct: within(3),
  };
}

/** How many folds the cross-validation rotates through. */
export const VALIDATION_FOLDS = 5;

/** The maturity scale: 0.75x at listing, rising linearly to 1.20x after four tokenless years. */
export function maturityMultiplier(age: number | null): number {
  const ageForModel = age ?? 365;
  return 0.75 + (Math.min(Math.max(ageForModel, 0), 1460) / 1460) * 0.45;
}

/**
 * The previous version's full adjustment set, kept only as a backtest
 * candidate: 7-day TVL momentum (clamped to -50%..+100%, weight 0.35),
 * maturity, and chain breadth (+3% per extra chain, at most +15%). The
 * shipped model no longer applies the momentum or breadth terms — the
 * audit in validateModel is where that verdict comes from.
 */
function legacyAdjust(p: Protocol, asOf: string): number {
  const rawGrowth = typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : 0;
  const growthPct = Math.min(100, Math.max(-50, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * 0.35;
  const breadthMult = 1 + 0.03 * Math.min(Math.max(p.chains.length - 1, 0), 5);
  return growthMult * maturityMultiplier(ageDays(asOf, p.listed_at)) * breadthMult;
}

/**
 * The backtest: five-fold cross-validation over the usable traded peers.
 * Each peer's fold is a hash of its slug, so anyone can reproduce the
 * split from the snapshot alone. Every candidate is fit on four folds
 * and scored against the held-out fold's actual market caps, rotating
 * until every peer has been priced blind exactly once. Deterministic:
 * the same snapshot always produces the same report.
 *
 * The candidate list doubles as the model's adjustment audit. The last
 * candidate is the shipped board model, priced exactly as the board
 * prices — fitted curve, category level, maturity adjustment and all.
 * The candidate before it is the previous version's recipe (curve,
 * levels and all three adjustments): it is in the table so the reader
 * can see what removing momentum and breadth bought, in the open.
 */
export function validateModel(snapshot: Snapshot): ValidationReport {
  const usable = usablePeers(snapshot);
  const curveOnly = (p: Protocol, trainSnap: Snapshot): number => {
    const { fit } = fitFor(p, peerFits(trainSnap));
    return predict(fit, p.tvl_usd);
  };
  const candidates: { name: string; price: (p: Protocol, trainSnap: Snapshot) => number }[] = [
    {
      name: 'Global median multiple (one flat price)',
      price: (p, trainSnap) => p.tvl_usd * peerStats(trainSnap).global.median,
    },
    {
      name: 'Category median multiple (flat, per category)',
      price: (p, trainSnap) => {
        const { stats } = statsFor(p, peerStats(trainSnap));
        return p.tvl_usd * stats.median;
      },
    },
    {
      name: 'Global fitted curve (no category level)',
      price: (p, trainSnap) => predict(peerFits(trainSnap).global, p.tvl_usd),
    },
    {
      name: 'Fitted curve with category levels (no adjustments)',
      price: curveOnly,
    },
    {
      name: 'Curve + levels + momentum, maturity & breadth (previous recipe)',
      price: (p, trainSnap) => curveOnly(p, trainSnap) * legacyAdjust(p, trainSnap.as_of),
    },
    {
      name: 'Curve + levels + maturity (this board)',
      price: (p, trainSnap) => curveOnly(p, trainSnap) * maturityMultiplier(ageDays(trainSnap.as_of, p.listed_at)),
    },
  ];
  const preds = candidates.map(() => [] as number[]);
  const actuals: number[] = [];
  for (let fold = 0; fold < VALIDATION_FOLDS; fold++) {
    const test = usable.filter((p) => slugHash(p.slug) % VALIDATION_FOLDS === fold);
    const train = usable.filter((p) => slugHash(p.slug) % VALIDATION_FOLDS !== fold);
    const trainSnap: Snapshot = { ...snapshot, protocols: train };
    for (const p of test) {
      actuals.push(p.mcap_usd!);
      candidates.forEach((c, i) => preds[i]!.push(c.price(p, trainSnap)));
    }
  }
  const boardPreds = preds[preds.length - 1]!;
  const spread = [1.5, 2, 3, 5].map((factor) => ({
    factor,
    pct:
      Math.round(
        (boardPreds.filter((pred, i) => pred >= actuals[i]! / factor && pred <= actuals[i]! * factor).length /
          boardPreds.length) *
          1000,
      ) / 10,
  }));
  return {
    method:
      'Five-fold cross-validation by slug hash (FNV-1a mod 5). Every model is fit on four folds ' +
      'only and scored against the held-out fold\u2019s actual market caps, rotating until every ' +
      'usable peer has been priced blind exactly once. The board model is scored exactly as it ' +
      'ships \u2014 adjustments included \u2014 and the previous version\u2019s full adjustment set is ' +
      'scored beside it, so every adjustment this model keeps or drops has a published verdict.',
    usable_peers: usable.length,
    folds: VALIDATION_FOLDS,
    global_slope: peerFits(snapshot).global.slope,
    models: candidates.map((c, i) => scoreModel(c.name, preds[i]!, actuals)),
    board_spread: spread,
  };
}

function confidenceFor(stats: PeerStats): 'high' | 'medium' | 'low' {
  if (stats.peers >= 8) return 'high';
  if (stats.peers >= 4) return 'medium';
  return 'low';
}

/**
 * How likely a category is to launch a token at all, as a farming prior.
 * Categories that historically distribute ownership to users score high;
 * products that wrap or stake someone else's asset score low, because the
 * underlying token already exists. Stated openly on the dashboard.
 */
export function launchPrior(category: string | null): number {
  const c = (category ?? '').toLowerCase();
  if (c.includes('staking') || c.includes('restaking') || c.includes('staked')) return 0.3;
  if (c.includes('dex') || c.includes('derivative') || c.includes('perpetual')) return 0.8;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 0.78;
  if (c.includes('yield') || c.includes('farm') || c.includes('allocator') || c.includes('curator')) return 0.5;
  if (c === 'chain' || c.includes('rollup')) return 0.65;
  if (c.includes('bridge')) return 0.55;
  if (c.includes('rwa') || c.includes('basis')) return 0.45;
  if (c.includes('insurance') || c.includes('prediction')) return 0.5;
  return 0.5;
}

interface Scored {
  p: Protocol;
  stats: PeerStats;
  scope: 'category' | 'global';
  fit: FitStats;
  fitScope: 'category' | 'global';
  age: number | null;
  maturityMult: number;
  implied: number;
  low: number;
  high: number;
  medianImplied: number;
}

function score(
  p: Protocol,
  asOf: string,
  stats: PeerStats,
  scope: 'category' | 'global',
  fit: FitStats,
  fitScope: 'category' | 'global',
): Scored {
  const age = ageDays(asOf, p.listed_at);
  const maturityMult = maturityMultiplier(age);
  const apply = (base: number): number => Math.max(1, Math.round(base * maturityMult));
  const fitted = predict(fit, p.tvl_usd);
  return {
    p,
    stats,
    scope,
    fit,
    fitScope,
    age,
    maturityMult,
    implied: apply(fitted),
    low: apply(fitted * Math.exp(fit.resid_low)),
    high: apply(fitted * Math.exp(fit.resid_high)),
    medianImplied: apply(p.tvl_usd * stats.median),
  };
}

function firstChain(p: Protocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Position size for one farm wallet, scaled to the protocol's depth so the plan stays realistic. */
function capitalFor(tvl: number): number {
  if (tvl >= 1_000_000_000) return 200;
  if (tvl >= 250_000_000) return 120;
  if (tvl >= 50_000_000) return 80;
  return 40;
}

/** Gas wording by the chain the position lives on: Ethereum mainnet is priced honestly, the rest are cheap. */
function gasFor(chain: string): string {
  return chain === 'Ethereum' ? '$5-12 of ETH for gas on Ethereum mainnet' : '$1-3 of gas on a low-fee chain';
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The one core action per category family, written for the protocol's own record. */
function coreAction(p: Protocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Supply $${capital} of USDC as collateral in ${n} on ${chain}, then borrow no more than 40% against it and redeposit the borrowed USDC once, so both sides of the market see your wallet.`;
  if (c.includes('dex'))
    return `Swap $${capital} of USDC for the pool's paired asset on ${n}, add the two sides as liquidity on ${chain}, and leave the LP position untouched.`;
  if (c.includes('bridge'))
    return `Bridge $${capital} of USDC from Ethereum to ${chain} through ${n}, then make one swap or deposit with the bridged funds on the destination chain in the same session.`;
  if (c.includes('derivative') || c.includes('perpetual'))
    return `Deposit $${capital} of USDC as margin on ${n} and open one small position hedged with spot on ${chain}, sized so a 20% move cannot liquidate it.`;
  if (c.includes('staking') || c.includes('restaking'))
    return `Stake $${capital} of the chain's staking asset through ${n} on ${chain} and keep the staking receipt token in the same wallet.`;
  if (c.includes('yield') || c.includes('farm') || c.includes('allocator') || c.includes('curator'))
    return `Deposit $${capital} of USDC into an established ${n} vault on ${chain} and keep the vault shares in the wallet.`;
  if (c.includes('rwa'))
    return `Mint $${capital} of ${n}'s yield-bearing asset on ${chain} with USDC and hold it in the wallet.`;
  if (c.includes('basis'))
    return `Deposit $${capital} of USDC into ${n}'s basis strategy on ${chain} and keep the strategy shares.`;
  if (c.includes('chain') || c.includes('rollup'))
    return `Bridge $${capital} of USDC to ${n}'s chain, then use two native apps there (one swap, one lending deposit) so the wallet has real activity on the network.`;
  if (c.includes('insurance'))
    return `Buy $${capital} of protocol cover from ${n} on ${chain} for the longest term offered and keep the policy active.`;
  if (c.includes('prediction'))
    return `Fund the wallet with $${capital} and take one position in ${n}'s most liquid market on ${chain}.`;
  return `Deposit $${capital} of USDC into ${n} on ${chain} through its main product page and keep the position open.`;
}

/**
 * Eight farm steps for one protocol. Every step names its cost and its
 * time, and every number in the plan comes from the protocol's own
 * snapshot record (TVL band, age, chains, category) — no invented APY,
 * points or reward rates. The last step is the exit rule, set on day
 * one: most farm losses come from positions nobody decided how to end.
 */
export function farmSteps(p: Protocol, age: number | null): string[] {
  const chain = firstChain(p);
  const capital = capitalFor(p.tvl_usd);
  const gas = gasFor(chain);
  const hold = holdDaysFor(age);
  const chainCount = p.chains.length;
  const steps = [
    `Prepare a fresh farm wallet and fund it on ${chain} with $${capital} of USDC plus gas money; keep the seed phrase offline. Cost: ${gas} to fund. Time: 10 minutes.`,
    `${coreAction(p, capital, chain)} Cost: ${gas}, plus the $${capital} position itself. Time: 20 minutes to set up.`,
    `Repeat one small qualifying action on ${p.name} every week (a deposit top-up, a swap or a claim check) so the wallet shows a pattern, not a single visit. Cost: about $2 of gas a week. Time: 10 minutes a week.`,
    `Hold the position for at least ${hold} days; protocols this size usually snapshot activity over weeks, and a position younger than that risks counting for nothing. Cost: the $${capital} stays deployed. Time: ${hold} days.`,
    chainCount > 1
      ? `${p.name} runs on ${chainCount} chains; repeat the core action once on a second chain from its chain list so the wallet is visible in more than one deployment. Cost: ${gas} again. Time: 15 minutes.`
      : `Stay on ${chain} only: ${p.name} records all of its TVL there, so splitting the position across chains would add cost without adding signal. Cost: nothing extra. Time: 5 minutes to confirm.`,
    `Check ${p.name}'s own site and governance forum once a month for a points, rewards or token announcement, and claim only from links the protocol itself publishes. Cost: nothing to check, and never pay a fee to claim. Time: 10 minutes a month.`,
    `Log the wallet address, every transaction hash and the dates in a farm journal, so the position can be repeated, topped up or unwound without guesswork. Cost: nothing. Time: 5 minutes.`,
    `Set the exit rule before you need it: withdraw if ${p.name} sunsets the product, stops reporting TVL, or announces a snapshot date you cannot hold until; if a token does launch, claim only through the protocol's own announcement and make the hold-or-sell decision the same week, not by drift. Cost: gas to withdraw, about the same as the deposit. Time: 15 minutes.`,
  ];
  return steps.map((s) => (s.length > 600 ? `${s.slice(0, 596)}...` : s));
}

export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const peers = peerStats(snapshot);
  const fits = peerFits(snapshot);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, Protocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, Math.max(0, MAX_ROWS - chosen.size));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { stats, scope } = statsFor(p, peers);
    const { fit, scope: fitScope } = fitFor(p, fits);
    return score(p, snapshot.as_of, stats, scope, fit, fitScope);
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));
  const watch = new Set(snapshot.watchlist);
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
    watchlist: watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.low,
    implied_high_usd: s.high,
    launch_prior: launchPrior(s.p.category),
    confidence: confidenceFor(s.stats),
    model: {
      peer_median: s.stats.median,
      peer_low: s.stats.low,
      peer_high: s.stats.high,
      peers: s.stats.peers,
      peer_scope: s.scope,
      fit_intercept: s.fit.intercept,
      fit_slope: s.fit.slope,
      fit_scope: s.fitScope,
      median_implied_usd: s.medianImplied,
      farm_capital_usd: capitalFor(s.p.tvl_usd),
      maturity_multiplier: round4(s.maturityMult),
    },
    farm_steps: farmSteps(s.p, s.age),
  }));
}

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
      multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const peers = peerStats(snapshot);
  const categories = [...peers.byCategory.values()]
    .filter((s) => s.peers >= 3)
    .sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const fits = [...peerFits(snapshot).byCategory.values()]
    .filter((f) => f.peers >= MIN_FIT_PEERS)
    .sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model_summary: MODEL_SUMMARY,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !r.watchlist).length,
    pre_token_size: snapshot.protocols.filter(isPreToken).length,
    live_size: snapshot.protocols.filter((p) => !isPreToken(p)).length,
    categories,
    fits,
    global_fit: peerFits(snapshot).global,
    validation: validateModel(snapshot),
    rows: board,
    live: liveRows(snapshot),
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('snapshot.json is not an object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new Error('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new Error('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !(o.floor_usd > 0)) throw new Error('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new Error('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new Error('snapshot.json has no watchlist');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number') {
      throw new Error(`protocol ${i} lacks slug, name or tvl_usd`);
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
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Gate self-check, mirroring the scorer's board rows: coverage, ranks, order, steps, values. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `board misses watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100 || board.length > 4000) return `board has ${board.length} rows`;
  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (r.rank !== i + 1) return `row ${i} has rank ${r.rank}`;
    if (i > 0 && r.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${r.slug} outranks the row above it`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has a bad implied value`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} chars`;
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) return 'all rows share one implied value';
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
