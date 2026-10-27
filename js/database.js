/* Cache isolé par application et compte. Les écritures métier passent par Cloud. */
window.DB = {
  state: null,
  handle: null,
  key: null,
  base: null,
  pending: null,
  legacy: null,
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
    this.legacy = await this.read("main");
    this.state = this.empty();
  },
  read(key) {
    return new Promise((resolve, reject) => {
      const q = this.handle.transaction("state").objectStore("state").get(key);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
  },
  write(key, value) {
    return new Promise((resolve, reject) => {
      const t = this.handle.transaction("state", "readwrite");
      t.objectStore("state").put(value, key);
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  },
  async select(account) {
    this.key = "cloud:" + CAVE_CONFIG.clientId + ":" + account.homeAccountId;
    const r = await this.read(this.key);
    this.state = r?.state || this.empty();
    this.base = r?.base || null;
    this.pending = r?.pending || null;
    Backup.validate(this.state);
  },
  async cache(state, base, pending = null) {
    if (!this.key) throw Error("Compte non connecté");
    await this.write(this.key, { state, base, pending });
    this.state = state;
    this.base = base;
    this.pending = pending;
  },
  async save(next) {
    return Cloud.save(structuredClone(next));
  },
  async mutate(fn) {
    return Cloud.exclusive(async () => {
      Cloud.assertWritable();
      // Un autre onglet peut avoir actualisé ce cache depuis l'ouverture du formulaire.
      const cached = await this.read(this.key);
      if ((cached?.base || null) !== this.base)
        throw Error(
          "Un autre onglet a modifié la cave. Ferme ce formulaire et actualise.",
        );
      const next = structuredClone(this.state);
      fn(next);
      await Cloud.saveUnlocked(next);
    });
  },
};
