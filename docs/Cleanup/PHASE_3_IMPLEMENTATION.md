# Phase 3 Implementation: Sync Orchestration Service

## Summary

Phase 3 of the Data Sync Implementation has been **successfully completed**. This phase implements the core orchestration layer that coordinates ESI data fetching, database storage, and sync scheduling.

## What Was Implemented

### 1. Sync State Manager (`/src/lib/sync-state-manager.ts`)

A comprehensive state management system for tracking sync operations.

**Key Features:**
- **Real-time Status Tracking**: Monitors status, progress, and current step for each sync process
- **History Management**: Maintains last 100 sync operations with timestamps, durations, and results
- **Persistent Storage**: Uses KV storage to persist state across sessions
- **Event System**: Subscriber pattern for real-time UI updates
- **React Hook**: `useSyncState()` hook for easy integration in React components

**State Tracked:**
```typescript
{
  processId: string;
  status: 'idle' | 'running' | 'success' | 'error';
  progress: number;              // 0-100
  currentStep: string;            // Human-readable status
  lastRunTime?: number;           // Unix timestamp
  lastSuccessTime?: number;       // Unix timestamp
  nextRunTime?: number;           // Unix timestamp
  errorMessage?: string;          // Last error
  errorCount: number;             // Consecutive failures
  itemsProcessed?: number;        // Items in last run
  totalItems?: number;            // Total items to process
}
```

**Key Methods:**
- `startSync(processId)` - Initialize a sync operation
- `updateSyncProgress(processId, progress, step, ...)` - Update progress
- `completeSync(processId, itemsProcessed)` - Mark sync as successful
- `failSync(processId, errorMessage)` - Mark sync as failed
- `getSyncHistory(processId?, limit)` - Retrieve sync history

---

### 2. Sync Executor (`/src/lib/sync-executor.ts`)

Executes individual sync processes with full ESI integration and database storage.

**Supported Sync Types:**
1. **Members** - Corporation member tracking
2. **Assets** - Corporation asset inventory
3. **Manufacturing** - Industry jobs
4. **Market** - Market orders
5. **Wallet** - Wallet transactions (all divisions)
6. **Mining** - Mining ledger
7. **Killmails** - Corporation killmails (placeholder)
8. **Container Logs** - Container access logs (for PI tracking)

**Execution Flow:**
```
1. Start sync (update state to 'running')
2. Fetch data from ESI using ESIDataFetchService
3. Validate and transform data
4. Store in database using ESIDataStorageService
5. Update progress at each step
6. Complete sync (update state to 'success' or 'error')
7. Record in history
```

**Progress Reporting:**
- 10% - Fetching from ESI
- 50% - Storing in database
- 90% - Finalizing
- 100% - Complete

**Error Handling:**
- Catches all errors during execution
- Logs detailed error messages
- Updates state with error information
- Increments error counter for tracking failure patterns

---

### 3. Sync Scheduler (`/src/lib/sync-scheduler.ts`)

Manages scheduled execution of sync processes with interval-based polling.

**Key Features:**
- **Interval Scheduling**: Each process runs on its configured interval (minutes)
- **Enable/Disable**: Individual processes can be toggled on/off
- **Next Run Tracking**: Calculates and tracks next scheduled run time
- **Concurrent Prevention**: Prevents same process from running simultaneously
- **Manual Triggers**: Supports "Sync Now" functionality
- **Persistent Config**: Saves schedule configuration to KV storage

**Configuration Structure:**
```typescript
{
  processId: string;          // Unique identifier
  processType: SyncProcessType; // Type of sync (members, assets, etc.)
  enabled: boolean;           // Is scheduling enabled?
  intervalMinutes: number;    // How often to run (in minutes)
}
```

**Key Methods:**
- `scheduleProcess(config)` - Add/update a scheduled process
- `unscheduleProcess(processId)` - Remove a scheduled process
- `toggleProcess(processId, enabled)` - Enable/disable scheduling
- `updateProcessInterval(processId, minutes)` - Change interval
- `runProcessNow(...)` - Manually trigger a sync
- `start()` - Start the scheduler (checks every minute)
- `stop()` - Stop the scheduler

**Scheduler Behavior:**
- Checks all scheduled processes every 60 seconds
- Runs processes that have reached their next run time
- Skips processes already running
- Calculates next run time after completion
- Persists state to survive app restarts (when reopened)

---

## How It All Works Together

### Sync Flow Example (Members Sync):

```
1. User configures "Members Sync" in Settings -> Data Sync
   - Interval: 30 minutes
   - Enabled: true
   
2. Scheduler schedules next run (now + 30 minutes)
   
3. After 30 minutes, Scheduler triggers:
   - Calls SyncExecutor.executeSyncProcess('members', ...)
   
4. Executor starts sync:
   - SyncStateManager updates status to 'running'
   - Progress: 0%, Step: "Initializing..."
   
5. Executor fetches data:
   - ESIDataFetchService.fetchCorporationMembers()
   - Progress: 10%, Step: "Fetching members from ESI..."
   
6. Executor stores data:
   - ESIDataStorageService.storeMembers()
   - Progress: 50%, Step: "Storing members in database..."
   
7. Executor finalizes:
   - Progress: 90%, Step: "Finalizing..."
   - SyncStateManager updates status to 'success'
   - Progress: 100%, Step: "Completed"
   - Records in history
   
8. Scheduler calculates next run (now + 30 minutes)
```

### Error Flow:

```
1. Executor encounters error during ESI fetch
   - Network timeout, 403 forbidden, etc.
   
2. Executor catches error:
   - SyncStateManager.failSync(processId, errorMessage)
   - Status: 'error'
   - Error counter increments
   - Error recorded in history
   
3. Scheduler still calculates next run
   - Sync will retry automatically on next interval
   
4. UI displays error state
   - Shows error message
   - Shows error count
   - User can manually retry
```

---

## Integration Points

### For UI Components:

```typescript
import { useSyncState } from '@/lib/sync-state-manager';
import { getSyncScheduler } from '@/lib/sync-scheduler';

function DataSyncSettings() {
  const { statuses, history, isProcessRunning } = useSyncState();
  const scheduler = getSyncScheduler();
  
  const handleSyncNow = async (processId: string) => {
    await scheduler.runProcessNow(
      processId,
      processType,
      corporationId,
      accessToken,
      databaseService
    );
  };
  
  // Display status for each process
  const status = statuses['members-sync'];
  // status.progress, status.currentStep, status.lastSuccessTime, etc.
}
```

### For Initialization:

```typescript
import { initializeSyncScheduler } from '@/lib/sync-scheduler';

// On app startup
await initializeSyncScheduler([
  {
    processId: 'members-sync',
    processType: 'members',
    enabled: true,
    intervalMinutes: 30
  },
  // ... other processes
]);

const scheduler = getSyncScheduler();
scheduler.start(); // Begin scheduled polling
```

---

## What's Next (Phase 4)

Now that the orchestration layer is complete, the next step is **Phase 4: UI Integration**.

**Tasks:**
1. Update `DataSyncSettings.tsx` to use real sync services
2. Replace simulated progress with actual state from SyncStateManager
3. Wire up "Sync Now" buttons to call `scheduler.runProcessNow()`
4. Display real sync history from `getSyncHistory()`
5. Show actual errors and retry counts
6. Add real-time progress updates during sync

**This will make the Data Sync UI fully functional!**

---

## Technical Notes

### Browser Limitations

The current implementation uses `setInterval` for scheduling, which only works while the app is open in the browser.

**Limitations:**
- Syncs only run when user has app open
- Closing browser tab stops all scheduled syncs
- Not suitable for long-term unattended operation

**Production Solutions:**
1. **Service Worker**: Run in background when browser is open (even if tab closed)
2. **Server-Side Cron**: Most reliable - run sync script on server
3. **Desktop App**: Package as Electron app for true background operation

**Current Choice**: Browser-based scheduling is acceptable for:
- Development and testing
- Users actively managing their corporation
- Supplement to manual "Sync Now" triggers

---

## Files Created

1. `/src/lib/sync-state-manager.ts` - 6,962 bytes
2. `/src/lib/sync-executor.ts` - 11,403 bytes  
3. `/src/lib/sync-scheduler.ts` - 7,454 bytes

**Total**: ~26KB of new orchestration code

---

## Testing Checklist

To test Phase 3 implementation:

- [ ] Import and initialize scheduler in App.tsx
- [ ] Configure a test sync process
- [ ] Verify sync state updates in real-time
- [ ] Check KV storage for persisted state
- [ ] Test manual "Sync Now" trigger
- [ ] Verify error handling (invalid token, network error)
- [ ] Check sync history recording
- [ ] Confirm next run time calculation
- [ ] Test enable/disable toggling
- [ ] Verify concurrent run prevention

---

## Completion Status

✅ **Phase 3 is COMPLETE**

All three core services have been implemented:
- Sync State Manager
- Sync Executor
- Sync Scheduler

The orchestration layer is ready for UI integration in Phase 4.
