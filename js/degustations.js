window.Tasting = {
  cards(a) {
    return (
      a
        .map(
          (t) =>
            `<article class="card"><span class="overline">${UI.esc(t.date)}</span><h3>${UI.esc(t.wineName)}</h3><span style="color:var(--gold)">${"★".repeat(t.rating)}${"☆".repeat(5 - t.rating)}</span><p style="white-space:pre-wrap">${UI.esc(t.notes)}</p><span class="pill">${UI.esc(t.pairing) || "Accord non renseigné"}</span><div class="actions"><button class="secondary" onclick="Tasting.remove('${t.id}')">Supprimer la note</button></div></article>`,
        )
        .join("") ||
      '<div class="card empty">Tes souvenirs de dégustation apparaîtront ici.</div>'
    );
  },
  list() {
    view.innerHTML = `<span class="overline">LE CARNET</span><h1>Dégustations</h1><div class="actions"><button onclick="Tasting.edit()">＋ Nouvelle dégustation</button></div><p>Les vins passent, les souvenirs restent.</p>${this.cards([...DB.state.tastings].sort((a, b) => b.date.localeCompare(a.date)))}`;
  },
  edit(id) {
    if (!DB.state.wines.length) {
      UI.toast("Ajoute d’abord un vin");
      return;
    }
    UI.modal(
      `<h2>Nouvelle dégustation</h2><form id="tastingForm"><label>Vin<select name="wineId">${DB.state.wines.map((w) => `<option value="${w.id}" ${w.id === id ? "selected" : ""}>${UI.esc(w.name)} · ${w.vintage || "NM"} (${w.qty} bt.)</option>`).join("")}</select></label>${UI.field("date", "Date", UI.date(), "date", "required")}<label>Note<select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option>${n}</option>`).join("")}</select></label>${UI.field("pairing", "Accord mets-vins")}<label>Commentaires<textarea name="notes"></textarea></label><label><input style="width:auto" type="checkbox" name="consume" checked> Retirer une bouteille du stock</label><button>Enregistrer</button></form>`,
    );
    document.getElementById("tastingForm").onsubmit = async (e) => {
      e.preventDefault();
      let f = new FormData(e.target),
        button = e.submitter;
      button.disabled = true;
      try {
        await DB.mutate((s) => {
          let w = s.wines.find((w) => w.id === f.get("wineId"));
          if (f.get("consume")) {
            if (w.qty < 1)
              throw Error("Stock insuffisant : décoche le retrait.");
            w.qty--;
            Moves.record(s, w, -1, "Dégustation");
          }
          s.tastings.unshift({
            id: UI.id(),
            wineId: w.id,
            wineName: w.name,
            date: f.get("date"),
            rating: +f.get("rating"),
            pairing: f.get("pairing"),
            notes: f.get("notes"),
          });
        });
        modal.close();
        App.render();
        UI.toast("Dégustation enregistrée");
      } catch (e) {
        UI.toast(e.message);
      } finally {
        button.disabled = false;
      }
    };
  },
  async remove(id) {
    if (confirm("Supprimer cette note ? Le stock ne sera pas modifié.")) {
      try {
        await DB.mutate(
          (s) => (s.tastings = s.tastings.filter((t) => t.id !== id)),
        );
        App.render();
      } catch (e) {
        UI.toast(e.message);
      }
    }
  },
};
