// Malý promisifikovaný wrapper nad IndexedDB. Volá se jen z klientských hooků
// (po mountu, uvnitř useEffect), takže "indexedDB" tu nikdy nesahá na SSR.

const DB_NAME = "cnc-casovac";
const DB_VERSION = 1;

export type StoreName =
  | "customers"
  | "inquiries"
  | "parts"
  | "partOperationRows"
  | "toolRows"
  | "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("customers")) {
          db.createObjectStore("customers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("inquiries")) {
          db.createObjectStore("inquiries", { keyPath: "id" }).createIndex("customerId", "customerId");
        }
        if (!db.objectStoreNames.contains("parts")) {
          db.createObjectStore("parts", { keyPath: "id" }).createIndex("inquiryId", "inquiryId");
        }
        if (!db.objectStoreNames.contains("partOperationRows")) {
          db.createObjectStore("partOperationRows", { keyPath: "id" }).createIndex("partId", "partId");
        }
        if (!db.objectStoreNames.contains("toolRows")) {
          db.createObjectStore("toolRows", { keyPath: "opId" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return wrap(db.transaction(store, "readonly").objectStore(store).getAll());
}

export async function getAllByIndex<T>(store: StoreName, indexName: string, key: IDBValidKey): Promise<T[]> {
  const db = await openDb();
  return wrap(db.transaction(store, "readonly").objectStore(store).index(indexName).getAll(key));
}

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return wrap(db.transaction(store, "readonly").objectStore(store).get(key));
}

export async function put<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDb();
  await wrap(db.transaction(store, "readwrite").objectStore(store).put(value));
}

export async function del(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  await wrap(db.transaction(store, "readwrite").objectStore(store).delete(key));
}

export async function clearStore(store: StoreName): Promise<void> {
  const db = await openDb();
  await wrap(db.transaction(store, "readwrite").objectStore(store).clear());
}
