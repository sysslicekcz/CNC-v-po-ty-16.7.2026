// Malý promisifikovaný wrapper nad IndexedDB. Volá se jen z klientských hooků
// (po mountu, uvnitř useEffect), takže "indexedDB" tu nikdy nesahá na SSR.

const DB_NAME = "cnc-casovac";
const DB_VERSION = 4;

export type StoreName =
  | "customers"
  | "inquiries"
  | "parts"
  | "positions"
  | "partOperationRows"
  | "toolRows"
  | "machines"
  | "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB není v tomto prohlížeči k dispozici."));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        // v4: katalog nástrojů přešel z jednoho záznamu na operaci (keyPath "opId")
        // na záznam na dvojici stroj+operace (keyPath "id" = `${strojId}:${opId}`,
        // viz useAllTools.ts) - starý tvar nejde upravit na místě, tak se store
        // založí znovu. Nejde o ztrátu dat, katalog nástrojů tou dobou byl prázdný.
        if (event.oldVersion < 4 && db.objectStoreNames.contains("toolRows")) {
          db.deleteObjectStore("toolRows");
        }
        if (!db.objectStoreNames.contains("customers")) {
          db.createObjectStore("customers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("inquiries")) {
          db.createObjectStore("inquiries", { keyPath: "id" }).createIndex("customerId", "customerId");
        }
        if (!db.objectStoreNames.contains("parts")) {
          db.createObjectStore("parts", { keyPath: "id" }).createIndex("inquiryId", "inquiryId");
        }
        if (!db.objectStoreNames.contains("positions")) {
          // Výchozí poloha dílu má schválně id === id dílu (viz entities.ts
          // ensureDefaultPosition) - díky tomu staré partOperationRows uložené
          // pod partId dílu automaticky "patří" této poloze bez jakékoli migrace dat.
          db.createObjectStore("positions", { keyPath: "id" }).createIndex("partId", "partId");
        }
        if (!db.objectStoreNames.contains("partOperationRows")) {
          db.createObjectStore("partOperationRows", { keyPath: "id" }).createIndex("partId", "partId");
        }
        if (!db.objectStoreNames.contains("toolRows")) {
          db.createObjectStore("toolRows", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("machines")) {
          db.createObjectStore("machines", { keyPath: "id" });
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

/** Ověří, že jde úložiště otevřít - volá se samostatně (mimo migraci, která chyby
 *  polyká), aby appka na selhání IndexedDB (soukromý režim, zákaz firemní politikou,
 *  plný disk...) reagovala srozumitelnou hláškou místo tichého prázdna. */
export async function checkAvailable(): Promise<void> {
  await openDb();
}
