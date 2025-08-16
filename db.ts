
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Receipt, Expense, Settings } from './types';

const DB_NAME = 'NeelkanthDB';
const DB_VERSION = 1;

interface AppDB extends DBSchema {
  receipts: {
    key: number;
    value: Receipt;
    indexes: { 'receiptNumber': string };
  };
  expenses: {
    key: number;
    value: Expense;
  };
  settings: {
    key: number;
    value: Settings;
  };
  auth: {
    key: string;
    value: { username: string; passwordHash: string };
  }
}

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

const getDB = (): Promise<IDBPDatabase<AppDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('receipts')) {
          const store = db.createObjectStore('receipts', { keyPath: 'id', autoIncrement: true });
          store.createIndex('receiptNumber', 'receiptNumber', { unique: true });
        }
        if (!db.objectStoreNames.contains('expenses')) {
          db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('auth')) {
          db.createObjectStore('auth', { keyPath: 'username' });
        }
      },
    });
  }
  return dbPromise;
};

// --- Auth Functions ---
export async function getAuthCredentials(username: string) {
  const db = await getDB();
  return db.get('auth', username);
}

export async function saveAuthCredentials(username: string, passwordHash: string) {
  const db = await getDB();
  return db.put('auth', { username, passwordHash });
}

// --- Receipt Functions ---
export async function getAllReceipts(): Promise<Receipt[]> {
  const db = await getDB();
  return db.getAll('receipts');
}

export async function addReceipt(receipt: Omit<Receipt, 'id'>): Promise<number> {
  const db = await getDB();
  return db.add('receipts', receipt as Receipt);
}

export async function getReceipt(id: number): Promise<Receipt | undefined> {
  const db = await getDB();
  return db.get('receipts', id);
}

// --- Expense Functions ---
export async function getAllExpenses(): Promise<Expense[]> {
    const db = await getDB();
    return db.getAll('expenses');
}

export async function addExpense(expense: Omit<Expense, 'id'>): Promise<number> {
    const db = await getDB();
    return db.add('expenses', expense as Expense);
}

// --- Settings Functions ---
export async function getSettings(): Promise<Settings | undefined> {
  const db = await getDB();
  return db.get('settings', 1); // Settings are stored with a fixed key
}

export async function saveSettings(settings: Omit<Settings, 'id'>): Promise<number> {
  const db = await getDB();
  return db.put('settings', { ...settings, id: 1 });
}