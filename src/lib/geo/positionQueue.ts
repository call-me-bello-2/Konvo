/**
 * Fila de posicoes para quando falta sinal.
 *
 * A descida da serra ate o litoral tem zonas mortas. Sem isto, cada posicao
 * capturada offline se perde: o recap fica furado e, pior, quem esta olhando
 * ve um pino parado como se fosse posicao atual.
 *
 * IndexedDB e nao localStorage porque a fila pode acumular centenas de pontos
 * num trecho longo sem cobertura, e localStorage e sincrono — travaria a
 * interface justamente enquanto o carro anda.
 */

const DB_NAME = "konvo";
const STORE = "positionQueue";
const DB_VERSION = 1;

export interface QueuedFix {
  tripId: string;
  memberId: string;
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  at: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

export async function enqueue(fix: QueuedFix): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(fix);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function drain(): Promise<QueuedFix[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedFix[]);
    req.onerror = () => reject(req.error);
  });
}

export async function clearQueue(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueSize(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
