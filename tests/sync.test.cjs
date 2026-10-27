/* Tests sans réseau ni identifiants Microsoft. Exécuter : node tests/sync.test.cjs */
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const clone = (x) => (x === undefined ? undefined : structuredClone(x));
class FakeDrive {
  constructor() {
    this.files = new Map();
    this.counter = 0;
    this.loseResponse = false;
    this.barrier = null;
    this.pendingWrites = [];
    this.pageSize = 2;
  }
  async fetch(url, opts = {}) {
    const u = new URL(url),
      method = opts.method || "GET";
    const json = (x) =>
      new Response(JSON.stringify(x), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (u.hostname === "download.test") {
      const f = [...this.files.values()].find(
        (f) => f.id === u.pathname.slice(1),
      );
      return f ? new Response(f.bytes) : new Response("", { status: 404 });
    }
    assert.equal(u.origin, "https://graph.microsoft.com");
    assert.equal(opts.headers.Authorization, "Bearer TEST_TOKEN");
    const p = decodeURIComponent(u.pathname);
    if (p.endsWith("/special/approot")) return json({ id: "folder" });
    if (p.endsWith("/children")) {
      const all = [...this.files.values()].map(({ id, name, bytes }) => ({
        id,
        name,
        size: bytes.length,
      }));
      const start = +(u.searchParams.get("offset") || 0),
        page = all.slice(start, start + this.pageSize);
      const next =
        start + this.pageSize < all.length
          ? "https://graph.microsoft.com/v1.0/me/drive/items/folder/children?offset=" +
            (start + this.pageSize)
          : undefined;
      return json({ value: page, "@odata.nextLink": next });
    }
    if (method === "PUT") {
      const name = p.match(/items\/folder:\/(.*):\/content$/)?.[1];
      assert.ok(name);
      if (this.barrier && name.startsWith("mc-r-")) {
        await new Promise((resolve) => {
          this.pendingWrites.push(resolve);
          if (this.pendingWrites.length === this.barrier) {
            this.pendingWrites.splice(0).forEach((r) => r());
            this.barrier = null;
          }
        });
      }
      const old = this.files.get(name),
        f = {
          id: old?.id || String(++this.counter),
          name,
          bytes:
            typeof opts.body === "string"
              ? Buffer.from(opts.body)
              : Buffer.from(opts.body),
        };
      if (name.startsWith("mc-r-"))
        assert.equal(
          old,
          undefined,
          "Une révision existante ne doit jamais être écrasée",
        );
      this.files.set(name, f);
      if (this.loseResponse && name.startsWith("mc-r-")) {
        this.loseResponse = false;
        throw Error("Network lost after upload");
      }
      return json({ id: f.id, name, size: f.bytes.length });
    }
    const id = p.match(/items\/([^/]+)$/)?.[1],
      f = [...this.files.values()].find((f) => f.id === id);
    return f
      ? json({
          id: f.id,
          size: f.bytes.length,
          "@microsoft.graph.downloadUrl": "https://download.test/" + f.id,
        })
      : new Response("", { status: 404 });
  }
}
function client(drive, cache = new Map(), accountId = "same-user") {
  const ctx = vm.createContext({
    crypto: webcrypto,
    AbortController,
    console,
    structuredClone,
    URL,
    Blob,
    Response,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    ArrayBuffer,
    Map,
    Set,
    setTimeout,
    clearTimeout,
    navigator: { onLine: true },
    location: { protocol: "https:", href: "https://example.test/index.html" },
    document: { getElementById: () => null },
    modal: { open: false },
    confirm: () => true,
    FileReader: class {
      readAsDataURL(blob) {
        blob.arrayBuffer().then((b) => {
          this.result =
            "data:" +
            blob.type +
            ";base64," +
            Buffer.from(b).toString("base64");
          this.onload();
        });
      }
    },
    atob: (x) => Buffer.from(x, "base64").toString("binary"),
    fetch: drive.fetch.bind(drive),
    CAVE_CONFIG: {
      clientId: "11111111-1111-4111-8111-111111111111",
      maxReferences: 100,
    },
    App: { render() {} },
    isSecureContext: true,
  });
  ctx.window = ctx;
  for (const f of [
    "database",
    "ui",
    "bouteilles",
    "exports",
    "onedrive",
    "mouvements",
  ])
    vm.runInContext(
      fs.readFileSync(path.join(root, "js", f + ".js"), "utf8"),
      ctx,
      { filename: f },
    );
  ctx.UI.toast = () => {};
  ctx.Cloud.paint = () => {};
  ctx.DB.read = async (key) => clone(cache.get(key));
  ctx.DB.write = async (key, value) => cache.set(key, clone(value));
  ctx.Cloud.account = {
    homeAccountId: accountId,
    username: accountId + "@example.test",
  };
  ctx.Cloud.msal = {
    acquireTokenSilent: async () => ({ accessToken: "TEST_TOKEN" }),
  };
  return ctx;
}
function wine(id = "vin", qty = 3) {
  return {
    id,
    name: "Vin test",
    domain: "Domaine",
    region: "Bordeaux",
    appellation: "Test",
    grapes: "Merlot",
    notes: "",
    type: "Rouge",
    entry: "2026-10-27",
    location: "",
    row: 1,
    col: 1,
    qty,
    price: 10,
    value: 12,
    volume: 75,
    vintage: 2020,
    start: 2024,
    end: 2030,
    photo: "",
  };
}
async function start(c) {
  await c.DB.select(c.Cloud.account);
  await c.Cloud.refresh(false);
  assert.equal(c.Cloud.ready, true, c.Cloud.message);
}
(async () => {
  const drive = new FakeDrive(),
    a = client(drive),
    b = client(drive);
  await start(a);
  await start(b);
  await a.DB.mutate((s) => s.wines.push(wine()));
  assert.equal(a.DB.state.wines[0].qty, 3);
  await b.Cloud.refresh(false);
  assert.equal(b.DB.state.wines[0].qty, 3);
  console.log("PASS : ajout PC -> lecture second appareil");
  await a.DB.mutate(
    (s) => (s.wines[0].photo = "data:image/jpeg;base64,/9j/2Q=="),
  );
  const snapshots = [...drive.files.values()].filter((x) =>
    x.name.startsWith("mc-r-"),
  );
  assert.ok(
    snapshots.every((x) => !x.bytes.toString().includes("data:image/")),
  );
  await b.Cloud.refresh(false);
  assert.equal(b.DB.state.wines[0].photo, "data:image/jpeg;base64,/9j/2Q==");
  assert.equal(
    [...drive.files.keys()].filter((x) => x.startsWith("mc-photo-")).length,
    1,
  );
  console.log("PASS : photos séparées, transfert, hash et pagination");
  await b.Moves.change("vin", -1, "Dégustation");
  await a.Cloud.refresh(false);
  assert.equal(a.DB.state.wines[0].qty, 2);
  assert.equal(a.DB.state.movements.length, 1);
  console.log("PASS : retrait de stock et historique synchronisés");
  // Une version distante connue bloque la soumission d'un formulaire plus ancien.
  await b.DB.mutate((s) => (s.wines[0].qty = 4));
  await assert.rejects(
    a.DB.mutate((s) => (s.wines[0].qty = 1)),
    /autre appareil/,
  );
  assert.equal(a.DB.pending, null);
  await a.Cloud.refresh(false);
  assert.equal(a.DB.state.wines[0].qty, 4);
  console.log("PASS : formulaire périmé bloqué avant écriture");
  a.navigator.onLine = false;
  await assert.rejects(
    a.DB.mutate((s) => (s.wines[0].qty = 0)),
    /Hors connexion/,
  );
  assert.equal(a.DB.state.wines[0].qty, 4);
  a.navigator.onLine = true;
  const bad = a.DB.empty();
  bad.wines = Array.from({ length: 101 }, (_, i) => wine("vin" + i));
  assert.throws(() => a.Backup.validate(bad), /100 références/);
  console.log("PASS : hors ligne en lecture et limite de 100 références");
  drive.loseResponse = true;
  await assert.rejects(a.DB.mutate((s) => (s.wines[0].qty = 5)));
  assert.ok(a.DB.pending);
  const pendingId = a.DB.pending.id;
  await a.Cloud.refresh(false);
  assert.equal(a.DB.pending, null);
  assert.equal(a.DB.state.wines[0].qty, 5);
  assert.equal(
    [...drive.files.keys()].filter((n) => n.includes(pendingId)).length,
    1,
  );
  console.log("PASS : réponse perdue, récupération sans double mouvement");
  // Deux écritures passent toutes deux le contrôle préalable : conserver les deux branches.
  await b.Cloud.refresh(false);
  drive.barrier = 2;
  const results = await Promise.allSettled([
    a.DB.mutate((s) => (s.wines[0].qty = 6)),
    b.DB.mutate((s) => (s.wines[0].qty = 7)),
  ]);
  await a.Cloud.refresh(false);
  await b.Cloud.refresh(false);
  assert.equal(a.Cloud.heads.length, 2);
  assert.equal(a.Cloud.ready, false);
  assert.equal(b.Cloud.heads.length, 2);
  const quantities = [];
  for (const head of a.Cloud.heads)
    quantities.push((await a.Cloud.hydrate(head)).wines[0].qty);
  assert.deepEqual(quantities.sort(), [6, 7]);
  console.log(
    "PASS : concurrence réelle, deux versions conservées sans écrasement",
  );
  const head = a.Cloud.heads[0],
    chosen = await a.Cloud.hydrate(head),
    parents = a.Cloud.heads.map((n) => n.rev);
  await a.Cloud.exclusive(() => a.Cloud.saveUnlocked(chosen, parents));
  await b.Cloud.refresh(false);
  assert.equal(b.Cloud.heads.length, 1);
  assert.equal(b.DB.state.wines[0].qty, chosen.wines[0].qty);
  console.log("PASS : résolution explicite et convergence");
  // Cache navigateur partagé entre deux comptes, sans mélange des caves.
  const cache = new Map(),
    x = client(new FakeDrive(), cache, "alice"),
    y = client(new FakeDrive(), cache, "bob");
  await start(x);
  await start(y);
  await x.DB.cache({ ...x.DB.empty(), wines: [wine("alice-vin")] }, null);
  await y.DB.select(y.Cloud.account);
  assert.equal(y.DB.state.wines.length, 0);
  assert.notEqual(x.DB.key, y.DB.key);
  console.log("PASS : isolation du cache par compte");
  // Un autre onglet a un brouillon ; le premier ne doit jamais l'écraser.
  const d2 = new FakeDrive(),
    cache2 = new Map(),
    tab1 = client(d2, cache2),
    tab2 = client(d2, cache2);
  await start(tab1);
  await start(tab2);
  await tab2.DB.cache(tab2.DB.state, null, {
    id: "e".repeat(32),
    parents: [],
    state: tab2.DB.empty(),
    createdAt: new Date().toISOString(),
  });
  await assert.rejects(
    tab1.DB.mutate((s) => s.wines.push(wine())),
    /autre onglet/,
  );
  assert.ok(tab1.DB.pending);
  console.log("PASS : brouillon protégé entre onglets");
  console.log(
    "Tous les tests simulés ont réussi. Authentification Microsoft et capture iPhone réelles non testées.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
