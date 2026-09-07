// Client wrapper for the server-side corp ESI sync endpoint.
//
// Data flow: the server holds the vaulted corp token, fetches the ESI segment,
// and upserts rows into the database. Pages read cached data from the database
// on load — the browser never touches raw corp tokens.
//
// POST /api/lmeve/esi/sync-run.php { processType, corporationId }

export const CORP_SYNC_SEGMENTS = ['members', 'assets', 'industry', 'market'] as const;
export type CorpSyncSegment = (typeof CORP_SYNC_SEGMENTS)[number];

// SPA scheduler process ids -> server sync-run.php segment names. Covers both
// vocabularies (server segments map to themselves). Null means the process has
// no server-side implementation yet and must run in-browser.
const PROCESS_TYPE_TO_SEGMENT: Record<string, CorpSyncSegment | null> = {
  members: 'members',
  assets: 'assets',
  industry: 'industry',
  manufacturing: 'industry',
  market: 'market'
};

export function resolveCorpSyncSegment(processType: string): CorpSyncSegment | null {
  return PROCESS_TYPE_TO_SEGMENT[processType] ?? null;
}

export interface CorpSyncSegmentResult {
  ok: boolean;
  status?: number;
  error?: string;
  processType?: string;
  corporationId?: number;
  corporationName?: string;
  fetched?: number;
  inserted?: number;
  updated?: number;
  failed?: number;
  tookMs?: number;
  tokenRefreshed?: number;
}

export interface CorpSyncBatchResult {
  completed: CorpSyncSegment[];
  failed: { segment: CorpSyncSegment; error: string }[];
}

const JOB_POLL_INTERVAL_MS = 1500;

async function waitForCorpSyncJob(jobId: number, timeoutMs: number): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, JOB_POLL_INTERVAL_MS));
    const response = await fetch(`/api/lmeve/esi/sync-jobs.php?jobId=${encodeURIComponent(String(jobId))}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok || !json?.job) {
      throw new Error(json?.error || `Unable to read sync job (HTTP ${response.status})`);
    }
    if (json.job.status === 'succeeded' || json.job.status === 'failed') return json;
  }
  throw new Error('Sync job timed out while waiting for the server worker');
}

export type CorpSyncProgress = (segment: CorpSyncSegment, index: number, total: number) => void;

function isSegment(value: string): value is CorpSyncSegment {
  return (CORP_SYNC_SEGMENTS as readonly string[]).includes(value);
}

export async function runCorpSyncSegment(
  segment: string,
  corporationId: number,
  timeoutMs = 300000
): Promise<CorpSyncSegmentResult> {
  const serverSegment = resolveCorpSyncSegment(segment);
  if (!serverSegment) {
    // No server-side segment for this process type. Omitting status lets
    // callers detect this (result.status falsy) and fall back to the
    // in-browser executor when they hold a live corp token.
    return { ok: false, error: `No server-side sync endpoint for '${segment}' — use browser mode`, processType: segment, corporationId };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch('/api/lmeve/esi/sync-run.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ processType: serverSegment, corporationId }),
      signal: controller.signal,
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json || json.ok === false) {
      return {
        ok: false,
        status: resp.status,
        error: (json && (json.error || json.message)) || `Sync request failed (HTTP ${resp.status})`,
        processType: segment,
        corporationId,
      };
    }

    let finalJson = json;
    if (json.queued && json.jobId) {
      const queued = await waitForCorpSyncJob(Number(json.jobId), timeoutMs);
      if (queued.job.status === 'failed' || !queued.result?.ok) {
        return {
          ok: false,
          status: queued.result?.httpCode || 500,
          error: queued.job.error || queued.result?.error || 'Queued sync failed',
          processType: segment,
          corporationId,
        };
      }
      finalJson = queued.result;
    }

    return {
      ok: true,
      status: resp.status,
      processType: finalJson.processType,
      corporationId: finalJson.corporationId,
      corporationName: finalJson.corporationName,
      fetched: finalJson.fetched,
      inserted: finalJson.inserted,
      updated: finalJson.updated,
      failed: finalJson.failed,
      tookMs: finalJson.tookMs,
      tokenRefreshed: finalJson.tokenRefreshed,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { ok: false, error: 'Sync timed out', processType: segment, corporationId };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'Network error during sync', processType: segment, corporationId };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Run every core segment for a corporation in order (initial population after
 * registration, or a manual "Sync All"). Returns per-segment outcomes.
 */
export async function runInitialCorpSync(
  corporationId: number,
  onProgress?: CorpSyncProgress
): Promise<CorpSyncBatchResult> {
  const completed: CorpSyncSegment[] = [];
  const failed: { segment: CorpSyncSegment; error: string }[] = [];

  const segments = CORP_SYNC_SEGMENTS;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (onProgress) onProgress(segment, i, segments.length);

    const result = await runCorpSyncSegment(segment, corporationId);
    if (result.ok) {
      completed.push(segment);
    } else {
      failed.push({ segment, error: result.error || 'Unknown error' });
    }
  }

  return { completed, failed };
}

export function isCorpSyncSegment(value: string): value is CorpSyncSegment {
  return isSegment(value);
}
