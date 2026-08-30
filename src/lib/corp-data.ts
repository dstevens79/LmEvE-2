// Unified server-DB read layer for the SPA pages.
//
// Every page reads cached rows from the app database (populated by the cron
// poller + manual sync), maps snake_case rows to the UI interfaces, and
// resolves numeric IDs to human-readable names:
//   - type ids  -> SDE invTypes via /api/sde/get-type-names.php
//   - universe/system/character/location ids -> ESI via /api/lmeve/get-names.php
// Both name lookups are cached (server-side) so repeat loads stay fast.

import type {
  Member,
  Asset,
  ManufacturingJob,
  WalletTransaction,
  WalletDivision,
  MarketOrder,
  MiningOperation,
  KillmailSummary,
  Contract,
  IncomeRecord,
  MarketPrice,
} from './types';

// ---------------------------------------------------------------------------
// Row access helpers (DB rows arrive as plain objects of strings/numbers/null)
// ---------------------------------------------------------------------------

type DbRow = Record<string, any>;

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}
function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

// MySQL datetimes are UTC in this app's DB. Return ISO strings for the UI.
function dtToIso(v: unknown): string {
  const s = str(v).trim();
  if (!s) return '';
  // 'YYYY-MM-DD HH:MM:SS' or date-only; treat as UTC to match ESI timestamps.
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  const t = d.getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}

// ---------------------------------------------------------------------------
// Name resolution (module-level caches; dedupe in-flight requests)
// ---------------------------------------------------------------------------

const typeCache = new Map<number, string>();
let typeInflight: Promise<void> | null = null;

/** Resolve EVE type ids via the SDE table (fast path for ships/ores/items). */
export async function resolveTypeNames(typeIds: number[]): Promise<Map<number, string>> {
  const unique = Array.from(new Set(typeIds.filter(id => Number.isFinite(id) && id > 0)));
  const missing = unique.filter(id => !typeCache.has(id));

  if (missing.length > 0 && !typeInflight) {
    typeInflight = (async () => {
      try {
        for (const chunk of chunks(missing, 500)) {
          try {
            const resp = await fetch('/api/sde/get-type-names.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ typeIds: chunk }),
            });
            if (!resp.ok) continue;
            const json = await resp.json().catch(() => null);
            if (json?.ok && Array.isArray(json.rows)) {
              for (const row of json.rows as DbRow[]) {
                const id = num(row.typeID ?? row.type_id);
                const name = str(row.typeName ?? row.type_name);
                if (id > 0 && name !== '') typeCache.set(id, name);
              }
            }
          } catch { /* non-fatal */ }
        }
      } finally {
        typeInflight = null;
      }
    })();
    await typeInflight;
  }

  const out = new Map<number, string>();
  for (const id of unique) out.set(id, typeCache.get(id) || '');
  return out;
}

// universe/system/character/location names via ESI + server name_cache.
interface NamesKind { kind: 'universe' | 'characters' | 'systems' }
const uniCache = new Map<string, string>(); // key `${kind}:${id}`
const uniInflight = new Map<NamesKind['kind'], Promise<void>>();

async function resolveUniNames(kind: NamesKind['kind'], ids: number[]): Promise<Map<number, string>> {
  const unique = Array.from(new Set(ids.filter(id => Number.isFinite(id) && id > 0)));
  for (const id of unique) {
    if (!uniCache.has(`${kind}:${id}`)) {
      let p = uniInflight.get(kind);
      if (!p) {
        const missing = unique.filter(x => !uniCache.has(`${kind}:${x}`));
        p = (async () => {
          try {
            for (const chunk of chunks(missing, kind === 'characters' ? 100 : 500)) {
              try {
                const resp = await fetch('/api/lmeve/get-names.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ ids: chunk, kind }),
                });
                if (!resp.ok) continue;
                const json = await resp.json().catch(() => null);
                if (json?.ok && json.names && typeof json.names === 'object') {
                  for (const [idStr, name] of Object.entries(json.names as Record<string, string>)) {
                    const id = parseInt(idStr, 10);
                    if (Number.isFinite(id) && name) uniCache.set(`${kind}:${id}`, name);
                  }
                }
              } catch { /* non-fatal */ }
            }
          } finally {
            uniInflight.delete(kind);
          }
        })();
        uniInflight.set(kind, p);
      }
    }
  }
  // Await any in-flight resolution for this kind so results are fresh.
  const pending = uniInflight.get(kind);
  if (pending) await pending;

  const out = new Map<number, string>();
  for (const id of unique) out.set(id, uniCache.get(`${kind}:${id}`) || '');
  return out;
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// DB fetch helper
// ---------------------------------------------------------------------------

async function dbRows(endpoint: string, body: Record<string, unknown>): Promise<DbRow[]> {
  const resp = await fetch(`/api/lmeve/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${endpoint} failed (HTTP ${resp.status})`);
  const json = await resp.json().catch(() => null);
  if (!json || json.ok !== true || !Array.isArray(json.rows)) {
    throw new Error(endpoint + ': ' + (json?.error || 'bad response'));
  }
  return json.rows as DbRow[];
}

// ---------------------------------------------------------------------------
// Read functions (rows -> UI types)
// ---------------------------------------------------------------------------

export async function fetchMembers(corpId: number): Promise<Member[]> {
  const rows = await dbRows('get-characters.php', { corporationId: corpId, limit: 2000 });
  return rows.map(r => {
    const rolesRaw = r.roles;
    let roles: string[] = [];
    if (Array.isArray(rolesRaw)) roles = rolesRaw.map(String);
    else if (typeof rolesRaw === 'string' && rolesRaw) { try { const p = JSON.parse(rolesRaw); if (Array.isArray(p)) roles = p.map(String); } catch {} }
    let titles: string[] = [];
    if (Array.isArray(r.titles)) titles = r.titles.map(String);
    else if (typeof r.titles === 'string' && r.titles) { try { const p = JSON.parse(r.titles); if (Array.isArray(p)) titles = p.map(String); } catch {} }
    return {
      id: num(r.id),
      characterId: num(r.character_id),
      characterName: str(r.character_name),
      name: str(r.character_name),
      corporationId: num(r.corporation_id),
      corporationName: str(r.corporation_name),
      allianceId: r.alliance_id ? num(r.alliance_id) : undefined,
      allianceName: str(r.alliance_name) || undefined,
      roles,
      titles,
      title: titles[0] || (roles.includes('CEO') ? 'CEO' : undefined),
      lastLogin: dtToIso(r.last_login) || undefined,
      location: str(r.location_name) || undefined,
      ship: str(r.ship_type_name) || undefined,
      shipTypeId: r.ship_type_id ? num(r.ship_type_id) : undefined,
      isOnline: bool(r.is_online),
      isActive: r.is_active === undefined ? true : bool(r.is_active),
      accessLevel: (str(r.access_level) as any) || 'member',
      joinDate: dtToIso(r.joined_date) || undefined,
    } as Member;
  });
}

export async function fetchAssets(corpId: number): Promise<Asset[]> {  const rows = await dbRows('get-assets.php', { ownerId: corpId, limit: 5000 });
  const typeNames = await resolveTypeNames(rows.map(r => num(r.type_id)));
  return rows.map(r => ({
    id: String(num(r.item_id) || num(r.id)),
    itemId: num(r.item_id),
    typeId: num(r.type_id),
    typeName: typeNames.get(num(r.type_id)) || `Type ${num(r.type_id)}`,
    quantity: num(r.quantity),
    locationId: r.location_id ? num(r.location_id) : undefined,
    locationName: str(r.location_name) || undefined,
    locationType: (str(r.location_type) as any) || (str(r.location_flag) ? 'container' : 'station'),
    locationFlag: str(r.location_flag) || undefined,
    isSingleton: bool(r.is_singleton),
    isBlueprintCopy: r.is_blueprint_copy === null || r.is_blueprint_copy === undefined ? undefined : bool(r.is_blueprint_copy),
    ownerId: r.owner_id ? num(r.owner_id) : undefined,
    estimatedValue: 0,
    lastUpdate: dtToIso(r.last_updated) || new Date().toISOString(),
  }));
}

// EVE industry activity ids (SDE invActivity): 1=Copy, 2=Invention, 3=Manufacture, 4=Decryption, 5=Research.
export const JOB_ACTIVITY_NAMES: Record<number, string> = {
  1: 'Copy', 2: 'Invention', 3: 'Manufacturing', 4: 'Decryption', 5: 'Research',
};

export async function fetchIndustryJobs(corpId: number): Promise<ManufacturingJob[]> {
  const rows = await dbRows('get-industry-jobs.php', { corporationId: corpId, limit: 2000 });
  const typeIds = rows.flatMap(r => [num(r.blueprint_type_id), num(r.product_type_id)]).filter(v => v > 0);
  const typeNames = await resolveTypeNames(typeIds);
  return rows.map(r => {
    const bpId = num(r.blueprint_type_id);
    const prodId = num(r.product_type_id);
    return {
      id: String(num(r.job_id)),
      jobId: num(r.job_id),
      installerId: num(r.installer_id),
      installerName: '', // resolved by the page from members list when available
      facilityId: num(r.facility_id),
      facility: str(r.facility_name) || `Facility ${num(r.facility_id)}`,
      blueprintId: bpId,
      blueprintTypeId: bpId,
      blueprintName: typeNames.get(bpId) || `Blueprint ${bpId}`,
      productTypeId: prodId,
      productTypeName: typeNames.get(prodId) || `Product ${prodId}`,
      runs: num(r.runs),
      cost: 0,
      status: (str(r.status).toLowerCase() as any) || 'active',
      duration: num(r.duration),
      startDate: dtToIso(r.start_date) || '',
      endDate: dtToIso(r.end_date) || '',
      completedDate: dtToIso(r.completed_date) || undefined,
      productQuantity: 1,
      activityId: num(r.activity_id),
    } as ManufacturingJob;
  });
}

export async function fetchMarketOrders(corpId: number): Promise<MarketOrder[]> {
  const rows = await dbRows('get-market-orders.php', { corporationId: corpId, limit: 2000 });
  const typeNames = await resolveTypeNames(rows.map(r => num(r.type_id)));
  const regionNames = await resolveUniNames('universe', rows.map(r => num(r.region_id)).filter(v => v > 0));
  return rows.map(r => ({
    id: num(r.id),
    orderId: num(r.order_id),
    typeId: num(r.type_id),
    typeName: typeNames.get(num(r.type_id)) || `Type ${num(r.type_id)}`,
    locationId: r.location_id ? num(r.location_id) : undefined,
    locationName: str(r.location_name) || (r.region_id ? regionNames.get(num(r.region_id)) || `Region ${num(r.region_id)}` : ''),
    isBuyOrder: bool(r.is_buy_order),
    price: num(r.price),
    volumeTotal: num(r.volume_total),
    volumeRemain: num(r.volume_remain),
    minVolume: r.min_volume === null || r.min_volume === undefined ? undefined : num(r.min_volume),
    issued: dtToIso(r.issued) || '',
    duration: num(r.duration),
    // market_orders.state holds the order range (day/week/month/year); these are open orders.
    state: 'active',
    corporationId: corpId,
  }));
}

export async function fetchWalletTransactions(corpId: number): Promise<WalletTransaction[]> {
  const rows = await dbRows('get-wallet-transactions.php', { corporationId: corpId, limit: 1000 });
  const typeNames = await resolveTypeNames(rows.map(r => num(r.type_id)));
  return rows.map(r => ({
    id: num(r.id),
    transactionId: num(r.transaction_id),
    date: dtToIso(r.date) || '',
    typeId: num(r.type_id),
    typeName: typeNames.get(num(r.type_id)) || `Type ${num(r.type_id)}`,
    quantity: num(r.quantity),
    unitPrice: num(r.unit_price),
    amount: Math.round(num(r.unit_price) * num(r.quantity)),
    clientId: r.client_name ? 0 : num(r.client_id),
    clientName: str(r.client_name) || (r.client_id ? `Character ${num(r.client_id)}` : 'Unknown'),
    locationId: r.location_id ? num(r.location_id) : undefined,
    isBuy: bool(r.is_buy),
    // ESI corp wallet transactions carry no personal flag — the whole ledger is corp.
    isPersonal: false,
    journalRefId: r.journal_ref_id ? num(r.journal_ref_id) : 0,
    divisionId: r.division ? num(r.division) : undefined,
  }));
}

export async function fetchWalletDivisions(corpId: number): Promise<WalletDivision[]> {
  const rows = await dbRows('get-wallet-divisions.php', { corporationId: corpId });
  return rows.map(r => ({
    id: num(r.id),
    divisionId: num(r.division_id),
    divisionName: str(r.division_name) || `Division ${num(r.division_id)}`,
    balance: num(r.balance),
    corporationId: corpId,
    lastUpdate: dtToIso(r.last_updated) || undefined,
  }));
}

export async function fetchMiningLedger(corpId: number): Promise<MiningOperation[]> {
  const rows = await dbRows('get-mining-ledger.php', { corporationId: corpId, limit: 500 });
  if (rows.length === 0) return [];
  const typeNames = await resolveTypeNames(rows.map(r => num(r.type_id)));
  const systemNames = await resolveUniNames('systems', rows.map(r => num(r.solar_system_id)).filter(v => v > 0));
  // Miner names: pull from members if cheap — fall back to id label.
  return rows.map(r => ({
    id: `${num(r.id)}-${str(r.date)}`,
    date: dtToIso(r.date) || str(r.date),
    minerId: num(r.character_id),
    minerName: str(r.character_name) || `Character ${num(r.character_id)}`,
    systemId: num(r.solar_system_id),
    system: systemNames.get(num(r.solar_system_id)) || `System ${num(r.solar_system_id)}`,
    oreTypeId: num(r.type_id),
    ore: typeNames.get(num(r.type_id)) || `Type ${num(r.type_id)}`,
    quantity: num(r.quantity),
    estimatedValue: 0, // priced client-side via market_prices when available
    refined: false,
  }));
}

export interface ContractItemView {
  recordId: number;
  typeId: number;
  typeName: string;
  quantity: number;
  isSingleton: boolean;
}

export interface ContractRow extends Contract {
  items?: ContractItemView[];
}

export async function fetchContracts(corpId: number): Promise<ContractRow[]> {
  const resp = await fetch('/api/lmeve/get-contracts.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ corporationId: corpId }),
  });
  if (!resp.ok) throw new Error(`get-contracts failed (HTTP ${resp.status})`);
  const json = await resp.json().catch(() => null);
  if (!json || json.ok !== true) throw new Error('get-contracts: ' + (json?.error || 'bad response'));
  const rows = Array.isArray(json.rows) ? (json.rows as DbRow[]) : [];
  const items = Array.isArray(json.items) ? (json.items as DbRow[]) : [];

  const typeNames = await resolveTypeNames(items.map(r => num(r.type_id)).filter(v => v > 0));

  const itemsByContract = new Map<number, ContractItemView[]>();
  for (const it of items) {
    const cid = num(it.contract_id);
    const view: ContractItemView = {
      recordId: num(it.record_id),
      typeId: num(it.type_id),
      typeName: typeNames.get(num(it.type_id)) || `Type ${num(it.type_id)}`,
      quantity: num(it.quantity),
      isSingleton: bool(it.is_singleton),
    };
    const list = itemsByContract.get(cid) || [];
    list.push(view);
    itemsByContract.set(cid, list);
  }

  return rows.map(r => {
    const cid = num(r.contract_id);
    return {
      contractId: cid,
      corporationId: num(r.corporation_id),
      issuerCharacterId: r.issuer_id ? num(r.issuer_id) : undefined,
      assigneeCharacterId: r.assignee_id ? num(r.assignee_id) : undefined,
      acceptorCharacterId: r.acceptor_id ? num(r.acceptor_id) : undefined,
      contractType: str(r.type),
      status: (str(r.status).toLowerCase() as any) || 'outstanding',
      title: str(r.title) || `Contract ${cid}`,
      forCorporation: bool(r.for_corporation),
      availability: (str(r.availability) as any) || undefined,
      dateIssued: dtToIso(r.date_issued) || undefined,
      dateExpired: dtToIso(r.date_expired) || undefined,
      dateAccepted: dtToIso(r.date_accepted) || undefined,
      dateCompleted: dtToIso(r.date_completed) || undefined,
      price: r.price === null ? undefined : num(r.price),
      reward: r.reward === null ? undefined : num(r.reward),
      collateral: r.collateral === null ? undefined : num(r.collateral),
      items: itemsByContract.get(cid),
    } as ContractRow;
  });
}

export async function fetchIncome(corpId: number): Promise<IncomeRecord[]> {
  const rows = await dbRows('get-income.php', { corporationId: corpId, limit: 2000 });
  if (rows.length === 0) return [];
  // Server derives values at read time; type names come from SDE here.
  const typeNames = await resolveTypeNames(rows.map(r => num(r.product_type_id)).filter(v => v > 0));
  return rows.map(r => {
    const prodId = num(r.product_type_id);
    return {
      ...r,
      pilotName: str(r.pilotName) || `Character ${num(r.pilotId)}`,
      productTypeName: typeNames.get(prodId) || (str(r.itemTypeName) || `Product ${prodId}`),
      itemTypeName: typeNames.get(prodId) || (str(r.itemTypeName) || ''),
    } as IncomeRecord;
  });
}

export async function fetchMarketPrices(): Promise<MarketPrice[]> {
  const rows = await dbRows('get-market-prices.php', {});
  if (rows.length === 0) return [];
  const typeNames = await resolveTypeNames(rows.map(r => num(r.type_id)));
  return rows.map(r => ({
    typeId: num(r.type_id),
    typeName: typeNames.get(num(r.type_id)) || `Type ${num(r.type_id)}`,
    regionId: 0, // /markets/prices is global — no per-region granularity in ESI
    region: 'Universal',
    buyPrice: 0, // not exposed by the prices endpoint; adjusted price is the standard reference
    sellPrice: num(r.adjusted_price),
    averagePrice: r.average_price === null || r.average_price === undefined ? undefined : num(r.average_price),
    adjustedPrice: r.adjusted_price === null || r.adjusted_price === undefined ? undefined : num(r.adjusted_price),
    volume: 0,
    lastUpdate: dtToIso(r.last_updated) || new Date().toISOString(),
  }));
}

export interface CompletedSaleView {
  id: string;
  date: string;
  typeId: number;
  typeName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  profit: number;
  profitMargin: number;
  locationId: number;
  locationName: string;
}

export async function fetchCompletedSales(corpId: number): Promise<CompletedSaleView[]> {
  const rows = await dbRows('get-market-order-history.php', { corporationId: corpId, limit: 500 });
  if (rows.length === 0) return [];
  const typeNames = await resolveTypeNames(rows.map(r => num(r.type_id)).filter(v => v > 0));
  // ESI's closed-orders history has no completion date or cost basis — orders are
  // dated by issue and profit is not derivable without cost data.
  return rows.map(r => {
    const locationId = r.location_id ? num(r.location_id) : 0;
    return {
      id: String(num(r.order_id)),
      date: dtToIso(r.issued) || '',
      typeId: num(r.type_id),
      typeName: typeNames.get(num(r.type_id)) || `Type ${num(r.type_id)}`,
      quantity: num(r.volume_total),
      unitPrice: num(r.price),
      totalValue: Math.round(num(r.price) * num(r.volume_total)),
      profit: 0,
      profitMargin: 0,
      locationId,
      locationName: r.region_id ? `Region ${num(r.region_id)}` : '',
    };
  });
}

export async function fetchKillmails(corpId: number): Promise<KillmailSummary[]> {
  const rows = await dbRows('get-killmails.php', { corporationId: corpId, limit: 200 });
  if (rows.length === 0) return [];
  const systemNames = await resolveUniNames('systems', rows.map(r => num(r.solar_system_id)).filter(v => v > 0));
  const typeNames = await resolveTypeNames(rows.map(r => num(r.victim_ship_type_id)).filter(v => v > 0));

  return rows.map(r => {
    const sid = num(r.solar_system_id);
    const victimCharId = r.victim_character_id ? num(r.victim_character_id) : 0;
    return {
      id: String(num(r.killmail_id) || num(r.id)),
      killmailHash: str(r.killmail_hash) || undefined,
      timestamp: dtToIso(r.killmail_time) || '',
      systemId: sid,
      systemName: systemNames.get(sid) || `System ${sid}`,
      regionId: 0,
      regionName: '',
      victim: {
        characterId: victimCharId > 0 ? victimCharId : undefined,
        corporationId: num(r.victim_corporation_id),
        corporationName: corpId === num(r.victim_corporation_id) ? '' : `Corp ${num(r.victim_corporation_id)}`,
        shipTypeId: num(r.victim_ship_type_id),
        shipTypeName: typeNames.get(num(r.victim_ship_type_id)) || 'Ship',
        damageTaken: num(r.victim_damage_taken),
      },
      attackers: [],
      attackerCount: num(r.attacker_count) || 0,
      totalValue: r.total_value === null ? 0 : num(r.total_value),
      isCorpLoss: true, // killmails table only stores corp losses (victim = this corp)
      isCorpKill: false,
    } as KillmailSummary;
  });
}
