window.DB = {
  state: null,
  handle: null,
  empty() {
    return {
      schema: 1,
      wines: [],
      tastings: [],
      movements: [],
      locations: [],
      prefs: { name: "Ma collection privée" },
    };
  },
  async init() {
    this.handle = await new Promise((resolve, reject) => {
      const q = indexedDB.open("ma-cave-premium", 1);
      q.onupgradeneeded = () => q.result.createObjectStore("state");
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    this.state = await new Promise((resolve, reject) => {
      const q = this.handle
        .transaction("state")
        .objectStore("state")
        .get("main");
      q.onsuccess = () => resolve(q.result || this.empty());
      q.onerror = () => reject(q.error);
    });
  },
  message(error) {
    return error?.name === "QuotaExceededError"
      ? Error(
          "Stockage du téléphone insuffisant. Aucune modification enregistrée. Exporte ta cave avant de libérer de l’espace.",
        )
      : error || Error("Enregistrement local impossible");
  },
  async save(next = this.state) {
    Backup.validate(next);
    return this.commit(() => structuredClone(next));
  },
  async mutate(fn) {
    return this.commit((current) => {
      const next = structuredClone(current);
      fn(next);
      Backup.validate(next);
      return next;
    });
  },
  commit(update) {
    return new Promise((resolve, reject) => {
      let next, error;
      const transaction = this.handle.transaction("state", "readwrite"),
        store = transaction.objectStore("state"),
        query = store.get("main");
      query.onsuccess = () => {
        try {
          next = update(query.result || this.empty());
          store.put(next, "main");
        } catch (e) {
          error = e;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => {
        this.state = next;
        resolve();
      };
      transaction.onabort = () =>
        reject(this.message(error || transaction.error));
      transaction.onerror = () => {
        error = error || transaction.error;
      };
    });
  },
};
