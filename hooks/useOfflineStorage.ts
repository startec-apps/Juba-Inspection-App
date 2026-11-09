import { useEffect } from 'react';

export const useOfflineStorage = (data: any) => {
  const cacheData = () => {
    // Basic caching logic stub
    try {
      localStorage.setItem('sc_cached_critical', JSON.stringify({
        ts: new Date().toISOString(),
        ...data
      }));
    } catch (error) {
      console.warn("Storage quota exceeded, could not cache critical data.");
    }
  };

  useEffect(() => {
    if (data.historyList && data.historyList.length > 0) {
      cacheData();
    }
  }, [data.historyList]);

  return { cacheData };
};
