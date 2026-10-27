/* Microsoft Graph, autorisation déléguée limitée au dossier d'application.
   Révisions immuables : aucune sauvegarde n'écrase un fichier de données existant.
   Les noms des révisions encodent leurs parents pour détecter les branches sans
   télécharger l'historique complet. Les photos sont adressées par SHA-256. */
window.Cloud = {
  msal: null,
  account: null,
  folder: null,
  items: new Map(),
  heads: [],
  conflicts: [],
  ready: false,
  busy: false,
  message: "Connexion requise",
  lastSync: null,
  needsLogin: false,
  scopes: ["Files.ReadWrite.AppFolder"],
  configured() {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      CAVE_CONFIG.clientId,
    );
  },
  async init() {
    if (!this.configured()) {
      this.message = "Configuration Microsoft à terminer";
      return;
    }
    if (!window.isSecureContext || !/^https?:$/.test(location.protocol))
      throw Error("Ouvre Ma Cave en HTTPS (GitHub Pages) ou sur localhost.");
    if (!window.msal)
      throw Error(
        "Le composant Microsoft local est absent. Redéploie tous les fichiers du ZIP.",
      );
    this.msal = new msal.PublicClientApplication({
      auth: {
        clientId: CAVE_CONFIG.clientId,
        authority: CAVE_CONFIG.authority,
        redirectUri: CAVE_CONFIG.redirectUri,
        postLogoutRedirectUri: CAVE_CONFIG.redirectUri,
        navigateToLoginRequestUrl: false,
      },
      cache: { cacheLocation: "localStorage" },
      system: { allowPlatformBroker: false },
    });
    await this.msal.initialize();
    const response = await this.msal.handleRedirectPromise();
    this.account = response?.account || this.msal.getActiveAccount();
    if (!this.account) {
      let accounts = this.msal.getAllAccounts();
      if (accounts.length === 1) this.account = accounts[0];
    }
    if (this.account) {
      this.msal.setActiveAccount(this.account);
      await DB.select(this.account);
    }
    if (this.account && navigator.onLine) await this.refresh(false);
    else if (this.account)
      this.message = "Hors connexion · consultation du cache";
  },
  async login() {
    if (!this.configured()) {
      UI.toast(
        "Renseigne clientId dans config.js. Voir le guide de configuration.",
      );
      return;
    }
    if (!navigator.onLine) {
      UI.toast("Internet est nécessaire pour se connecter.");
      return;
    }
    try {
      await this.msal.loginRedirect({
        scopes: this.scopes,
        prompt: "select_account",
      });
    } catch (e) {
      this.error(e);
    }
  },
  async logout() {
    if (this.busy) {
      UI.toast("Attends la fin de la synchronisation.");
      return;
    }
    if (
      DB.pending &&
      !confirm(
        "Une sauvegarde reste à vérifier. Exporte le brouillon avant de te déconnecter. Continuer ?",
      )
    )
      return;
    const account = this.account;
    this.account = null;
    this.ready = false;
    this.folder = null;
    this.items = new Map();
    DB.state = DB.empty();
    DB.base = null;
    DB.pending = null;
    DB.key = null;
    App.render();
    try {
      await this.msal.logoutRedirect({
        account,
        postLogoutRedirectUri: CAVE_CONFIG.redirectUri,
      });
    } catch (e) {
      this.error(e);
    }
  },
  async token() {
    if (!this.account) throw Error("Connecte ton compte Microsoft.");
    try {
      const r = await this.msal.acquireTokenSilent({
        account: this.account,
        scopes: this.scopes,
      });
      this.needsLogin = false;
      return r.accessToken;
    } catch (e) {
      this.needsLogin = true;
      throw Error(
        "Reconnexion Microsoft nécessaire. Utilise le bouton Reconnecter.",
      );
    }
  },
  async timedFetch(url, options = {}) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 30000);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
    } catch (e) {
      throw Error(
        e.name === "AbortError"
          ? "Délai réseau dépassé. Vérifie la sauvegarde avant de réessayer."
          : "Connexion interrompue. Vérifie Internet puis actualise.",
      );
    } finally {
      clearTimeout(timer);
    }
  },
  async graph(path, options = {}) {
    const url = path.startsWith("https://")
      ? new URL(path)
      : new URL("https://graph.microsoft.com/v1.0" + path);
    if (
      url.origin !== "https://graph.microsoft.com" ||
      !url.pathname.startsWith("/v1.0/")
    )
      throw Error("Adresse Graph refusée");
    const r = await this.timedFetch(url.href, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: "Bearer " + (await this.token()),
      },
    });
    if (!r.ok) {
      let e = new Error(this.httpMessage(r.status));
      e.status = r.status;
      throw e;
    }
    return r.status === 204 ? null : r.json();
  },
  httpMessage(status) {
    return (
      {
        401: "Session expirée : reconnecte Microsoft.",
        403: "OneDrive refuse l’accès au dossier de l’application. Vérifie Files.ReadWrite.AppFolder dans Microsoft Entra et le consentement ; aucun accès élargi n’est demandé automatiquement.",
        404: "Fichier OneDrive introuvable.",
        409: "Conflit OneDrive : actualise avant de réessayer.",
        429: "OneDrive demande de patienter. Réessaie dans une minute.",
        507: "Espace OneDrive insuffisant.",
      }[status] ||
      "Erreur OneDrive (" + status + "). Réessaie après actualisation."
    );
  },
  async list() {
    if (!this.folder) {
      const f = await this.graph("/me/drive/special/approot");
      if (!f.id) throw Error("Dossier OneDrive invalide");
      this.folder = f.id;
    }
    let path =
        "/me/drive/items/" +
        encodeURIComponent(this.folder) +
        "/children?$select=id,name,size&$top=200",
      all = [],
      seen = new Set();
    while (path) {
      if (seen.has(path)) throw Error("Pagination OneDrive invalide");
      seen.add(path);
      const r = await this.graph(path);
      if (!Array.isArray(r.value)) throw Error("Réponse OneDrive invalide");
      all.push(...r.value);
      if (all.length > 10000)
        throw Error(
          "Historique trop volumineux. Exporte la cave et contacte le mainteneur avant de poursuivre.",
        );
      path = r["@odata.nextLink"] || null;
    }
    this.items = new Map(all.map((x) => [x.name, x]));
    const revisions = all.filter((x) => x.name.startsWith("mc-r-"));
    const nodes = revisions.map((x) => ({ ...x, ...this.parseName(x.name) }));
    const ids = new Set(nodes.map((n) => n.rev)),
      parents = new Set(nodes.flatMap((n) => n.parents));
    for (const n of nodes)
      for (const parent of n.parents)
        if (!ids.has(parent))
          throw Error(
            "Historique OneDrive incomplet : une version parente manque. Ne supprime pas les fichiers mc-r-.",
          );
    this.heads = nodes.filter((n) => !parents.has(n.rev));
    if (nodes.length && !this.heads.length)
      throw Error("Historique de versions incohérent");
    return this.heads;
  },
  parseName(name) {
    const m =
      /^mc-r-([a-f0-9]{32})--(root|[a-f0-9]{32}(?:_[a-f0-9]{32})*)\.json$/.exec(
        name,
      );
    if (!m) throw Error("Nom de version OneDrive invalide");
    return { rev: m[1], parents: m[2] === "root" ? [] : m[2].split("_") };
  },
  revisionName(id, parents) {
    return (
      "mc-r-" +
      id +
      "--" +
      (parents.length ? [...parents].sort().join("_") : "root") +
      ".json"
    );
  },
  async bytes(item, max) {
    if (item.size > max) throw Error("Fichier OneDrive trop volumineux");
    const meta = await this.graph(
      "/me/drive/items/" +
        encodeURIComponent(item.id) +
        "?$select=id,size,@microsoft.graph.downloadUrl",
    );
    const url = meta["@microsoft.graph.downloadUrl"];
    if (!url || new URL(url).protocol !== "https:")
      throw Error("Téléchargement OneDrive indisponible");
    const r = await this.timedFetch(url);
    if (!r.ok)
      throw Error(
        "Téléchargement OneDrive interrompu. Actualise puis réessaie.",
      );
    const data = await r.arrayBuffer();
    if (data.byteLength > max) throw Error("Fichier OneDrive trop volumineux");
    return data;
  },
  async readRevision(node) {
    const data = JSON.parse(
      new TextDecoder().decode(await this.bytes(node, 4e6)),
    );
    if (
      data.schema !== 2 ||
      data.id !== node.rev ||
      JSON.stringify([...data.parents].sort()) !==
        JSON.stringify([...node.parents].sort())
    )
      throw Error("Version OneDrive incohérente");
    Backup.validate(data.state);
    return data;
  },
  async hydrate(node) {
    const r = await this.readRevision(node),
      s = structuredClone(r.state);
    // Le cache ne sert que si le contenu correspond exactement au hash attendu.
    const previous = new Map(
      DB.state.wines
        .filter((w) => w.photoRef && w.photo)
        .map((w) => [w.photoRef, w.photo]),
    );
    let cursor = 0;
    const worker = async () => {
      while (cursor < s.wines.length) {
        const w = s.wines[cursor++];
        if (!w.photoRef) {
          w.photo = "";
          continue;
        }
        const cached = previous.get(w.photoRef);
        if (cached && (await this.photoName(cached)) === w.photoRef) {
          w.photo = cached;
          continue;
        }
        const item = this.items.get(w.photoRef);
        if (!item)
          throw Error(
            "Une photo manque dans OneDrive. Aucun état partiel n’a été chargé.",
          );
        const bytes = await this.bytes(item, 800000);
        const hash = await this.digest(bytes);
        if ("mc-photo-" + hash + ".jpg" !== w.photoRef)
          throw Error("Photo OneDrive altérée");
        w.photo = await this.dataURL(new Blob([bytes], { type: "image/jpeg" }));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    Backup.validate(s);
    return s;
  },
  dataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(Error("Lecture de photo impossible"));
      r.readAsDataURL(blob);
    });
  },
  digest(bytes) {
    return crypto.subtle
      .digest("SHA-256", bytes)
      .then((b) =>
        Array.from(new Uint8Array(b), (x) =>
          x.toString(16).padStart(2, "0"),
        ).join(""),
      );
  },
  photoBytes(data) {
    const b64 = data.split(",")[1],
      str = atob(b64);
    return Uint8Array.from(str, (c) => c.charCodeAt(0));
  },
  async photoName(data) {
    return "mc-photo-" + (await this.digest(this.photoBytes(data))) + ".jpg";
  },
  async put(name, body, type) {
    // Tous les noms sont immuables : SHA-256 pour photo, UUID aléatoire pour révision.
    return this.graph(
      "/me/drive/items/" +
        encodeURIComponent(this.folder) +
        ":/" +
        encodeURIComponent(name) +
        ":/content",
      { method: "PUT", headers: { "Content-Type": type }, body },
    );
  },
  sameHeads(expected) {
    return (
      JSON.stringify(this.heads.map((n) => n.rev).sort()) ===
      JSON.stringify([...expected].sort())
    );
  },
  assertWritable() {
    if (!this.account) throw Error("Connecte ton OneDrive pour enregistrer.");
    if (!navigator.onLine)
      throw Error(
        "Hors connexion : consultation uniquement. Ton formulaire reste ouvert.",
      );
    if (DB.pending)
      throw Error(
        "Une sauvegarde reste à vérifier. Utilise Vérifier / réessayer dans le bandeau.",
      );
    if (!this.ready || this.conflicts.length)
      throw Error(
        "Actualise la cave ou résous les versions concurrentes avant d’enregistrer.",
      );
  },
  async exclusive(fn) {
    const run = async () => {
      if (this.busy) throw Error("Une synchronisation est déjà en cours.");
      this.busy = true;
      this.paint();
      try {
        const cached = DB.key ? await DB.read(DB.key) : null;
        if (
          cached &&
          ((cached.base || null) !== DB.base ||
            (cached.pending?.id || null) !== (DB.pending?.id || null))
        ) {
          DB.state = cached.state;
          DB.base = cached.base || null;
          DB.pending = cached.pending || null;
          this.ready = false;
          throw Error(
            "Un autre onglet a changé le cache. Ferme le formulaire puis actualise avant de recommencer.",
          );
        }
        return await fn();
      } finally {
        this.busy = false;
        this.paint();
      }
    };
    return navigator.locks
      ? navigator.locks.request("ma-cave:" + DB.key, run)
      : run();
  },
  async save(next) {
    return this.exclusive(async () => {
      this.assertWritable();
      const cached = await DB.read(DB.key);
      if ((cached?.base || null) !== DB.base)
        throw Error(
          "Un autre onglet a modifié la cave. Actualise avant de restaurer.",
        );
      return this.saveUnlocked(next);
    });
  },
  async saveUnlocked(next, parents = null) {
    Backup.validate(next);
    if (next.wines.length > 100)
      throw Error(
        "La limite est de 100 références, sans limite de 100 bouteilles.",
      );
    const expected = parents || (DB.base ? [DB.base] : []);
    await this.list();
    if (!this.sameHeads(expected)) {
      this.ready = false;
      this.conflicts = this.heads.length > 1 ? this.heads : [];
      throw Error(
        "La cave a changé sur un autre appareil. Ferme le formulaire et actualise avant de recommencer.",
      );
    }
    const pending = {
      id: crypto.randomUUID().replaceAll("-", ""),
      parents: expected,
      state: next,
      createdAt: new Date().toISOString(),
    };
    // Persister le brouillon AVANT toute écriture réseau pour récupérer une réponse perdue.
    await DB.cache(DB.state, DB.base, pending);
    await this.sendPending();
  },
  async sendPending() {
    const p = DB.pending;
    if (!p) throw Error("Aucun brouillon à vérifier");
    await this.list();
    if (this.items.has(this.revisionName(p.id, p.parents))) {
      await this.loadHeads(true);
      if (this.conflicts.length)
        throw Error("Sauvegarde conservée. Compare les versions concurrentes.");
      return;
    }
    if (!this.sameHeads(p.parents)) {
      this.ready = false;
      throw Error(
        "Une autre version existe. Exporte le brouillon, puis abandonne-le avant d’actualiser. Il n’a pas été envoyé.",
      );
    }
    const remote = structuredClone(p.state);
    for (const w of remote.wines) {
      if (w.photo) {
        const bytes = this.photoBytes(w.photo);
        if (bytes.byteLength > 800000)
          throw Error("Photo trop lourde. Reprends-la depuis le formulaire.");
        w.photoRef = "mc-photo-" + (await this.digest(bytes)) + ".jpg";
        if (!this.items.has(w.photoRef)) {
          await this.put(w.photoRef, bytes, "image/jpeg");
          this.items.set(w.photoRef, { name: w.photoRef });
        }
      } else delete w.photoRef;
      w.photo = "";
    }
    // Recontrôler après les photos, qui peuvent prendre plusieurs secondes.
    await this.list();
    if (!this.sameHeads(p.parents))
      throw Error(
        "La cave a changé pendant l’envoi des photos. Exporte puis abandonne ce brouillon et actualise.",
      );
    const record = {
      schema: 2,
      id: p.id,
      parents: p.parents,
      createdAt: p.createdAt,
      state: remote,
    };
    if (new TextEncoder().encode(JSON.stringify(record)).byteLength > 4000000)
      throw Error(
        "Les informations dépassent 4 Mo hors photos. Exporte le brouillon avant de réduire l’historique.",
      );
    await this.put(
      this.revisionName(p.id, p.parents),
      JSON.stringify(record),
      "application/json",
    );
    await this.list();
    if (!this.items.has(this.revisionName(p.id, p.parents)))
      throw Error(
        "OneDrive n’a pas encore confirmé cette version. Utilise Vérifier / réessayer.",
      );
    await this.loadHeads(true);
    if (this.conflicts.length)
      throw Error(
        "Sauvegarde conservée, mais deux versions existent. Ferme ce formulaire puis compare les versions.",
      );
  },
  async loadHeads(clearPending = false) {
    this.conflicts = this.heads.length > 1 ? this.heads : [];
    if (this.conflicts.length) {
      if (clearPending) await DB.cache(DB.state, DB.base, null);
      this.ready = false;
      this.message = "Deux versions concurrentes · choix nécessaire";
      return;
    }
    if (this.heads.length === 0) {
      if (DB.base)
        throw Error(
          "Les versions de cette cave ont disparu de OneDrive. Restaure les fichiers depuis sa corbeille.",
        );
      await DB.cache(DB.empty(), null, clearPending ? null : DB.pending);
    } else {
      const head = this.heads[0];
      if (head.rev !== DB.base || clearPending) {
        const s = await this.hydrate(head);
        await DB.cache(s, head.rev, clearPending ? null : DB.pending);
      }
    }
    this.ready = !DB.pending;
    this.lastSync = new Date();
    this.message = this.ready ? "À jour sur OneDrive" : "Sauvegarde à vérifier";
  },
  async refresh(render = true) {
    if (this.busy) return;
    try {
      await this.exclusive(async () => {
        this.ready = false;
        if (!navigator.onLine) {
          this.message = "Hors connexion · consultation uniquement";
          return;
        }
        await this.list();
        if (DB.pending) {
          if (
            this.items.has(this.revisionName(DB.pending.id, DB.pending.parents))
          )
            await this.loadHeads(true);
          else {
            this.message = "Sauvegarde non confirmée · brouillon conservé";
            this.conflicts = this.heads.length > 1 ? this.heads : [];
          }
        } else await this.loadHeads();
      });
    } catch (e) {
      this.error(e);
    } finally {
      if (render && !modal.open) App.render();
      this.paint();
    }
  },
  async retry() {
    try {
      await this.exclusive(async () => {
        if (!navigator.onLine) throw Error("Internet nécessaire");
        await this.sendPending();
      });
      if (!modal.open) App.render();
      UI.toast(
        DB.pending ? "Sauvegarde encore à vérifier" : "Sauvegarde vérifiée",
      );
    } catch (e) {
      this.error(e);
    }
  },
  async discard() {
    if (!DB.pending) return;
    if (
      !confirm(
        "Abandonner uniquement le brouillon local non confirmé ? Exporte-le d’abord si tu veux le conserver. Les versions déjà présentes sur OneDrive restent intactes.",
      )
    )
      return;
    try {
      await this.exclusive(async () => {
        await this.list();
        if (
          this.items.has(this.revisionName(DB.pending.id, DB.pending.parents))
        ) {
          await this.loadHeads(true);
          return;
        }
        await DB.cache(DB.state, DB.base, null);
        await this.loadHeads();
      });
      App.render();
    } catch (e) {
      this.error(e);
    }
  },
  exportDraft() {
    if (DB.pending)
      Backup.download(
        DB.pending.state,
        "ma-cave-brouillon-" + UI.date() + ".json",
      );
  },
  async conflictDialog() {
    try {
      await this.list();
      if (this.heads.length < 2) {
        await this.refresh();
        return;
      }
      if (this.heads.length > 5)
        throw Error(
          "Plus de cinq branches : exporte les données et contacte le mainteneur.",
        );
      const entries = [];
      for (const n of this.heads) {
        const r = await this.readRevision(n);
        entries.push({ n, r });
      }
      UI.modal(
        "<h2>Versions concurrentes</h2><p>Deux appareils ont enregistré au même moment. Aucune version n’a été écrasée. Exporte chacune si nécessaire, puis choisis celle qui servira de base. Réintroduis ensuite les différences utiles depuis l’autre export.</p>" +
          entries
            .map(
              ({ n, r }) =>
                `<section class="card"><b>${UI.esc(new Date(r.createdAt).toLocaleString("fr-FR"))}</b><p>${r.state.wines.length} références · ${r.state.wines.reduce((a, w) => a + w.qty, 0)} bouteilles · version ${n.rev.slice(0, 8)}</p><div class="actions"><button class="secondary" onclick="Cloud.exportRevision('${n.rev}')">Exporter cette version</button><button onclick="Cloud.resolve('${n.rev}')">Choisir cette version</button></div></section>`,
            )
            .join(""),
      );
    } catch (e) {
      this.error(e);
    }
  },
  async exportRevision(id) {
    try {
      const n = this.heads.find((n) => n.rev === id);
      if (!n) throw Error("Version introuvable");
      const s = await this.hydrate(n);
      Backup.download(s, "ma-cave-version-" + id.slice(0, 8) + ".json");
    } catch (e) {
      this.error(e);
    }
  },
  async resolve(id) {
    if (DB.pending) {
      UI.toast(
        "Vérifie ou exporte puis abandonne le brouillon avant de résoudre les versions.",
      );
      return;
    }
    const parents = this.heads.map((n) => n.rev),
      node = this.heads.find((n) => n.rev === id);
    if (!node) return;
    if (
      !confirm(
        "Utiliser cette version comme cave courante ? Les autres versions restent conservées dans OneDrive. Il n’y a pas de fusion automatique.",
      )
    )
      return;
    try {
      await this.exclusive(async () => {
        const chosen = await this.hydrate(node);
        await this.saveUnlocked(chosen, parents);
      });
      modal.close();
      App.render();
    } catch (e) {
      this.error(e);
    }
  },
  async migrate() {
    if (!DB.legacy) {
      UI.toast("Aucune ancienne cave locale trouvée.");
      return;
    }
    if (DB.state.wines.length || DB.base) {
      UI.toast(
        "La cave OneDrive existe déjà. Utilise un export JSON puis la restauration si nécessaire.",
      );
      return;
    }
    if (!confirm("Copier ton ancienne cave locale dans ce compte OneDrive ?"))
      return;
    try {
      await DB.save(structuredClone(DB.legacy));
      App.render();
      UI.toast("Cave locale copiée dans OneDrive");
    } catch (e) {
      this.error(e);
    }
  },
  error(e) {
    this.ready = false;
    this.message = e.message || "Synchronisation indisponible";
    UI.toast(this.message);
    this.paint();
  },
  paint() {
    if (!this.busy && DB.pending)
      this.message = "Sauvegarde à vérifier · brouillon conservé";
    else if (
      !this.busy &&
      this.account &&
      !this.ready &&
      this.message.startsWith("À jour")
    )
      this.message = "Actualisation nécessaire avant enregistrement";
    const el = document.getElementById("syncStatus");
    if (!el) return;
    const account = this.account
      ? UI.esc(this.account.username || "Compte Microsoft connecté")
      : "Compte Microsoft personnel";
    el.innerHTML =
      `<div><strong>${this.busy ? "Synchronisation en cours…" : UI.esc(this.message)}</strong><br><span class="muted">${account}${this.lastSync ? " · vérifié à " + this.lastSync.toLocaleTimeString("fr-FR") : ""}</span></div><div class="actions">` +
      (this.account
        ? `<button class="secondary" onclick="Cloud.refresh()" ${this.busy ? "disabled" : ""}>Actualiser</button>${this.needsLogin ? '<button onclick="Cloud.login()">Reconnecter</button>' : ""}${DB.pending ? '<button onclick="Cloud.retry()">Vérifier / réessayer</button><button class="secondary" onclick="Cloud.exportDraft()">Exporter le brouillon</button><button class="secondary" onclick="Cloud.discard()">Abandonner le brouillon</button>' : ""}${this.conflicts.length ? '<button onclick="Cloud.conflictDialog()">Comparer les versions</button>' : ""}`
        : '<button onclick="Cloud.login()">Connecter mon OneDrive</button>') +
      "</div>";
  },
};
