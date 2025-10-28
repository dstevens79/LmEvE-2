import { fetchESI, getESIAccessToken } from './eveApi';
import type {
  ESIMemberData,
  ESIAssetData,
  ESIIndustryJobData,
  ESIMarketOrderData,
  ESIWalletTransactionData,
  ESIMiningLedgerData,
  ESIContainerLogData,
  ESIContractData,
  ESIContractItemData
} from './database';

export interface ESIFetchOptions {
  corporationId: number;
  accessToken: string;
  useCache?: boolean;
  maxPages?: number;
}

export interface ESIFetchResult<T> {
  success: boolean;
  data: T[];
  error?: string;
  cached?: boolean;
  etag?: string;
  pages?: number;
}

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class ESIDataFetchService {
  private etags: Map<string, string> = new Map();
  private cache: Map<string, any> = new Map();

  async fetchWithRetry<T>(
    url: string,
    accessToken: string,
    retries: number = MAX_RETRIES
  ): Promise<{ data: T; etag?: string; fromCache?: boolean }> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const cacheKey = url;
        const etag = this.etags.get(cacheKey);
        
        const headers: HeadersInit = {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        };

        if (etag) {
          headers['If-None-Match'] = etag;
        }

        const response = await fetch(url, { headers });

        if (response.status === 304) {
          console.log(`📦 Using cached data for ${url}`);
          return {
            data: this.cache.get(cacheKey),
            fromCache: true,
            etag
          };
        }

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('X-ESI-Error-Limit-Reset') || '60');
          console.warn(`⏳ Rate limited. Retrying after ${retryAfter}s...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (!response.ok) {
          throw new Error(`ESI request failed: ${response.status} ${response.statusText}`);
        }

        const newEtag = response.headers.get('ETag');
        if (newEtag) {
          this.etags.set(cacheKey, newEtag);
        }

        const data = await response.json();
        this.cache.set(cacheKey, data);

        return { data, etag: newEtag || undefined };
      } catch (error) {
        if (attempt === retries - 1) {
          throw error;
        }
        console.warn(`⚠️ Attempt ${attempt + 1} failed, retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }

    throw new Error('Max retries exceeded');
  }

  async fetchPaginated<T>(
    baseUrl: string,
    accessToken: string,
    maxPages: number = 10
  ): Promise<T[]> {
    const allData: T[] = [];
    let page = 1;

    while (page <= maxPages) {
      const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page}`;
      const result = await this.fetchWithRetry<T[]>(url, accessToken);

      if (!result.data || result.data.length === 0) {
        break;
      }

      allData.push(...result.data);
      
      if (result.data.length < 1000) {
        break;
      }

      page++;
    }

    return allData;
  }

  async fetchCorporationMembersDetailed(options: ESIFetchOptions): Promise<ESIFetchResult<ESIMemberData>> {
    try {
      console.log(`📥 Fetching corporation members for corp ${options.corporationId}`);

      const url = `${ESI_BASE_URL}/corporations/${options.corporationId}/members/`;
      const result = await this.fetchWithRetry<number[]>(url, options.accessToken);

      const membersData: ESIMemberData[] = result.data.map(characterId => ({
        character_id: characterId,
        corporation_id: options.corporationId,
      }));

      for (const member of membersData) {
        try {
          const charUrl = `${ESI_BASE_URL}/characters/${member.character_id}/`;
          const charResult = await this.fetchWithRetry<any>(charUrl, options.accessToken);
          
          member.character_name = charResult.data.name;
          member.corporation_name = charResult.data.corporation_id ? await this.getCorporationName(charResult.data.corporation_id, options.accessToken) : undefined;
          member.alliance_id = charResult.data.alliance_id;
          if (member.alliance_id) {
            member.alliance_name = await this.getAllianceName(member.alliance_id, options.accessToken);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch details for character ${member.character_id}:`, error);
        }
      }

      console.log(`✅ Fetched ${membersData.length} corporation members`);
      return {
        success: true,
        data: membersData,
        cached: result.fromCache,
        etag: result.etag
      };
    } catch (error) {
      console.error('❌ Failed to fetch corporation members:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fetchCorporationAssetsDetailed(options: ESIFetchOptions): Promise<ESIFetchResult<ESIAssetData>> {
    try {
      console.log(`📥 Fetching corporation assets for corp ${options.corporationId}`);

      const url = `${ESI_BASE_URL}/corporations/${options.corporationId}/assets/`;
      const assetsRaw = await this.fetchPaginated<any>(url, options.accessToken, options.maxPages || 10);

      const assetsData: ESIAssetData[] = assetsRaw.map(asset => ({
        item_id: asset.item_id,
        type_id: asset.type_id,
        quantity: asset.quantity,
        location_id: asset.location_id,
        location_flag: asset.location_flag,
        owner_id: options.corporationId,
        is_singleton: asset.is_singleton,
        is_blueprint_copy: asset.is_blueprint_copy,
        blueprint_runs: asset.blueprint_runs,
        material_efficiency: asset.material_efficiency,
        time_efficiency: asset.time_efficiency,
      }));

      for (const asset of assetsData) {
        try {
          const typeName = await this.getTypeName(asset.type_id);
          asset.type_name = typeName;
        } catch (error) {
          console.warn(`⚠️ Failed to fetch type name for type ${asset.type_id}`);
        }
      }

      console.log(`✅ Fetched ${assetsData.length} corporation assets`);
      return {
        success: true,
        data: assetsData,
        pages: Math.ceil(assetsRaw.length / 1000)
      };
    } catch (error) {
      console.error('❌ Failed to fetch corporation assets:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fetchIndustryJobsDetailed(options: ESIFetchOptions): Promise<ESIFetchResult<ESIIndustryJobData>> {
    try {
      console.log(`📥 Fetching industry jobs for corp ${options.corporationId}`);

      const url = `${ESI_BASE_URL}/corporations/${options.corporationId}/industry/jobs/`;
      const result = await this.fetchWithRetry<any[]>(url, options.accessToken);

      const jobsData: ESIIndustryJobData[] = result.data.map(job => ({
        job_id: job.job_id,
        installer_id: job.installer_id,
        facility_id: job.facility_id,
        station_id: job.station_id,
        blueprint_id: job.blueprint_id,
        blueprint_type_id: job.blueprint_type_id,
        output_location_id: job.output_location_id,
        runs: job.runs,
        cost: job.cost,
        product_type_id: job.product_type_id,
        product_quantity: job.runs,
        status: job.status,
        duration: job.duration,
        start_date: job.start_date,
        end_date: job.end_date,
        completed_date: job.completed_date,
        activity_id: job.activity_id,
      }));

      for (const job of jobsData) {
        try {
          if (job.blueprint_type_id) {
            job.blueprint_type_name = await this.getTypeName(job.blueprint_type_id);
          }
          if (job.product_type_id) {
            job.product_type_name = await this.getTypeName(job.product_type_id);
          }
          if (job.facility_id) {
            job.facility_name = await this.getStationName(job.facility_id, options.accessToken);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch names for job ${job.job_id}`);
        }
      }

      console.log(`✅ Fetched ${jobsData.length} industry jobs`);
      return {
        success: true,
        data: jobsData,
        cached: result.fromCache,
        etag: result.etag
      };
    } catch (error) {
      console.error('❌ Failed to fetch industry jobs:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fetchMarketOrdersDetailed(options: ESIFetchOptions): Promise<ESIFetchResult<ESIMarketOrderData>> {
    try {
      console.log(`📥 Fetching market orders for corp ${options.corporationId}`);

      const url = `${ESI_BASE_URL}/corporations/${options.corporationId}/orders/`;
      const result = await this.fetchWithRetry<any[]>(url, options.accessToken);

      const ordersData: ESIMarketOrderData[] = result.data.map(order => ({
        order_id: order.order_id,
        type_id: order.type_id,
        location_id: order.location_id,
        region_id: order.region_id,
        price: order.price,
        volume_total: order.volume_total,
        volume_remain: order.volume_remain,
        min_volume: order.min_volume,
        duration: order.duration,
        is_buy_order: order.is_buy_order,
        issued: order.issued,
        range: order.range,
      }));

      for (const order of ordersData) {
        try {
          order.type_name = await this.getTypeName(order.type_id);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch type name for order ${order.order_id}`);
        }
      }

      console.log(`✅ Fetched ${ordersData.length} market orders`);
      return {
        success: true,
        data: ordersData,
        cached: result.fromCache,
        etag: result.etag
      };
    } catch (error) {
      console.error('❌ Failed to fetch market orders:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fetchWalletDataDetailed(
    options: ESIFetchOptions & { division: number }
  ): Promise<ESIFetchResult<ESIWalletTransactionData>> {
    try {
      console.log(`📥 Fetching wallet transactions for corp ${options.corporationId}, division ${options.division}`);

      const url = `${ESI_BASE_URL}/corporations/${options.corporationId}/wallets/${options.division}/transactions/`;
      const transactionsRaw = await this.fetchPaginated<any>(url, options.accessToken, options.maxPages || 10);

      const transactionsData: ESIWalletTransactionData[] = transactionsRaw.map(tx => ({
        transaction_id: tx.transaction_id,
        client_id: tx.client_id,
        date: tx.date,
        is_buy: tx.is_buy,
        is_personal: tx.is_personal,
        journal_ref_id: tx.journal_ref_id,
        location_id: tx.location_id,
        quantity: tx.quantity,
        type_id: tx.type_id,
        unit_price: tx.unit_price,
      }));

      for (const tx of transactionsData) {
        try {
          tx.type_name = await this.getTypeName(tx.type_id);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch type name for transaction ${tx.transaction_id}`);
        }
      }

      console.log(`✅ Fetched ${transactionsData.length} wallet transactions`);
      return {
        success: true,
        data: transactionsData,
        pages: Math.ceil(transactionsRaw.length / 1000)
      };
    } catch (error) {
      console.error('❌ Failed to fetch wallet transactions:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fetchMiningLedgerDetailed(options: ESIFetchOptions): Promise<ESIFetchResult<ESIMiningLedgerData>> {
    try {
      console.log(`📥 Fetching mining ledger for corp ${options.corporationId}`);

      const url = `${ESI_BASE_URL}/corporation/${options.corporationId}/mining/observers/`;
      const observersRaw = await this.fetchPaginated<any>(url, options.accessToken, options.maxPages || 5);

      const miningData: ESIMiningLedgerData[] = [];

      for (const observer of observersRaw) {
        const observerUrl = `${ESI_BASE_URL}/corporation/${options.corporationId}/mining/observers/${observer.observer_id}/`;
        const observerData = await this.fetchPaginated<any>(observerUrl, options.accessToken);

        for (const entry of observerData) {
          miningData.push({
            character_id: entry.character_id,
            date: entry.last_updated,
            type_id: entry.type_id,
            quantity: entry.quantity,
            system_id: observer.observer_type === 'structure' ? 0 : 0,
          });
        }
      }

      for (const entry of miningData) {
        try {
          entry.type_name = await this.getTypeName(entry.type_id);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch type name for mining entry`);
        }
      }

      console.log(`✅ Fetched ${miningData.length} mining ledger entries`);
      return {
        success: true,
        data: miningData
      };
    } catch (error) {
      console.error('❌ Failed to fetch mining ledger:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fetchContainerLogsDetailed(options: ESIFetchOptions): Promise<ESIFetchResult<ESIContainerLogData>> {
    try {
      console.log(`📥 Fetching container logs for corp ${options.corporationId}`);

      const url = `${ESI_BASE_URL}/corporations/${options.corporationId}/containers/logs/`;
      const logsRaw = await this.fetchPaginated<any>(url, options.accessToken, options.maxPages || 5);

      const logsData: ESIContainerLogData[] = logsRaw.map(log => ({
        logged_at: log.logged_at,
        location_id: log.location_id,
        location_flag: log.location_flag,
        action: log.action,
        character_id: log.character_id,
        type_id: log.type_id,
        quantity: log.quantity,
      }));

      for (const log of logsData) {
        try {
          log.type_name = await this.getTypeName(log.type_id);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch type name for container log`);
        }
      }

      console.log(`✅ Fetched ${logsData.length} container log entries`);
      return {
        success: true,
        data: logsData,
        pages: Math.ceil(logsRaw.length / 1000)
      };
    } catch (error) {
      console.error('❌ Failed to fetch container logs:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fetchCorporationContractsDetailed(options: ESIFetchOptions): Promise<ESIFetchResult<any>> {
    try {
      console.log(`📥 Fetching corporation contracts for corp ${options.corporationId}`);

      const url = `${ESI_BASE_URL}/corporations/${options.corporationId}/contracts/`;
      const contractsRaw = await this.fetchPaginated<any>(url, options.accessToken, options.maxPages || 10);

      const contractsData = contractsRaw.map(contract => ({
        contract_id: contract.contract_id,
        issuer_id: contract.issuer_id,
        issuer_corporation_id: contract.issuer_corporation_id,
        assignee_id: contract.assignee_id,
        acceptor_id: contract.acceptor_id,
        start_location_id: contract.start_location_id,
        end_location_id: contract.end_location_id,
        type: contract.type,
        status: contract.status,
        title: contract.title,
        for_corporation: contract.for_corporation,
        availability: contract.availability,
        date_issued: contract.date_issued,
        date_expired: contract.date_expired,
        date_accepted: contract.date_accepted,
        date_completed: contract.date_completed,
        days_to_complete: contract.days_to_complete,
        price: contract.price,
        reward: contract.reward,
        collateral: contract.collateral,
        buyout: contract.buyout,
        volume: contract.volume,
      }));

      console.log(`✅ Fetched ${contractsData.length} corporation contracts`);
      return {
        success: true,
        data: contractsData,
        pages: Math.ceil(contractsRaw.length / 1000)
      };
    } catch (error) {
      console.error('❌ Failed to fetch corporation contracts:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async fetchContractItemsDetailed(options: ESIFetchOptions & { contractId: number }): Promise<ESIFetchResult<any>> {
    try {
      console.log(`📥 Fetching items for contract ${options.contractId}`);

      const url = `${ESI_BASE_URL}/corporations/${options.corporationId}/contracts/${options.contractId}/items/`;
      const result = await this.fetchWithRetry<any[]>(url, options.accessToken);

      const itemsData = result.data.map((item, index) => ({
        contract_id: options.contractId,
        record_id: item.record_id || index,
        type_id: item.type_id,
        quantity: item.quantity,
        is_included: item.is_included,
        is_singleton: item.is_singleton,
        raw_quantity: item.raw_quantity,
      }));

      for (const item of itemsData) {
        try {
          item.type_name = await this.getTypeName(item.type_id);
        } catch (error) {
          console.warn(`⚠️ Failed to fetch type name for contract item`);
        }
      }

      console.log(`✅ Fetched ${itemsData.length} items for contract ${options.contractId}`);
      return {
        success: true,
        data: itemsData,
        cached: result.fromCache,
        etag: result.etag
      };
    } catch (error) {
      console.error(`❌ Failed to fetch contract items for contract ${options.contractId}:`, error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getCorporationName(corporationId: number, accessToken: string): Promise<string> {
    try {
      const url = `${ESI_BASE_URL}/corporations/${corporationId}/`;
      const result = await this.fetchWithRetry<any>(url, accessToken);
      return result.data.name;
    } catch (error) {
      return `Corporation ${corporationId}`;
    }
  }

  private async getAllianceName(allianceId: number, accessToken: string): Promise<string> {
    try {
      const url = `${ESI_BASE_URL}/alliances/${allianceId}/`;
      const result = await this.fetchWithRetry<any>(url, accessToken);
      return result.data.name;
    } catch (error) {
      return `Alliance ${allianceId}`;
    }
  }

  private async getTypeName(typeId: number): Promise<string> {
    try {
      const url = `${ESI_BASE_URL}/universe/types/${typeId}/`;
      const result = await this.fetchWithRetry<any>(url, '');
      return result.data.name;
    } catch (error) {
      return `Type ${typeId}`;
    }
  }

  private async getStationName(stationId: number, accessToken: string): Promise<string> {
    try {
      const url = `${ESI_BASE_URL}/universe/stations/${stationId}/`;
      const result = await this.fetchWithRetry<any>(url, accessToken);
      return result.data.name;
    } catch (error) {
      const structureUrl = `${ESI_BASE_URL}/universe/structures/${stationId}/`;
      try {
        const structureResult = await this.fetchWithRetry<any>(structureUrl, accessToken);
        return structureResult.data.name;
      } catch {
        return `Station ${stationId}`;
      }
    }
  }

  async fetchCorporationMembers(corporationId: number, accessToken: string): Promise<ESIMemberData[]> {
    const result = await this.fetchCorporationMembersDetailed({ corporationId, accessToken });
    return result.success ? result.data : [];
  }

  async fetchCorporationAssets(corporationId: number, accessToken: string): Promise<ESIAssetData[]> {
    const result = await this.fetchCorporationAssetsDetailed({ corporationId, accessToken });
    return result.success ? result.data : [];
  }

  async fetchIndustryJobs(corporationId: number, accessToken: string): Promise<ESIIndustryJobData[]> {
    const result = await this.fetchIndustryJobsDetailed({ corporationId, accessToken });
    return result.success ? result.data : [];
  }

  async fetchMarketOrders(corporationId: number, accessToken: string): Promise<ESIMarketOrderData[]> {
    const result = await this.fetchMarketOrdersDetailed({ corporationId, accessToken });
    return result.success ? result.data : [];
  }

  async fetchWalletTransactions(corporationId: number, division: number, accessToken: string): Promise<ESIWalletTransactionData[]> {
    const result = await this.fetchWalletDataDetailed({ corporationId, accessToken, division });
    return result.success ? result.data : [];
  }

  async fetchMiningLedger(corporationId: number, accessToken: string): Promise<ESIMiningLedgerData[]> {
    const result = await this.fetchMiningLedgerDetailed({ corporationId, accessToken });
    return result.success ? result.data : [];
  }

  async fetchContainerLogs(corporationId: number, accessToken: string): Promise<ESIContainerLogData[]> {
    const result = await this.fetchContainerLogsDetailed({ corporationId, accessToken });
    return result.success ? result.data : [];
  }

  async fetchCorporationContracts(corporationId: number, accessToken: string): Promise<ESIContractData[]> {
    const result = await this.fetchCorporationContractsDetailed({ corporationId, accessToken });
    return result.success ? result.data : [];
  }

  async fetchContractItems(corporationId: number, contractId: number, accessToken: string): Promise<ESIContractItemData[]> {
    const result = await this.fetchContractItemsDetailed({ corporationId, accessToken, contractId });
    return result.success ? result.data : [];
  }
}

export const esiDataService = new ESIDataFetchService();
