/** Device copy of a pet document when the API rejects the file type. */

const DB_NAME = 'vos.petDocuments';
const STORE = 'files';

export interface LocalPetDocument {
  id: string;
  petId: string;
  category: string;
  fileName: string;
  mime: string;
  createdAt: string;
  blob: Blob;
  local: true;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('petId', 'petId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open document storage'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Document storage failed'));
    tx.onabort = () => reject(tx.error || new Error('Document storage was aborted'));
  });
}

export function isLocalPetDocumentId(id: unknown): boolean {
  return String(id || '').startsWith('local-doc-');
}

export async function saveLocalPetDocument(input: {
  petId: string;
  file: Blob;
  fileName: string;
  mime: string;
  category: string;
  id?: string;
}): Promise<LocalPetDocument> {
  const row: LocalPetDocument = {
    id: input.id || `local-doc-${crypto.randomUUID()}`,
    petId: input.petId,
    category: input.category,
    fileName: input.fileName,
    mime: input.mime,
    createdAt: new Date().toISOString(),
    blob: input.file,
    local: true,
  };
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(row);
  await txDone(tx);
  db.close();
  return row;
}

export async function listLocalPetDocuments(petId: string): Promise<LocalPetDocument[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const index = tx.objectStore(STORE).index('petId');
  const rows = await new Promise<LocalPetDocument[]>((resolve, reject) => {
    const req = index.getAll(petId);
    req.onsuccess = () => resolve((req.result || []) as LocalPetDocument[]);
    req.onerror = () => reject(req.error || new Error('Could not read documents'));
  });
  await txDone(tx);
  db.close();
  return rows;
}

export async function getLocalPetDocument(id: string): Promise<LocalPetDocument | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const row = await new Promise<LocalPetDocument | null>((resolve, reject) => {
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as LocalPetDocument) || null);
    req.onerror = () => reject(req.error || new Error('Could not read document'));
  });
  await txDone(tx);
  db.close();
  return row;
}

export async function updateLocalPetDocument(
  id: string,
  patch: { category?: string; file?: Blob; fileName?: string; mime?: string },
): Promise<LocalPetDocument | null> {
  const current = await getLocalPetDocument(id);
  if (!current) return null;
  const next: LocalPetDocument = {
    ...current,
    category: patch.category || current.category,
    fileName: patch.fileName || current.fileName,
    mime: patch.mime || current.mime,
    blob: patch.file || current.blob,
    local: true,
  };
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(next);
  await txDone(tx);
  db.close();
  return next;
}

export async function deleteLocalPetDocument(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}
