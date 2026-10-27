window.Wine = {
  capacity(w, s = DB.state) {
    if (!w.location) return;
    let l = s.locations.find((l) => l.id === w.location);
    if (!l || w.row < 1 || w.row > l.rows || w.col < 1 || w.col > l.cols)
      throw Error("Casier invalide");
    let used = s.wines
      .filter(
        (x) =>
          x.id !== w.id &&
          x.location === w.location &&
          x.row === w.row &&
          x.col === w.col,
      )
      .reduce((n, x) => n + x.qty, 0);
    if (used + w.qty > l.capacity) throw Error("Capacité du casier dépassée");
  },
  list() {
    view.innerHTML = `<span class="overline">L’INVENTAIRE</span><h1>Ma Cave</h1><p>Chaque vin, à sa place.</p><div class="toolbar"><input id="search" aria-label="Rechercher" placeholder="Rechercher un vin, domaine, cépage…"><select id="region" aria-label="Région"><option value="">Toutes les régions</option>${[
      ...new Set(DB.state.wines.map((w) => w.region)),
    ]
      .sort()
      .map((r) => `<option>${UI.esc(r)}</option>`)
      .join(
        "",
      )}</select><select id="maturity" aria-label="Maturité"><option value="">Toutes les maturités</option>${["À conserver", "À déguster", "Fenêtre dépassée", "Maturité non renseignée"].map((s) => `<option>${s}</option>`).join("")}</select><select id="sort" aria-label="Trier"><option value="name">Nom du vin</option><option value="vintage">Millésime</option><option value="qty">Quantité</option></select></div><div id="results"></div>`;
    ["search", "region", "maturity", "sort"].forEach(
      (id) => (document.getElementById(id).oninput = () => this.filter()),
    );
    this.filter();
  },
  filter() {
    let q = document.getElementById("search").value.toLocaleLowerCase("fr"),
      r = document.getElementById("region").value,
      m = document.getElementById("maturity").value,
      sort = document.getElementById("sort").value;
    let a = DB.state.wines
      .filter(
        (w) =>
          [w.name, w.domain, w.region, w.appellation, w.grapes]
            .join(" ")
            .toLocaleLowerCase("fr")
            .includes(q) &&
          (!r || w.region === r) &&
          (!m || UI.status(w) === m),
      )
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name) : a[sort] - b[sort],
      );
    document.getElementById("results").innerHTML =
      `<p>${a.length} référence(s) · ${a.reduce((n, w) => n + w.qty, 0)} bouteilles</p>` +
      (a.map(UI.card).join("") ||
        '<div class="card empty">Aucun vin. Ajoute ta première bouteille.</div>');
  },
  detail(id) {
    let w = DB.state.wines.find((w) => w.id === id);
    if (!w) {
      view.innerHTML = "<h1>Vin introuvable</h1>";
      return;
    }
    let e = UI.esc;
    view.innerHTML = `<a href="#cave">← Retour à la cave</a><h1>${e(w.name)}</h1><p>${e(w.domain)} · ${e(w.appellation)}</p><div class="grid"><section class="card">${w.photo ? `<img class="detail-photo" src="${e(w.photo)}" alt="Étiquette">` : '<div class="empty">Aucune photo d’étiquette</div>'}<div class="actions"><button onclick="App.edit('${id}')">Modifier</button><button class="secondary" onclick="App.stock('${id}')">Mouvement de stock</button><button class="secondary" onclick="Tasting.edit('${id}')">Déguster</button></div></section><section class="card"><h2>Le vin en détail</h2><dl>${[
      ["Millésime", w.vintage || "Non millésimé"],
      ["Région", w.region],
      ["Type", w.type],
      ["Cépages", w.grapes],
      ["Volume", w.volume + " cl"],
      ["Stock", w.qty + " bouteilles"],
      ["Emplacement", UI.location(w)],
      ["Fenêtre de dégustation", (w.start || "…") + " – " + (w.end || "…")],
      ["Maturité", UI.status(w)],
      ["Prix d’achat unitaire", UI.money(w.price)],
      ["Valeur saisie unitaire", UI.money(w.value)],
      ["Entrée", w.entry],
    ]
      .map(([k, v]) => `<dt>${k}</dt><dd>${e(v)}</dd>`)
      .join(
        "",
      )}</dl><h3>Notes personnelles</h3><p style="white-space:pre-wrap">${e(w.notes) || "Aucune note."}</p><button class="secondary" onclick="App.remove('${id}')">Supprimer cette référence</button></section></div><h2>Dégustations</h2>${Tasting.cards(DB.state.tastings.filter((t) => t.wineId === id))}<h2>Mouvements de stock</h2>${
      DB.state.movements
        .filter((m) => m.wineId === id)
        .map(
          (m) =>
            `<div class="card">${new Date(m.date).toLocaleDateString("fr-FR")} · ${m.delta > 0 ? "+" : ""}${m.delta} · ${e(m.reason)}</div>`,
        )
        .join("") || "<p>Aucun mouvement.</p>"
    }`;
  },
};
