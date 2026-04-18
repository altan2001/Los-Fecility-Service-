
export interface OfflineAction {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body: any;
  timestamp: number;
  entityType: string;
}

const OFFLINE_QUEUE_KEY = 'ki_handwerker_offline_queue';

export const addToOfflineQueue = (action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
  const queue = getOfflineQueue();
  const newAction: OfflineAction = {
    ...action,
    id: Math.random().toString(36).substring(2, 15),
    timestamp: Date.now()
  };
  queue.push(newAction);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  
  // Dispatch event for UI to react
  window.dispatchEvent(new CustomEvent('offline-action-added', { detail: newAction }));
};

export const getOfflineQueue = (): OfflineAction[] => {
  const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const clearOfflineQueue = () => {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
};

export const syncOfflineQueue = async () => {
  if (!navigator.onLine) return;
  
  const queue = getOfflineQueue();
  if (queue.length === 0) return;
  
  console.log(`Syncing ${queue.length} offline actions...`);
  
  const successfulIds: string[] = [];
  
  for (const action of queue) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body)
      });
      
      if (response.ok) {
        successfulIds.push(action.id);
      }
    } catch (err) {
      console.error('Failed to sync action:', action, err);
      // Keep in queue for next try
    }
  }
  
  const remainingQueue = queue.filter(a => !successfulIds.includes(a.id));
  if (remainingQueue.length === 0) {
    clearOfflineQueue();
  } else {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
  }
  
  if (successfulIds.length > 0) {
    window.dispatchEvent(new CustomEvent('offline-sync-completed', { detail: { count: successfulIds.length } }));
  }
};

// Auto-sync when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineQueue);
}
