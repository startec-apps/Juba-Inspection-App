import { openDB } from 'idb';

const DB_NAME = 'FleetInspectionDB';
const STORE_NAME = 'historyData';

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
  },
});

export const dbService = {
  async get(key: string) {
    return (await dbPromise).get(STORE_NAME, key);
  },
  async set(key: string, val: any) {
    return (await dbPromise).put(STORE_NAME, { id: key, data: val, timestamp: Date.now() });
  },
  async delete(key: string) {
    return (await dbPromise).delete(STORE_NAME, key);
  }
};
