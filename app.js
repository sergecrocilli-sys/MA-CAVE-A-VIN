const view = document.getElementById("view"),
  modal = document.getElementById("modal");
window.App = {
  async init() {
    try {
      await DB.init();
      modal.addEventListener("close", () => this.releasePhoto());
      window.addEventListener("hashchange", () => this.render());
      this.render();
      if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker
          .register("sw.js")
          .then((reg) => {
            const announce = () => {
              if (reg.waiting)
                UI.toast(
                  "Mise à jour prête : ferme complètement Ma Cave puis rouvre-la.",
                );
            };
            announce();
            reg.addEventListener("updatefound", () => {
              reg.installing?.addEventListener("statechange", announce);
            });
          })
          .catch(() =>
            UI.toast("Cache hors ligne indisponible dans ce navigateur."),
          );
      }
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        this.installPrompt = e;
      });
    } catch (e) {
      view.innerHTML =
        "<h1>Stockage indisponible</h1><p>Ouvre cette application dans un navigateur autorisant IndexedDB, hors navigation privée. Aucune donnée ne peut être enregistrée pour le moment.</p>";
    }
  },
  render() {
    let [page, id] = (location.hash.slice(1) || "dashboard").split("/");
    document.getElementById("nav").innerHTML = [
      ["dashboard", "⌂", "Accueil"],
      ["cave", "▤", "Ma Cave"],
      ["emplacements", "▦", "Casiers"],
      ["degustations", "♧", "Dégustations"],
      ["settings", "⚙", "Réglages"],
    ]
      .map(
        ([key, icon, label]) =>
          `<a class="${page === key || (page === "bouteille" && key === "cave") ? "active" : ""}" href="#${key}">${icon} ${label}</a>`,
      )
      .join("");
    if (page === "cave") Wine.list();
    else if (page === "bouteille") Wine.detail(id);
    else if (page === "degustations") Tasting.list();
    else if (page === "settings") this.settings();
    else if (page === "emplacements") this.locations();
    else this.dashboard();
  },
  dashboard() {
    let s = DB.state,
      qty = s.wines.reduce((n, w) => n + w.qty, 0),
      value = s.wines.reduce((n, w) => n + w.qty * w.value, 0),
      ready = s.wines
        .filter((w) => UI.status(w) === "À déguster")
        .reduce((n, w) => n + w.qty, 0),
      late = s.wines
        .filter((w) => UI.status(w) === "Fenêtre dépassée")
        .reduce((n, w) => n + w.qty, 0),
      regions = {};
    s.wines.forEach(
      (w) =>
        (regions[w.region || "Non renseignée"] =
          (regions[w.region || "Non renseignée"] || 0) + w.qty),
    );
    view.innerHTML = `<section class="hero"><span class="overline">L’ART DE PRENDRE LE TEMPS</span><h1>Bienvenue dans<br>ta cave privée.</h1><p>${UI.esc(s.prefs.name)} — un lieu pour tes vins et leurs histoires.</p><a class="btn secondary" href="#cave">Explorer ma collection →</a></section><div class="stats">${[
      [qty, "Bouteilles en cave"],
      [UI.money(value), "Valeur saisie du stock"],
      [ready, "Dans leur fenêtre de dégustation"],
      [late, "Fenêtre de dégustation dépassée"],
    ]
      .map(
        ([n, l]) => `<div class="card stat"><b>${n}</b><span>${l}</span></div>`,
      )
      .join(
        "",
      )}</div><div class="grid"><section class="card"><h2>Les terroirs de ta cave</h2>${
      Object.entries(regions)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([r, n]) =>
            `<div>${UI.esc(r)} <span style="float:right">${n} bt.</span><div class="bar"><i style="width:${qty ? (n / qty) * 100 : 0}%"></i></div></div>`,
        )
        .join("") || "<p>La collection commence avec ta première bouteille.</p>"
    }</section><section class="card"><h2>À savourer, à surveiller</h2><p>Les fenêtres sont renseignées par toi. Leur dépassement ne signifie pas que le vin est impropre à boire.</p>${
      s.wines
        .filter(
          (w) =>
            w.qty > 0 &&
            ["À déguster", "Fenêtre dépassée"].includes(UI.status(w)),
        )
        .slice(0, 4)
        .map(
          (w) =>
            `<p><a href="#bouteille/${w.id}">${UI.esc(w.name)}</a><br><span class="pill">${UI.status(w)}</span></p>`,
        )
        .join("") || "<p>Aucune alerte pour le moment.</p>"
    }</section></div>`;
  },
  edit(id) {
    if (!id && DB.state.wines.length >= 100) {
      UI.toast(
        "Limite de 100 références atteinte. Tu peux modifier les quantités des vins existants.",
      );
      return;
    }
    let w = DB.state.wines.find((w) => w.id === id) || {
      id: UI.id(),
      name: "",
      domain: "",
      appellation: "",
      region: "",
      vintage: 0,
      grapes: "",
      type: "Rouge",
      qty: 1,
      price: 0,
      value: 0,
      volume: 75,
      entry: UI.date(),
      start: 0,
      end: 0,
      location: "",
      row: 1,
      col: 1,
      notes: "",
      photo: "",
    };
    let f = UI.field;
    UI.modal(
      `<span class="overline">LA COLLECTION</span><h2>${id ? "Modifier le vin" : "Ajouter un vin"}</h2><form id="wineForm"><div class="photo-tools"><div class="photo-actions"><label class="btn photo-button">📷 Prendre une photo<input class="file-hidden" name="camera" type="file" accept="image/*" capture="environment" onchange="App.photoPicked(this)"></label><label class="btn secondary photo-button">Choisir une image<input class="file-hidden" name="photo" type="file" accept="image/*" onchange="App.photoPicked(this)"></label></div><p class="small">Photographie l’étiquette ou importe une image de ton téléphone. Elle restera sur cet appareil.</p><img id="photoPreview" alt="Aperçu de l’étiquette" ${w.photo ? 'src="' + UI.esc(w.photo) + '"' : "hidden"}><span id="photoInfo" class="muted" aria-live="polite"></span></div>${w.photo ? '<label><input style="width:auto" type="checkbox" name="clearPhoto"> Supprimer la photo actuelle</label>' : ""}<div class="grid">${f("name", "Nom du vin *", w.name, "text", 'required maxlength="200"')}${f("domain", "Domaine", w.domain)}${f("appellation", "Appellation", w.appellation)}${f("region", "Région", w.region)}${f("vintage", "Millésime (0 = non millésimé)", w.vintage, "number", 'min="0" max="2200" required')}<label>Type<select name="type">${["Rouge", "Blanc", "Rosé", "Effervescent", "Liquoreux", "Autre"].map((t) => `<option ${t === w.type ? "selected" : ""}>${t}</option>`).join("")}</select></label>${f("grapes", "Cépages", w.grapes)}${f("volume", "Volume (cl)", w.volume, "number", 'min="1" max="3000" required')}${f("qty", "Quantité en stock", w.qty, "number", 'min="0" max="100000" required')}${f("price", "Prix d’achat unitaire (€)", w.price, "number", 'min="0" max="10000000" step="0.01" required')}${f("value", "Valeur estimée unitaire saisie (€)", w.value, "number", 'min="0" max="10000000" step="0.01" required')}${f("entry", "Date d’entrée", w.entry, "date", "required")}${f("start", "À boire à partir de (année, 0 = inconnu)", w.start, "number", 'min="0" max="2300" required')}${f("end", "Fin de garde (année, 0 = inconnue)", w.end, "number", 'min="0" max="2300" required')}<label>Cave / meuble<select name="location"><option value="">Non placé</option>${DB.state.locations.map((l) => `<option value="${l.id}" ${l.id === w.location ? "selected" : ""}>${UI.esc(l.name)} (${l.rows} × ${l.cols})</option>`).join("")}</select></label>${f("row", "Rangée (numéro)", w.row, "number", 'min="1" max="26" required')}${f("col", "Colonne", w.col, "number", 'min="1" max="50" required')}</div><label>Notes personnelles<textarea name="notes">${UI.esc(w.notes)}</textarea></label><p class="small">Une référence occupe un casier. Pour répartir un même vin entre plusieurs casiers, crée une référence par casier. La valeur n’est pas une cotation de marché.</p><button>Enregistrer le vin</button></form>`,
    );
    document.getElementById("wineForm").onsubmit = async (e) => {
      e.preventDefault();
      let button = e.submitter;
      button.disabled = true;
      try {
        let data = new FormData(e.target),
          n = { ...w };
        for (let k of [
          "name",
          "domain",
          "appellation",
          "region",
          "grapes",
          "type",
          "entry",
          "location",
          "notes",
        ])
          n[k] = String(data.get(k)).trim();
        for (let k of [
          "vintage",
          "qty",
          "price",
          "value",
          "volume",
          "start",
          "end",
          "row",
          "col",
        ])
          n[k] = Number(data.get(k));
        if (!n.name) throw Error("Nom du vin obligatoire");
        if (n.start && n.end && n.start > n.end)
          throw Error("La fin de garde précède le début");
        if (data.get("clearPhoto")) n.photo = "";
        let photo = data.get("camera")?.size
          ? data.get("camera")
          : data.get("photo");
        if (photo?.size) n.photo = await UI.image(photo);
        await DB.mutate((s) => {
          Wine.capacity(n, s);
          let i = s.wines.findIndex((x) => x.id === n.id),
            delta = n.qty - (i < 0 ? 0 : s.wines[i].qty);
          if (i < 0) s.wines.push(n);
          else s.wines[i] = n;
          if (delta)
            Moves.record(
              s,
              n,
              delta,
              i < 0 ? "Stock initial" : "Correction de stock",
            );
        });
        modal.close();
        location.hash = "bouteille/" + n.id;
        this.render();
        UI.toast("Vin enregistré");
      } catch (e) {
        UI.toast(e.message);
      } finally {
        button.disabled = false;
      }
    };
  },
  photoPicked(input) {
    const other =
      input.form.elements[input.name === "camera" ? "photo" : "camera"];
    other.value = "";
    const preview = document.getElementById("photoPreview"),
      info = document.getElementById("photoInfo");
    if (preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
    const file = input.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      preview.dataset.url = url;
      preview.src = url;
      preview.hidden = false;
      info.textContent =
        "Photo sélectionnée. Enregistre le vin pour la conserver.";
      const clear = input.form.elements.clearPhoto;
      if (clear) clear.checked = false;
    }
  },
  releasePhoto() {
    const img = document.getElementById("photoPreview");
    if (img?.dataset.url) {
      URL.revokeObjectURL(img.dataset.url);
      delete img.dataset.url;
    }
  },
  stock(id) {
    UI.modal(
      `<h2>Mouvement de stock</h2><form id="stockForm"><label>Opération<select name="direction"><option value="1">Entrée</option><option value="-1">Sortie</option></select></label>${UI.field("count", "Nombre de bouteilles", 1, "number", 'min="1" max="100000" required')}${UI.field("reason", "Motif", "", "text", "required")}<button>Valider</button></form>`,
    );
    document.getElementById("stockForm").onsubmit = async (e) => {
      e.preventDefault();
      let f = new FormData(e.target),
        button = e.submitter;
      button.disabled = true;
      try {
        await Moves.change(
          id,
          +f.get("direction") * +f.get("count"),
          f.get("reason"),
        );
        modal.close();
        UI.toast("Stock mis à jour");
      } catch (e) {
        UI.toast(e.message);
      } finally {
        button.disabled = false;
      }
    };
  },
  async remove(id) {
    if (
      confirm(
        "Supprimer ce vin et son stock ? Les dégustations et mouvements resteront dans les historiques sauvegardés.",
      )
    ) {
      try {
        await DB.mutate((s) => (s.wines = s.wines.filter((w) => w.id !== id)));
        location.hash = "cave";
        this.render();
      } catch (e) {
        UI.toast(e.message);
      }
    }
  },
  locations() {
    view.innerHTML = `<span class="overline">CHAQUE BOUTEILLE À SA PLACE</span><h1>Emplacements de cave</h1><p>Une grille par cave ou meuble, avec une capacité par casier.</p><button onclick="App.addLocation()">＋ Créer un emplacement</button><div style="margin-top:25px">${
      DB.state.locations
        .map((l) => {
          let used = DB.state.wines
            .filter((w) => w.location === l.id)
            .reduce((n, w) => n + w.qty, 0);
          return `<section class="card"><h2>${UI.esc(l.name)}</h2><p>${used} / ${l.rows * l.cols * l.capacity} bouteilles · ${l.capacity} par casier</p><div class="rack" style="grid-template-columns:repeat(${l.cols},minmax(75px,1fr))">${Array.from(
            { length: l.rows * l.cols },
            (_, i) => {
              let r = Math.floor(i / l.cols) + 1,
                c = (i % l.cols) + 1,
                n = DB.state.wines
                  .filter(
                    (w) => w.location === l.id && w.row === r && w.col === c,
                  )
                  .reduce((n, w) => n + w.qty, 0);
              return `<button class="slot ${n ? "used" : ""}" onclick="App.slot('${l.id}',${r},${c})">R${r} · C${c}<br>${n} / ${l.capacity}</button>`;
            },
          ).join(
            "",
          )}</div><div class="actions"><button class="secondary" onclick="App.deleteLocation('${l.id}')">Supprimer l’emplacement</button></div></section>`;
        })
        .join("") ||
      '<div class="card empty">Crée ta première cave, armoire ou étagère.</div>'
    }</div>`;
  },
  slot(id, row, col) {
    let a = DB.state.wines.filter(
      (w) => w.location === id && w.row === row && w.col === col,
    );
    UI.modal(
      `<h2>Rangée ${row} · Colonne ${col}</h2>${a.map((w) => `<p><a href="#bouteille/${w.id}" onclick="modal.close()">${UI.esc(w.name)} · ${w.qty} bt.</a></p>`).join("") || "<p>Casier vide. Affecte un vin ici depuis sa fiche.</p>"}`,
    );
  },
  addLocation() {
    UI.modal(
      `<h2>Nouvel emplacement</h2><form id="locForm">${UI.field("name", "Nom", "", "text", 'required maxlength="100"')}${UI.field("rows", "Rangées", 4, "number", 'min="1" max="26" required')}${UI.field("cols", "Colonnes", 4, "number", 'min="1" max="50" required')}${UI.field("capacity", "Bouteilles par casier", 6, "number", 'min="1" max="1000" required')}<button>Créer la grille</button></form>`,
    );
    document.getElementById("locForm").onsubmit = async (e) => {
      e.preventDefault();
      let f = new FormData(e.target);
      try {
        await DB.mutate((s) =>
          s.locations.push({
            id: UI.id(),
            name: f.get("name").trim(),
            rows: +f.get("rows"),
            cols: +f.get("cols"),
            capacity: +f.get("capacity"),
          }),
        );
        modal.close();
        this.render();
      } catch (e) {
        UI.toast(e.message);
      }
    };
  },
  async deleteLocation(id) {
    if (DB.state.wines.some((w) => w.location === id)) {
      UI.toast("Déplace d’abord toutes les références de cet emplacement.");
      return;
    }
    if (confirm("Supprimer cet emplacement ?")) {
      try {
        await DB.mutate(
          (s) => (s.locations = s.locations.filter((l) => l.id !== id)),
        );
        this.render();
      } catch (e) {
        UI.toast(e.message);
      }
    }
  },
  settings() {
    view.innerHTML = `<span class="overline">TON ESPACE PRIVÉ</span><h1>Paramètres</h1><div class="grid"><section class="card"><h2>Sauvegarde & restauration</h2><p>Le fichier JSON contient les vins, photos, casiers, dégustations et mouvements.</p><button onclick="Backup.export()">Exporter ma cave</button><label style="margin-top:20px">Restaurer une sauvegarde JSON<input type="file" accept=".json,application/json" onchange="Backup.import(this.files[0]);this.value='' "></label><p class="small">Les données restent dans ce navigateur. Effacer ses données peut supprimer la cave. Conserve régulièrement une sauvegarde sur un autre support.</p></section><section class="card"><h2>Préférences</h2><p>${DB.state.wines.length} / 100 références · plusieurs bouteilles possibles par référence.</p><form id="prefsForm">${UI.field("name", "Nom de la collection", DB.state.prefs.name, "text", 'maxlength="200" required')}<button>Enregistrer</button></form><h3>Emplacements</h3><a href="#emplacements">Gérer les caves et casiers →</a></section><section class="card"><h2>Application</h2><p>Ma Cave V1.2 Mobile · Sans compte · Données et photos sur ce téléphone.</p><button class="secondary" onclick="App.install()">Installer l’application</button><p class="small">Sur iPhone : ouvre l’adresse GitHub Pages dans Safari, puis Partager → Sur l’écran d’accueil. Ouvre ensuite la version installée pour commencer ta cave. Un chargement complet avec Internet est nécessaire avant le premier usage hors ligne.</p></section><section class="card"><h2>Comprendre les indicateurs</h2><p>Valeur = quantité × valeur unitaire saisie. Les alertes utilisent tes années de début et fin de garde. Elles ne prédisent pas la qualité réelle du vin.</p><p>La photo d’étiquette est conservée localement et redimensionnée ; aucune reconnaissance automatique.</p></section></div>`;
    document.getElementById("prefsForm").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await DB.mutate(
          (s) => (s.prefs.name = new FormData(e.target).get("name").trim()),
        );
        UI.toast("Préférences enregistrées");
      } catch (e) {
        UI.toast(e.message);
      }
    };
  },
  async install() {
    if (this.installPrompt) {
      await this.installPrompt.prompt();
      this.installPrompt = null;
    } else
      UI.toast(
        "Utilise le menu d’installation du navigateur ; voir les instructions ci-dessous.",
      );
  },
};
App.init();
