window.Backup = {
  export() {
    let data = {
        ...DB.state,
        exportedAt: new Date().toISOString(),
        application: "MA_CAVE_V1.2_MOBILE",
      },
      blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "ma-cave-" + UI.date() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    UI.toast(
      "Export lancé, photos incluses. Conserve le JSON dans Fichiers ou sur un autre support.",
    );
  },
  validate(s) {
    if (!s || s.schema !== 1) throw Error("Format de sauvegarde incompatible");
    for (let k of ["wines", "locations", "tastings", "movements"])
      if (!Array.isArray(s[k])) throw Error("Sauvegarde incomplète");
    if (s.wines.length > 100)
      throw Error("La limite est de 100 références de vin.");
    const text = (v, max = 10000) => typeof v === "string" && v.length <= max;
    const num = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
    const integer = (v, min, max) => Number.isInteger(v) && num(v, min, max);
    for (let k of ["wines", "locations", "tastings", "movements"]) {
      let ids = new Set();
      for (let x of s[k]) {
        if (!x || !text(x.id, 100) || !/^[-\w]+$/.test(x.id) || ids.has(x.id))
          throw Error("Identifiants invalides");
        ids.add(x.id);
      }
    }
    for (let l of s.locations)
      if (
        !text(l.name, 200) ||
        !integer(l.rows, 1, 26) ||
        !integer(l.cols, 1, 50) ||
        !integer(l.capacity, 1, 1000)
      )
        throw Error("Emplacement invalide");
    for (let w of s.wines) {
      for (let k of [
        "name",
        "domain",
        "region",
        "appellation",
        "grapes",
        "notes",
        "type",
        "entry",
        "location",
      ])
        if (!text(w[k])) throw Error("Fiche vin invalide");
      if (
        !integer(w.qty, 0, 100000) ||
        !num(w.price, 0, 1e7) ||
        !num(w.value, 0, 1e7) ||
        !num(w.volume, 1, 3000) ||
        !integer(w.vintage, 0, 2200) ||
        !integer(w.start, 0, 2300) ||
        !integer(w.end, 0, 2300) ||
        (w.start && w.end && w.start > w.end)
      )
        throw Error("Valeurs de vin invalides");
      if (!integer(w.row, 1, 26) || !integer(w.col, 1, 50))
        throw Error("Coordonnées de casier invalides");
      if (
        w.photo &&
        (!text(w.photo, 5e6) ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(w.photo))
      )
        throw Error("Photo invalide");
      Wine.capacity(w, s);
    }
    for (let t of s.tastings)
      if (
        !text(t.wineId, 100) ||
        !text(t.wineName) ||
        !text(t.date, 30) ||
        !integer(t.rating, 1, 5) ||
        !text(t.notes) ||
        !text(t.pairing)
      )
        throw Error("Dégustation invalide");
    for (let m of s.movements)
      if (
        !text(m.wineId, 100) ||
        !text(m.date, 50) ||
        !text(m.reason) ||
        !integer(m.delta, -100000, 100000)
      )
        throw Error("Mouvement invalide");
    if (!s.prefs || !text(s.prefs.name, 200))
      throw Error("Préférences invalides");
    return s;
  },
  async import(file) {
    if (!file) return;
    try {
      if (file.size > 50e6)
        throw Error("Fichier trop volumineux (50 Mo maximum)");
      let s = this.validate(JSON.parse(await file.text()));
      if (
        !confirm(
          `Restaurer ${s.wines.length} références ? Cela remplacera toute la cave actuelle. Exporte-la d’abord si nécessaire.`,
        )
      )
        return;
      await DB.save(s);
      App.render();
      UI.toast("Cave restaurée");
    } catch (e) {
      UI.toast("Restauration refusée : " + e.message);
    }
  },
};
