window.Moves = {
  record(s, w, delta, reason) {
    s.movements.unshift({
      id: UI.id(),
      wineId: w.id,
      date: new Date().toISOString(),
      delta,
      reason,
    });
  },
  async change(id, delta, reason) {
    await DB.mutate((s) => {
      let w = s.wines.find((w) => w.id === id);
      if (!w || w.qty + delta < 0) throw Error("Stock insuffisant");
      Wine.capacity({ ...w, qty: w.qty + delta }, s);
      w.qty += delta;
      this.record(s, w, delta, reason);
    });
    App.render();
  },
};
