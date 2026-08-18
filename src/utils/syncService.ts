/**
 * Offline-First Storage & Background Sync Service
 * Allows users in flights/basements to seamlessly record transactions offline.
 * Automatically pushes queued data to Neon PostgreSQL as soon as internet reconnects.
 */

import { Transaction } from '../types/finance';

const OFFLINE_TX_QUEUE_KEY = 'funds_logger_offline_tx_queue';
const OFFLINE_DELETED_QUEUE_KEY = 'funds_logger_offline_deleted_queue';

// Get queued offline transactions
export function getOfflineTransactionQueue(): Transaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_TX_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Save transaction to offline queue
export function queueOfflineTransaction(tx: Transaction): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getOfflineTransactionQueue();
    // Replace if existing ID or prepend
    const updated = [tx, ...current.filter(t => t.id !== tx.id)];
    localStorage.setItem(OFFLINE_TX_QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to queue offline transaction:', err);
  }
}

// Remove from offline queue after successful server sync
export function removeOfflineTransaction(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getOfflineTransactionQueue();
    const filtered = current.filter(t => t.id !== id);
    localStorage.setItem(OFFLINE_TX_QUEUE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to remove synced offline transaction:', err);
  }
}

// Queue deleted ID offline
export function queueOfflineDelete(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(OFFLINE_DELETED_QUEUE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(OFFLINE_DELETED_QUEUE_KEY, JSON.stringify(list));
    }
  } catch {}
}

// Flush and sync all offline queued transactions with live Neon DB
export async function syncOfflineQueueWithServer(
  onItemSynced?: (syncedTx: Transaction) => void
): Promise<{ successCount: number; errorCount: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { successCount: 0, errorCount: 0 };
  }

  const queue = getOfflineTransactionQueue();
  let successCount = 0;
  let errorCount = 0;

  for (const tx of queue) {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      });

      if (res.ok) {
        removeOfflineTransaction(tx.id);
        successCount++;
        onItemSynced?.(tx);
      } else {
        errorCount++;
      }
    } catch {
      errorCount++;
    }
  }

  // Flush offline deletes
  try {
    const rawDeletes = localStorage.getItem(OFFLINE_DELETED_QUEUE_KEY);
    const deleteList: string[] = rawDeletes ? JSON.parse(rawDeletes) : [];
    for (const delId of deleteList) {
      try {
        const res = await fetch(`/api/transactions?id=${delId}`, { method: 'DELETE' });
        if (res.ok) {
          const updatedDeletes = deleteList.filter(id => id !== delId);
          localStorage.setItem(OFFLINE_DELETED_QUEUE_KEY, JSON.stringify(updatedDeletes));
        }
      } catch {}
    }
  } catch {}

  return { successCount, errorCount };
}
