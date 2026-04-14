import { openDB, IDBPDatabase } from 'idb';

export interface PDFHistoryItem {
  id: string;
  name: string;
  timestamp: number;
  type: 'merge' | 'split' | 'reorder' | 'image-to-pdf';
  blob: Blob;
  size: number;
}

const DB_NAME = 'pdf-suite-history';
const STORE_NAME = 'history';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function addToHistory(item: Omit<PDFHistoryItem, 'id' | 'timestamp'>) {
  const db = await getDB();
  const historyItem: PDFHistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  await db.put(STORE_NAME, historyItem);
  return historyItem;
}

export async function getHistory(): Promise<PDFHistoryItem[]> {
  const db = await getDB();
  const items = await db.getAll(STORE_NAME);
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteFromHistory(id: string) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearHistory() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
