window.UI = {
  esc: (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  money: (n) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(n),
  year: () => new Date().getFullYear(),
  id: () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2),
  date: () => new Date().toLocaleDateString("sv-SE"),
  toast(s) {
    let t = document.getElementById("toast");
    t.textContent = s;
    t.style.display = "block";
    setTimeout(() => (t.style.display = "none"), 7000);
  },
  photo(w) {
    return w.photo
      ? `<img class="label" src="${UI.esc(w.photo)}" alt="Étiquette de ${UI.esc(w.name)}">`
      : '<div class="label" aria-hidden="true">♧</div>';
  },
  status(w) {
    let y = this.year();
    return w.end && y > w.end
      ? "Fenêtre dépassée"
      : w.start && y < w.start
        ? "À conserver"
        : w.start || w.end
          ? "À déguster"
          : "Maturité non renseignée";
  },
  location(w) {
    let l = DB.state.locations.find((l) => l.id === w.location);
    return l ? `${l.name} · ${w.row}-${w.col}` : "Non placé";
  },
  card(w) {
    return `<article class="card wine" tabindex="0" role="link" onclick="location.hash='bouteille/${w.id}'" onkeydown="if(event.key==='Enter')this.click()">${UI.photo(w)}<div><h3>${UI.esc(w.name)}</h3><p>${UI.esc(w.region)} · ${w.vintage || "Sans millésime"}</p><span class="muted">${UI.esc(UI.location(w))}</span></div><div class="right"><b>${w.qty} bt.</b><br><span class="pill">${UI.status(w)}</span></div></article>`;
  },
  field(name, title, value = "", type = "text", extra = "") {
    return `<label>${title}<input name="${name}" type="${type}" value="${UI.esc(value)}" ${extra}></label>`;
  },
  modal(html) {
    document.getElementById("dialogContent").innerHTML = html;
    document.getElementById("modal").showModal();
  },
  async image(file) {
    if (!file) return "";
    if (file.size > 25e6)
      throw Error("Photo trop volumineuse : 25 Mo maximum.");
    if (file.type && !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type))
      throw Error("Choisis une photo JPEG, PNG, WebP ou HEIC compatible.");
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(
            Error(
              "Photo illisible. Reprends-la avec le bouton photo ou choisis un JPEG.",
            ),
          );
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      let size = 1200,
        quality = 0.78;
      for (let attempt = 0; attempt < 6; attempt++) {
        const ratio = Math.min(1, size / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL("image/jpeg", quality);
        if (
          result.startsWith("data:image/jpeg;base64,") &&
          result.length <= 460000
        )
          return result;
        size = Math.round(size * 0.8);
        quality = Math.max(0.48, quality - 0.07);
      }
      throw Error("Impossible de réduire cette photo. Essaie une autre image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  },
};
