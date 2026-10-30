// Hero background: a layered neural network with data packets flowing through it.
// Hover activates nearby neurons and draws traffic toward the cursor.
// Click sends a faint pruning wave out from the cursor: the weakest connections it
// reaches brighten to a pale blue, snap in the middle and retract. Packets speed up as the model gets sparser.
// Clicking at max sparsity regrows the full network the same way.

(function () {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const hero = canvas.closest(".hero");
  const ctx = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PRUNE_STEPS = [0, 0.45, 0.7, 0.85]; // fraction of connections removed at each click
  const MOUSE_R = 150;
  const MAX_PACKETS = 90;
  const WAVE_SPEED = 0.75; // px per ms
  const CUT_MS = 1000;     // how long a cut connection stays visible
  const GROW_MS = 650;     // how long a restored connection takes to regrow

  let W = 0, H = 0;
  let nodes = [], layers = [], edges = [], packets = [], waves = [];
  let pruneLevel = 0;
  let speedMul = 1, speedTarget = 1;
  let running = false, visible = true, last = 0;
  const mouse = { x: -1e4, y: -1e4, inside: false };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function build() {
    const rect = hero.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const small = W < 760;
    const nLayers = small ? 5 : 8;
    const perLayer = H < 420 ? 5 : 7;
    const x0 = W * (small ? 0.08 : 0.05);
    const x1 = W * (small ? 0.92 : 0.95);

    nodes = []; layers = []; edges = []; packets = []; waves = [];
    for (let l = 0; l < nLayers; l++) {
      const edge = l === 0 || l === nLayers - 1;
      const count = edge ? perLayer - 2 : perLayer + (l % 2);
      const layer = [];
      for (let i = 0; i < count; i++) {
        const bx = x0 + ((x1 - x0) * l) / (nLayers - 1) + rand(-14, 14);
        const by = (H * (i + 1)) / (count + 1) + rand(-12, 12);
        const n = { layer: l, bx, by, x: bx, y: by, phase: rand(0, Math.PI * 2), act: 0, out: [], in: [] };
        layer.push(n);
        nodes.push(n);
      }
      layers.push(layer);
    }
    for (let l = 0; l < nLayers - 1; l++) {
      for (const a of layers[l]) {
        for (const b of layers[l + 1]) {
          const e = { a, b, w: Math.random() ** 1.6, alive: true, next: true, switchAt: null, changedAt: -Infinity, heat: 0 };
          edges.push(e);
          a.out.push(e);
          b.in.push(e);
        }
      }
    }
    applyPrune(null);
  }

  // Remove the lowest-weight fraction of edges, but keep each node's strongest
  // outgoing edge so packets never dead-end. With an origin, changes roll out
  // as a wave from that point; without one they apply immediately.
  function applyPrune(origin, now) {
    const frac = PRUNE_STEPS[pruneLevel];
    const sorted = [...edges].sort((p, q) => p.w - q.w);
    const cut = Math.floor(sorted.length * frac);
    sorted.forEach((e, i) => (e.next = i >= cut));
    for (const n of nodes) {
      if (n.out.length && !n.out.some((e) => e.next)) {
        n.out.reduce((best, e) => (e.w > best.w ? e : best)).next = true;
      }
    }
    for (const e of edges) {
      if (e.next === e.alive) { e.switchAt = null; continue; }
      if (!origin) { e.alive = e.next; e.changedAt = -Infinity; continue; }
      const mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
      e.switchAt = now + Math.hypot(mx - origin.x, my - origin.y) / WAVE_SPEED;
    }
    if (origin) waves.push({ x: origin.x, y: origin.y, start: now, restore: frac === 0 });
    speedTarget = 1 + frac * 2.2;
  }

  function pickEdge(node) {
    const alive = node.out.filter((e) => e.alive);
    if (!alive.length) return null;
    let r = Math.random() * alive.reduce((s, e) => s + e.w + 0.05, 0);
    for (const e of alive) if ((r -= e.w + 0.05) <= 0) return e;
    return alive[alive.length - 1];
  }

  function spawn(fromNode) {
    if (packets.length >= MAX_PACKETS) return;
    const e = pickEdge(fromNode);
    if (e) packets.push({ e, t: 0, v: rand(0.5, 0.9) });
  }

  function nearestNode(x, y) {
    let best = null, bd = Infinity;
    for (const n of nodes) {
      if (!n.out.length) continue;
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return bd < MOUSE_R * MOUSE_R ? best : null;
  }

  function step(dt, time) {
    speedMul += (speedTarget - speedMul) * Math.min(1, dt * 3);

    // Nodes: idle drift, attraction + activation near the cursor.
    for (const n of nodes) {
      const dx = mouse.x - n.bx, dy = mouse.y - n.by;
      const d = Math.hypot(dx, dy);
      const pull = mouse.inside && d < MOUSE_R ? 1 - d / MOUSE_R : 0;
      const tx = n.bx + Math.sin(time * 0.0007 + n.phase) * 4 + dx * pull * 0.12;
      const ty = n.by + Math.cos(time * 0.0009 + n.phase) * 4 + dy * pull * 0.12;
      n.x += (tx - n.x) * Math.min(1, dt * 6);
      n.y += (ty - n.y) * Math.min(1, dt * 6);
      n.act = Math.max(n.act - dt * 1.6, pull * 0.8);
    }

    // Apply pruning/regrowth when the wave reaches each connection.
    for (const e of edges) {
      e.heat = Math.max(0, e.heat - dt * 1.5);
      if (e.switchAt === null || time < e.switchAt) continue;
      e.alive = e.next;
      e.switchAt = null;
      e.changedAt = time;
    }
    waves = waves.filter((w) => (time - w.start) * WAVE_SPEED < Math.hypot(W, H));

    // Spawn: steady input stream, plus extra traffic from the node under the cursor.
    const rate = 5 * speedMul;
    if (Math.random() < rate * dt) spawn(layers[0][(Math.random() * layers[0].length) | 0]);
    if (mouse.inside) {
      const n = nearestNode(mouse.x, mouse.y);
      if (n && Math.random() < 6 * dt) spawn(n);
    }

    // Move packets; on arrival, light up the node and route onward.
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      p.t += dt * p.v * speedMul;
      p.e.heat = Math.min(1, p.e.heat + dt * 2);
      if (p.t >= 1) {
        const n = p.e.b;
        n.act = Math.min(1, n.act + 0.5);
        const next = pickEdge(n);
        if (next) { p.e = next; p.t -= 1; }
        else packets.splice(i, 1);
      } else if (!p.e.alive) {
        packets.splice(i, 1);
      }
    }
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function draw(time = performance.now()) {
    ctx.clearRect(0, 0, W, H);

    // Wave fronts.
    for (const w of waves) {
      const r = (time - w.start) * WAVE_SPEED;
      const a = clamp(1 - r / (Math.hypot(W, H) * 0.8), 0, 1);
      ctx.lineWidth = 1;
      ctx.strokeStyle = w.restore ? `rgba(142,234,255,${a * 0.15})` : `rgba(190,220,255,${a * 0.15})`;
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const e of edges) {
      const since = time - e.changedAt;
      const { a, b } = e;

      if (!e.alive) {
        // Cut: the line snaps at the middle and both halves retract while fading.
        if (since > CUT_MS) continue;
        const fade = 1 - since / CUT_MS;
        const retract = clamp(since / (CUT_MS * 0.7), 0, 1);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const k = 1 - retract;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(200,225,255,${0.5 * fade})`;
        line(a.x, a.y, a.x + (mx - a.x) * k, a.y + (my - a.y) * k);
        line(b.x, b.y, b.x + (mx - b.x) * k, b.y + (my - b.y) * k);
        continue;
      }

      if (since < GROW_MS) {
        // Regrow: the connection extends from its source with a bright tip.
        const g = since / GROW_MS;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(142,234,255,${0.5 - g * 0.3})`;
        line(a.x, a.y, a.x + (b.x - a.x) * g, a.y + (b.y - a.y) * g);
        continue;
      }

      const pending = e.switchAt !== null; // about to be cut: tint it as the wave approaches
      const al = 0.05 + e.w * 0.22 + e.heat * 0.35;
      ctx.lineWidth = 1;
      ctx.strokeStyle = pending ? `rgba(185,215,250,${al + 0.05})` : `rgba(120,175,235,${al})`;
      line(a.x, a.y, b.x, b.y);
    }

    for (const n of nodes) {
      // Nodes left with no live connections are dimmed out.
      const live = n.out.some((e) => e.alive) || n.in.some((e) => e.alive);
      if (n.act > 0.05) {
        ctx.fillStyle = `rgba(110,210,255,${n.act * 0.18})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 8 + n.act * 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = live ? `rgba(170,215,255,${0.55 + n.act * 0.45})` : "rgba(170,215,255,0.15)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, live ? 2.6 + n.act * 2.4 : 2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of packets) {
      const { a, b } = p.e;
      const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
      const tt = Math.max(0, p.t - 0.08);
      ctx.strokeStyle = "rgba(111,227,255,0.35)";
      ctx.lineWidth = 2;
      line(a.x + (b.x - a.x) * tt, a.y + (b.y - a.y) * tt, x, y);
      ctx.fillStyle = "#8eeaff";
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(time) {
    if (!running) return;
    const dt = Math.min(0.05, (time - (last || time)) / 1000);
    last = time;
    step(dt, time);
    draw(time);
    requestAnimationFrame(frame);
  }

  function setRunning(on) {
    if (reduceMotion) return;
    if (on && !running) { running = true; last = 0; requestAnimationFrame(frame); }
    if (!on) running = false;
  }

  // ---------- Events ----------
  hero.addEventListener("pointermove", (ev) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ev.clientX - r.left;
    mouse.y = ev.clientY - r.top;
    mouse.inside = true;
  });
  hero.addEventListener("pointerleave", () => { mouse.inside = false; mouse.x = mouse.y = -1e4; });
  hero.addEventListener("click", (ev) => {
    if (ev.target.closest("a, button")) return;
    const r = canvas.getBoundingClientRect();
    pruneLevel = (pruneLevel + 1) % PRUNE_STEPS.length;
    if (reduceMotion) { applyPrune(null); draw(); return; }
    applyPrune({ x: ev.clientX - r.left, y: ev.clientY - r.top }, performance.now());
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); draw(); }, 150);
  });

  // Pause when the hero is off-screen or the tab is hidden.
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    setRunning(visible && !document.hidden);
  }).observe(hero);
  document.addEventListener("visibilitychange", () => setRunning(visible && !document.hidden));

  build();
  draw();
  setRunning(true);
})();
