// Interactive animations for research cards, used when a project has `anim` and no image.
// Each runs idle on its own and reacts to the mouse (or touch) inside its canvas.
// Animations pause while off-screen; with reduced motion they draw a single still frame.

(function () {
  const canvases = document.querySelectorAll("canvas[data-anim]");
  if (!canvases.length) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BG = "#0b1f36";
  const blue = (a) => `rgba(120,175,235,${a})`;
  const cyan = (a) => `rgba(142,234,255,${a})`;
  const warn = (a) => `rgba(255,122,90,${a})`;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (dt, k) => Math.min(1, dt * k);

  // ---------- MTP: tokens appear one at a time; hovering decodes several per step ----------
  function mtp(W, H) {
    // Idle decoding is deliberately slow so the jump to multi-token on hover stands out.
    const pad = 18, lineH = 22, boxH = 12, singleInterval = 0.9, multiInterval = 0.3;
    let tokens = [], shown = 0, timer = 0, hold = 0;

    function layout() {
      tokens = [];
      let x = pad, y = pad;
      while (y + boxH < H - pad) {
        const w = rand(14, 44);
        if (x + w > W - pad) { x = pad; y += lineH; continue; }
        tokens.push({ x, y, w, born: 0, multi: false });
        x += w + 6;
      }
      shown = 0;
      hold = 0;
    }
    layout();

    return {
      step(dt, t, m) {
        if (shown >= tokens.length) {
          if ((hold += dt) > 1.4) layout();
          return;
        }
        if ((timer += dt) < (m.inside ? multiInterval : singleInterval)) return;
        timer = 0;
        const k = m.inside ? 4 : 1;
        for (let i = 0; i < k && shown < tokens.length; i++) {
          const tok = tokens[shown++];
          tok.born = t;
          tok.multi = k > 1;
        }
      },
      draw(ctx, t) {
        const fade = shown >= tokens.length ? clamp(1 - (hold - 0.8) / 0.6, 0, 1) : 1;
        tokens.forEach((tok, i) => {
          if (i >= shown) {
            ctx.fillStyle = blue(0.07);
            ctx.fillRect(tok.x, tok.y, tok.w, boxH);
            return;
          }
          const age = t - tok.born;
          const pop = clamp(age / 0.18, 0, 1);
          const glow = clamp(1 - age / 0.7, 0, 1);
          const h = boxH * (0.5 + 0.5 * pop);
          ctx.fillStyle = tok.multi ? cyan((0.35 + 0.6 * glow) * fade) : blue((0.4 + 0.5 * glow) * fade);
          ctx.fillRect(tok.x, tok.y + (boxH - h) / 2, tok.w, h);
          if (tok.multi && glow > 0) {
            ctx.fillStyle = cyan(glow);
            ctx.fillRect(tok.x, tok.y + boxH + 3, tok.w, 2);
          }
        });
        if (shown < tokens.length && Math.sin(t * 9) > 0) {
          const next = tokens[shown];
          ctx.fillStyle = cyan(0.9);
          ctx.fillRect(next.x, next.y - 2, 2, boxH + 4);
        }
      },
    };
  }

  // ---------- Memory & GPU: fragmented blocks defragment on hover, freeing room for a big tensor ----------
  function memory(W, H) {
    const cols = 16, rows = 8, gap = 3, pad = 12, barH = 4;
    const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
    const ch = (H - pad * 2 - barH - 10 - gap * (rows - 1)) / rows;
    const total = cols * rows;
    const shades = ["#2f5f95", "#3a78b5", "#4b6fa8", "#5a8fd0", "#6aa3e0"];
    const pos = (i) => ({ x: pad + (i % cols) * (cw + gap), y: pad + Math.floor(i / cols) * (ch + gap) });

    const tensors = [];
    let used = 0;
    while (used < total * 0.5) {
      const n = Math.floor(rand(3, 9));
      tensors.push({ n, color: shades[tensors.length % shades.length], cells: [] });
      used += n;
    }
    for (const tn of tensors) for (let k = 0; k < tn.n; k++) tn.cells.push({ x: 0, y: 0 });

    let packed = false, shuffleTimer = 0, big = 0, util = 0.45;

    function setTargets() {
      let idx = 0;
      const free = total - used;
      const weights = tensors.map(() => Math.random() + 0.2);
      const sum = weights.reduce((s, v) => s + v, 0);
      for (let ti = 0; ti < tensors.length; ti++) {
        if (!packed) idx += Math.floor((weights[ti] / sum) * free * 0.95);
        for (const c of tensors[ti].cells) {
          const p = pos(idx++);
          c.tx = p.x;
          c.ty = p.y;
        }
      }
    }
    setTargets();
    for (const tn of tensors) for (const c of tn.cells) { c.x = c.tx; c.y = c.ty; }

    return {
      step(dt, t, m) {
        if (m.inside !== packed) { packed = m.inside; setTargets(); }
        if (!packed && (shuffleTimer += dt) > 2.8) { shuffleTimer = 0; setTargets(); }
        for (const tn of tensors) {
          tn.hover = false;
          for (const c of tn.cells) {
            c.x += (c.tx - c.x) * ease(dt, 6);
            c.y += (c.ty - c.y) * ease(dt, 6);
            if (m.inside && m.x >= c.x && m.x <= c.x + cw && m.y >= c.y && m.y <= c.y + ch) tn.hover = true;
          }
        }
        const settled = tensors.every((tn) => tn.cells.every((c) => Math.abs(c.tx - c.x) < 1 && Math.abs(c.ty - c.y) < 1));
        big += ((packed && settled ? 1 : 0) - big) * ease(dt, packed ? 3 : 8);
        util += ((packed ? 0.95 : 0.45) - util) * ease(dt, 2);
      },
      draw(ctx, t) {
        for (let i = 0; i < total; i++) {
          const p = pos(i);
          ctx.strokeStyle = blue(0.12);
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x + 0.5, p.y + 0.5, cw - 1, ch - 1);
        }
        // Big tensor fills the contiguous free tail once memory is compacted.
        const bigCells = Math.floor((total - used) * 0.85 * big);
        for (let i = 0; i < bigCells; i++) {
          const p = pos(used + i);
          ctx.fillStyle = cyan(0.25 + 0.5 * big);
          ctx.fillRect(p.x, p.y, cw, ch);
        }
        for (const tn of tensors) {
          ctx.fillStyle = tn.color;
          ctx.globalAlpha = tn.hover ? 1 : 0.85;
          for (const c of tn.cells) ctx.fillRect(c.x, c.y, cw, ch);
          if (tn.hover) {
            ctx.strokeStyle = cyan(0.9);
            for (const c of tn.cells) ctx.strokeRect(c.x + 0.5, c.y + 0.5, cw - 1, ch - 1);
          }
        }
        ctx.globalAlpha = 1;
        // Utilization bar.
        const y = H - pad - barH;
        ctx.fillStyle = blue(0.15);
        ctx.fillRect(pad, y, W - pad * 2, barH);
        ctx.fillStyle = cyan(0.8);
        ctx.fillRect(pad, y, (W - pad * 2) * (util + Math.sin(t * 6) * 0.02), barH);
      },
    };
  }

  // ---------- Autonomous driving: a rotating LiDAR reveals obstacles; the car steers toward the cursor ----------
  function driving(W, H) {
    const lanes = 3, roadL = W * 0.2, roadR = W * 0.8, laneW = (roadR - roadL) / lanes;
    const speed = 70;
    const ego = { x: roadL + laneW * 1.5, y: H * 0.72, w: laneW * 0.42, h: laneW * 0.7 };
    let sweep = 0, scroll = 0;
    const obstacles = [];
    const side = [];

    function perimeter(w, h) {
      const pts = [];
      for (let x = -w / 2; x <= w / 2; x += 4) pts.push({ dx: x, dy: -h / 2, hit: -9 }, { dx: x, dy: h / 2, hit: -9 });
      for (let y = -h / 2 + 4; y < h / 2; y += 4) pts.push({ dx: -w / 2, dy: y, hit: -9 }, { dx: w / 2, dy: y, hit: -9 });
      return pts;
    }
    function addObstacle(y) {
      const lane = Math.floor(Math.random() * lanes);
      const w = laneW * 0.42, h = laneW * rand(0.65, 0.8);
      obstacles.push({ x: roadL + laneW * (lane + 0.5), y, v: rand(10, 45), pts: perimeter(w, h), h });
    }
    for (let i = 0; i < 3; i++) addObstacle(rand(-H * 0.2, H * 0.5));
    for (let y = 0; y < H; y += 9) {
      side.push({ x: roadL - rand(8, 26), y, hit: -9 }, { x: roadR + rand(8, 26), y, hit: -9 });
    }

    const angleTo = (x, y) => Math.atan2(y - ego.y, x - ego.x);
    const passed = (a, from, to) => {
      const norm = (v) => ((v % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const span = norm(to - from), d = norm(a - from);
      return d <= span;
    };

    function scan(pt, x, y, prev, t, m) {
      if (passed(angleTo(x, y), prev, sweep)) pt.hit = t;
      if (m.inside && Math.hypot(x - m.x, y - m.y) < 45) pt.hit = t;
    }

    return {
      step(dt, t, m) {
        const prev = sweep;
        sweep += dt * 3.2;
        scroll = (scroll + speed * dt) % 40;
        const tx = m.inside ? clamp(m.x, roadL + ego.w, roadR - ego.w) : roadL + laneW * 1.5;
        ego.x += (tx - ego.x) * ease(dt, 2.5);

        for (let i = obstacles.length - 1; i >= 0; i--) {
          const o = obstacles[i];
          o.y += (speed - o.v) * dt;
          if (o.y - o.h > H) obstacles.splice(i, 1);
          else for (const p of o.pts) scan(p, o.x + p.dx, o.y + p.dy, prev, t, m);
        }
        if (obstacles.length < 3) addObstacle(-40);
        for (const p of side) {
          p.y += speed * dt;
          if (p.y > H) p.y -= H;
          scan(p, p.x, p.y, prev, t, m);
        }
      },
      draw(ctx, t, m) {
        ctx.strokeStyle = blue(0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(roadL, 0); ctx.lineTo(roadL, H);
        ctx.moveTo(roadR, 0); ctx.lineTo(roadR, H);
        ctx.stroke();
        ctx.setLineDash([10, 30]);
        ctx.lineDashOffset = -scroll;
        for (let l = 1; l < lanes; l++) {
          ctx.beginPath();
          ctx.moveTo(roadL + laneW * l, 0);
          ctx.lineTo(roadL + laneW * l, H);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Sweep wedge.
        const R = Math.hypot(W, H);
        const grad = ctx.createRadialGradient(ego.x, ego.y, 0, ego.x, ego.y, R * 0.6);
        grad.addColorStop(0, cyan(0.22));
        grad.addColorStop(1, cyan(0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(ego.x, ego.y);
        ctx.arc(ego.x, ego.y, R, sweep - 0.5, sweep);
        ctx.closePath();
        ctx.fill();

        const dot = (x, y, hit, danger) => {
          const a = clamp(1 - (t - hit) / 1.6, 0, 1);
          if (a <= 0) return;
          ctx.fillStyle = danger ? warn(a) : cyan(a);
          ctx.fillRect(x - 1, y - 1, 2.2, 2.2);
        };
        for (const o of obstacles) {
          const danger = Math.abs(o.x - ego.x) < laneW * 0.6 && o.y < ego.y && ego.y - o.y < H * 0.45;
          for (const p of o.pts) dot(o.x + p.dx, o.y + p.dy, p.hit, danger);
        }
        for (const p of side) dot(p.x, p.y, p.hit, false);

        if (m.inside) {
          ctx.strokeStyle = cyan(0.25);
          ctx.beginPath();
          ctx.arc(m.x, m.y, 45, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.strokeStyle = cyan(0.95);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ego.x - ego.w / 2, ego.y - ego.h / 2, ego.w, ego.h);
        ctx.fillStyle = cyan(0.95);
        ctx.beginPath();
        ctx.arc(ego.x, ego.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      },
    };
  }

  // ---------- Drones: a quadcopter surveys the ground, detecting objects under its camera; it follows the cursor ----------
  function drone(W, H) {
    const pad = 22, fov = Math.min(W, H) * 0.34, arm = Math.min(W, H) * 0.085;
    const STRIKE_S = 0.28, LOCK_R = 26;
    const objects = [];
    // (Re)place a target at a random spot; `born` drives its fade-in.
    const place = (o, t) => {
      const s = rand(7, 14);
      Object.assign(o, { x: rand(pad, W - pad), y: rand(pad, H - pad), w: s * rand(1, 1.6), h: s, seen: -9, born: t, alive: true, locked: false });
    };
    for (let i = 0; i < 14; i++) { const o = {}; place(o, -9); objects.push(o); }
    let strikes = [], booms = [];
    const nearestTarget = (x, y) => {
      let best = null, bd = LOCK_R;
      for (const o of objects) {
        if (!o.alive || o.locked) continue;
        const dist = Math.hypot(o.x - x, o.y - y) - Math.max(o.w, o.h) / 2;
        if (dist < bd) { bd = dist; best = o; }
      }
      return best;
    };
    // Idle flight: a lawnmower survey pattern over the field.
    const rows = 3, path = [];
    for (let r = 0; r < rows; r++) {
      const y = pad + fov / 2 + ((H - pad * 2 - fov) * r) / (rows - 1);
      const xs = [pad + fov / 2, W - pad - fov / 2];
      if (r % 2) xs.reverse();
      path.push({ x: xs[0], y }, { x: xs[1], y });
    }
    const d = { x: path[0].x, y: path[0].y, vx: 0, vy: 0, heading: 0 };
    let wp = 1, spin = 0;
    const trail = [];

    return {
      // Click a target: the drone fires a round at it, it explodes, and respawns elsewhere a few seconds later.
      click(x, y, t) {
        const o = nearestTarget(x, y);
        if (!o) return;
        o.locked = true;
        strikes.push({ o, x0: d.x, y0: d.y, t0: t });
      },
      step(dt, t, m) {
        for (const s of strikes) {
          if (t - s.t0 < STRIKE_S) continue;
          s.done = true;
          s.o.alive = false;
          s.o.respawnAt = t + rand(3, 5);
          const parts = [];
          for (let i = 0; i < 22; i++) {
            const a = rand(0, Math.PI * 2), v = rand(40, 160);
            parts.push({ x: s.o.x, y: s.o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rand(1, 2.6) });
          }
          booms.push({ x: s.o.x, y: s.o.y, t0: t, parts });
        }
        strikes = strikes.filter((s) => !s.done);
        for (const b of booms) for (const p of b.parts) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt;
        }
        booms = booms.filter((b) => t - b.t0 < 3);
        for (const o of objects) if (!o.alive && t >= o.respawnAt) place(o, t);

        let tx, ty;
        if (m.inside) { tx = m.x; ty = m.y; }
        else {
          tx = path[wp].x; ty = path[wp].y;
          if (Math.hypot(tx - d.x, ty - d.y) < 8) wp = (wp + 1) % path.length;
        }
        // Simple spring-damper so the drone accelerates, overshoots slightly and settles.
        const k = m.inside ? 14 : 5, damp = m.inside ? 6 : 3.2, vmax = m.inside ? 260 : 70;
        d.vx += ((tx - d.x) * k - d.vx * damp) * dt;
        d.vy += ((ty - d.y) * k - d.vy * damp) * dt;
        const v = Math.hypot(d.vx, d.vy);
        if (v > vmax) { d.vx *= vmax / v; d.vy *= vmax / v; }
        d.x = clamp(d.x + d.vx * dt, 0, W);
        d.y = clamp(d.y + d.vy * dt, 0, H);
        if (v > 8) {
          const target = Math.atan2(d.vy, d.vx);
          let diff = target - d.heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          d.heading += diff * ease(dt, 4);
        }
        spin += dt * 40;
        trail.push([d.x, d.y]);
        if (trail.length > 90) trail.shift();
        for (const o of objects) {
          if (Math.abs(o.x - d.x) < fov / 2 && Math.abs(o.y - d.y) < fov / 2) o.seen = t;
        }
      },
      draw(ctx, t, m) {
        // Ground grid.
        ctx.strokeStyle = blue(0.07);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < W; x += 24) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
        for (let y = 0; y < H; y += 24) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
        ctx.stroke();

        // Scorch marks left by explosions.
        for (const b of booms) {
          ctx.fillStyle = `rgba(4,10,20,${0.5 * clamp(1 - (t - b.t0) / 3, 0, 1)})`;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
          ctx.fill();
        }

        // Targets on the ground, with a detection box while (and shortly after) in view.
        // The one under the cursor (or already struck) is marked in orange.
        const hovered = m.inside ? nearestTarget(m.x, m.y) : null;
        for (const o of objects) {
          if (!o.alive) continue;
          const fadeIn = clamp((t - o.born) / 0.6, 0, 1);
          ctx.fillStyle = blue(0.35 * fadeIn);
          ctx.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
          const marked = o.locked || o === hovered;
          const a = marked ? 1 : clamp(1 - (t - o.seen) / 1.5, 0, 1) * fadeIn;
          if (a <= 0) continue;
          const x0 = o.x - o.w / 2 - 4, y0 = o.y - o.h / 2 - 4, x1 = o.x + o.w / 2 + 4, y1 = o.y + o.h / 2 + 4, c = 5;
          ctx.strokeStyle = marked ? warn(a) : cyan(a);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x0, y0 + c); ctx.lineTo(x0, y0); ctx.lineTo(x0 + c, y0);
          ctx.moveTo(x1 - c, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + c);
          ctx.moveTo(x1, y1 - c); ctx.lineTo(x1, y1); ctx.lineTo(x1 - c, y1);
          ctx.moveTo(x0 + c, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - c);
          ctx.stroke();
        }

        // Rounds in flight from the drone to their target.
        for (const s of strikes) {
          const k = clamp((t - s.t0) / STRIKE_S, 0, 1);
          const x = s.x0 + (s.o.x - s.x0) * k, y = s.y0 + (s.o.y - s.y0) * k;
          const kt = Math.max(0, k - 0.25);
          ctx.strokeStyle = warn(0.7);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x0 + (s.o.x - s.x0) * kt, s.y0 + (s.o.y - s.y0) * kt);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,240,200,1)";
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }

        // Flight trail.
        ctx.strokeStyle = cyan(0.25);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.setLineDash([]);

        // Camera footprint.
        ctx.fillStyle = cyan(0.06);
        ctx.fillRect(d.x - fov / 2, d.y - fov / 2, fov, fov);
        ctx.strokeStyle = cyan(0.3);
        ctx.strokeRect(d.x - fov / 2, d.y - fov / 2, fov, fov);

        // Quadcopter: X frame, four spinning rotors, heading marker.
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.heading);
        ctx.strokeStyle = cyan(0.95);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const s of [Math.PI / 4, -Math.PI / 4]) {
          ctx.moveTo(-Math.cos(s) * arm, -Math.sin(s) * arm);
          ctx.lineTo(Math.cos(s) * arm, Math.sin(s) * arm);
        }
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i * Math.PI) / 2;
          const rx = Math.cos(a) * arm, ry = Math.sin(a) * arm, rr = arm * 0.55;
          ctx.strokeStyle = cyan(0.3);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(rx, ry, rr, 0, Math.PI * 2);
          ctx.stroke();
          const sp = spin * (i % 2 ? 1 : -1);
          ctx.strokeStyle = cyan(0.8);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(rx + Math.cos(sp) * rr, ry + Math.sin(sp) * rr);
          ctx.lineTo(rx - Math.cos(sp) * rr, ry - Math.sin(sp) * rr);
          ctx.stroke();
        }
        ctx.fillStyle = cyan(0.95);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.fillStyle = warn(0.9);
        ctx.beginPath();
        ctx.arc(arm * 0.35, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Explosions on top of everything (the drone often hovers right over its target):
        // a bright flash, an expanding shockwave ring and flying debris.
        for (const b of booms) {
          const age = t - b.t0;
          const flash = clamp(1 - age / 0.35, 0, 1);
          if (flash > 0) {
            const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 10 + age * 60);
            g.addColorStop(0, `rgba(255,240,200,${flash})`);
            g.addColorStop(0.4, warn(0.8 * flash));
            g.addColorStop(1, warn(0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(b.x, b.y, 10 + age * 60, 0, Math.PI * 2);
            ctx.fill();
          }
          const ring = clamp(1 - age / 0.8, 0, 1);
          if (ring > 0) {
            ctx.strokeStyle = `rgba(255,200,150,${0.7 * ring})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(b.x, b.y, 6 + (1 - ring) * 44, 0, Math.PI * 2);
            ctx.stroke();
          }
          const debris = clamp(1 - age / 1.1, 0, 1);
          if (debris > 0) {
            ctx.fillStyle = warn(debris);
            for (const p of b.parts) ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
          }
        }
      },
    };
  }

  // ---------- Model compression: a weight matrix gets quantized to fewer levels around the cursor ----------
  function compression(W, H) {
    const cols = 18, rows = 11, gap = 2, pad = 12, R = Math.min(W, H) * 0.42;
    const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
    const ch = (H - pad * 2 - gap * (rows - 1)) / rows;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ x: pad + c * (cw + gap), y: pad + r * (ch + gap), seed: rand(0, 6.28), shown: 0.5, bits: 0 });
      }
    }
    const lo = [22, 54, 92], hi = [142, 234, 255];
    const color = (v, a) =>
      `rgba(${lo.map((l, i) => Math.round(l + (hi[i] - l) * v)).join(",")},${a})`;
    const probe = { x: W / 2, y: H / 2 };

    return {
      step(dt, t, m) {
        const tx = m.inside ? m.x : W / 2 + Math.cos(t * 0.6) * W * 0.32;
        const ty = m.inside ? m.y : H / 2 + Math.sin(t * 0.9) * H * 0.3;
        probe.x += (tx - probe.x) * ease(dt, m.inside ? 12 : 3);
        probe.y += (ty - probe.y) * ease(dt, m.inside ? 12 : 3);
        for (const c of cells) {
          const v = 0.5 + 0.5 * Math.sin(c.x * 0.03 + c.seed + t * 0.6) * Math.cos(c.y * 0.05 - t * 0.4);
          const d = Math.hypot(c.x + cw / 2 - probe.x, c.y + ch / 2 - probe.y) / R;
          // Closer to the probe = fewer quantization levels; the very center is pruned to 1 bit.
          const levels = d < 0.35 ? 2 : d < 0.65 ? 4 : d < 1 ? 8 : 0;
          const q = levels ? Math.round(v * (levels - 1)) / (levels - 1) : v;
          c.shown += (q - c.shown) * ease(dt, 10);
          c.bits += ((levels ? 1 - d : 0) - c.bits) * ease(dt, 8);
        }
      },
      draw(ctx) {
        for (const c of cells) {
          const shrink = c.bits * 0.35;
          const w = cw * (1 - shrink), h = ch * (1 - shrink);
          const zero = c.bits > 0.55 && c.shown < 0.5; // pruned to zero in the 1-bit core
          ctx.fillStyle = zero ? blue(0.08) : color(c.shown, 0.9);
          ctx.fillRect(c.x + (cw - w) / 2, c.y + (ch - h) / 2, w, h);
        }
        ctx.strokeStyle = cyan(0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(probe.x, probe.y, R, 0, Math.PI * 2);
        ctx.stroke();
      },
    };
  }

  // ---------- Model optimization: optimizers roll down a loss landscape from where you point ----------
  function optimization(W, H) {
    const f = (x, y) => {
      const nx = x / W, ny = y / H;
      const bowl = (nx - 0.7) ** 2 * 2.2 + (ny - 0.62) ** 2 * 3;
      const well = -0.16 * Math.exp(-((nx - 0.28) ** 2 + (ny - 0.32) ** 2) / 0.012);
      const ripple = 0.04 * Math.sin(nx * 13) * Math.cos(ny * 11);
      return bowl + well + ripple;
    };
    const grad = (x, y) => [(f(x + 1, y) - f(x - 1, y)) / 2, (f(x, y + 1) - f(x, y - 1)) / 2];

    // Pre-render the landscape at reduced resolution: depth shading plus contour
    // lines wherever the band index changes between neighboring pixels.
    const S = 2, bw = Math.ceil(W / S), bh = Math.ceil(H / S);
    const bg = document.createElement("canvas");
    bg.width = bw; bg.height = bh;
    const bctx = bg.getContext("2d");
    const img = bctx.createImageData(bw, bh);
    const vals = new Float32Array(bw * bh);
    let minV = Infinity, min = { x: 0, y: 0 };
    for (let j = 0; j < bh; j++) {
      for (let i = 0; i < bw; i++) {
        const v = (vals[j * bw + i] = f(i * S, j * S));
        if (v < minV) { minV = v; min = { x: i * S, y: j * S }; }
      }
    }
    const bandOf = (v) => Math.floor(v * 14);
    for (let j = 0; j < bh; j++) {
      for (let i = 0; i < bw; i++) {
        const v = vals[j * bw + i];
        const b = bandOf(v);
        const edge =
          (i + 1 < bw && bandOf(vals[j * bw + i + 1]) !== b) || (j + 1 < bh && bandOf(vals[(j + 1) * bw + i]) !== b)
            ? 0.3
            : 0;
        const depth = clamp(1 - v, 0, 1) * 0.22;
        const k = (j * bw + i) * 4;
        img.data[k] = 11 + (120 - 11) * (depth + edge);
        img.data[k + 1] = 31 + (175 - 31) * (depth + edge);
        img.data[k + 2] = 54 + (235 - 54) * (depth + edge);
        img.data[k + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);

    let balls = [], timer = 1.5;
    const launch = (x, y) => {
      balls.push({ x, y, vx: 0, vy: 0, trail: [], done: 0, born: 0 });
      if (balls.length > 6) balls.shift();
    };

    return {
      skipBackground: true,
      step(dt, t, m) {
        timer += dt;
        if (m.inside && timer > 0.55) { timer = 0; launch(m.x + rand(-4, 4), m.y + rand(-4, 4)); }
        if (!m.inside && timer > 2.4) {
          timer = 0;
          const edge = Math.random() < 0.5;
          launch(edge ? rand(0, W * 0.3) : rand(0, W), edge ? rand(0, H) : rand(0, H * 0.25));
        }
        for (const b of balls) {
          if (b.done) { b.done += dt; continue; }
          b.born += dt;
          const [gx, gy] = grad(b.x, b.y);
          b.vx = (b.vx - gx * 52000 * dt) * (1 - 1.6 * dt);
          b.vy = (b.vy - gy * 52000 * dt) * (1 - 1.6 * dt);
          b.x = clamp(b.x + b.vx * dt, 0, W);
          b.y = clamp(b.y + b.vy * dt, 0, H);
          b.trail.push([b.x, b.y]);
          if (b.trail.length > 160) b.trail.shift();
          if (b.born > 1 && Math.hypot(b.vx, b.vy) < 3) b.done = 0.001;
        }
        balls = balls.filter((b) => b.done < 2.5);
      },
      draw(ctx, t) {
        ctx.drawImage(bg, 0, 0, W, H);
        const pulse = 6 + Math.sin(t * 3) * 2;
        ctx.strokeStyle = cyan(0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(min.x, min.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
        for (const b of balls) {
          const a = b.done ? clamp(1 - b.done / 2.5, 0, 1) : 1;
          ctx.strokeStyle = cyan(0.6 * a);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          b.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
          ctx.fillStyle = b.done ? cyan(a) : warn(1);
          ctx.beginPath();
          ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    };
  }

  // ---------- LLM acceleration: causal attention fills row by row; hovering switches to sparse attention ----------
  function llm(W, H) {
    const n = 16, size = Math.min(H - 24, W - 80), cell = size / n;
    const ox = (W - size) / 2 + 8, oy = (H - size) / 2;
    let cells, row, timer, hold;
    const sparseKeep = (i, j) => i - j <= 2 || j < 2 || j % 5 === 0; // local window + sink tokens + strided

    function reset() {
      cells = [];
      for (let i = 0; i < n; i++) {
        const r = [];
        for (let j = 0; j <= i; j++) r.push({ w: Math.random() ** 2, shown: 0, done: false, skipped: false });
        cells.push(r);
      }
      row = 0; timer = 0; hold = 0;
    }
    reset();

    return {
      step(dt, t, m) {
        if (row >= n) {
          if ((hold += dt) > 1.4) reset();
        } else if ((timer += dt) > (m.inside ? 0.12 : 0.4)) {
          // Decode the next token: compute its attention row (fully, or sparsely while hovered).
          timer = 0;
          cells[row].forEach((c, j) => {
            c.done = true;
            c.skipped = m.inside && !sparseKeep(row, j);
          });
          row++;
        }
        for (const r of cells) for (const c of r) if (c.done && !c.skipped) c.shown += (1 - c.shown) * ease(dt, 8);
      },
      draw(ctx) {
        const fade = row >= n ? clamp(1 - (hold - 0.8) / 0.6, 0, 1) : 1;
        for (let i = 0; i < n; i++) {
          // Query tokens down the left side.
          ctx.fillStyle = i < row ? cyan(0.8 * fade) : blue(0.15);
          ctx.fillRect(ox - 14, oy + i * cell + 2, 8, cell - 4);
          for (let j = 0; j <= i; j++) {
            const c = cells[i][j], x = ox + j * cell, y = oy + i * cell;
            if (!c.done) {
              ctx.fillStyle = blue(0.06);
              ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
            } else if (c.skipped) {
              ctx.strokeStyle = blue(0.2 * fade);
              ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
            } else {
              ctx.fillStyle = cyan((0.15 + 0.85 * c.w) * c.shown * fade);
              ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
            }
          }
        }
        if (row < n) {
          ctx.strokeStyle = cyan(0.9);
          ctx.lineWidth = 1;
          ctx.strokeRect(ox + 0.5, oy + row * cell + 0.5, (row + 1) * cell - 1, cell - 1);
        }
      },
    };
  }

  // ---------- GPU architecture: SMs run warps in lockstep; hovering dispatches kernels from the cursor ----------
  function gpu(W, H) {
    const cols = 6, rows = 3, pad = 12, gap = 8, top = 30;
    const smW = (W - pad * 2 - gap * (cols - 1)) / cols, smH = (H - top - pad - gap * (rows - 1)) / rows;
    const lx = 4, ly = 6; // lanes per SM: ly warps of lx threads
    const sms = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        sms.push({ x: pad + c * (smW + gap), y: top + r * (smH + gap), act: 0, phase: rand(0, 6.28) });
      }
    }
    let ripples = [], timer = 0, clock = 0, flow = 0;
    const maxR = Math.hypot(W, H);

    return {
      step(dt, t, m) {
        clock += dt;
        timer += dt;
        if (m.inside && timer > 0.35) { timer = 0; ripples.push({ x: m.x, y: m.y, t0: clock }); }
        if (!m.inside && timer > 1.6) {
          timer = 0;
          const s = sms[(Math.random() * sms.length) | 0];
          ripples.push({ x: s.x + smW / 2, y: s.y + smH / 2, t0: clock });
        }
        ripples = ripples.filter((r) => (clock - r.t0) * 240 < maxR);
        let total = 0;
        for (const s of sms) {
          s.act = Math.max(0, s.act - dt * 0.9);
          for (const r of ripples) {
            const rad = (clock - r.t0) * 240;
            const d = Math.hypot(s.x + smW / 2 - r.x, s.y + smH / 2 - r.y);
            if (Math.abs(d - rad) < 22) s.act = Math.max(s.act, 1 - rad / maxR);
          }
          total += s.act;
        }
        flow += dt * (20 + 160 * (total / sms.length));
      },
      draw(ctx) {
        // Global memory (HBM) bus along the top; traffic speeds up with load.
        ctx.fillStyle = blue(0.15);
        ctx.fillRect(pad, 8, W - pad * 2, 10);
        ctx.strokeStyle = cyan(0.7);
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 10]);
        ctx.lineDashOffset = -flow;
        ctx.beginPath();
        ctx.moveTo(pad + 2, 13);
        ctx.lineTo(W - pad - 2, 13);
        ctx.stroke();
        ctx.setLineDash([]);

        for (const s of sms) {
          ctx.strokeStyle = s.act > 0.05 ? cyan(0.25 + 0.5 * s.act) : blue(0.3);
          ctx.lineWidth = 1;
          ctx.strokeRect(s.x + 0.5, s.y + 0.5, smW - 1, smH - 1);
          const cw = (smW - 8) / lx, ch = (smH - 8) / ly;
          for (let wy = 0; wy < ly; wy++) {
            // All lanes of a warp share one phase: they execute in lockstep.
            const on = s.act * (0.5 + 0.5 * Math.sin(flow * 0.12 - wy * 0.9 + s.phase));
            ctx.fillStyle = on > 0.03 ? cyan(0.15 + 0.8 * on) : blue(0.12);
            for (let wx = 0; wx < lx; wx++) ctx.fillRect(s.x + 4 + wx * cw + 1, s.y + 4 + wy * ch + 1, cw - 2, ch - 2);
          }
        }
      },
    };
  }

  // ---------- Real-time systems: a scheduler timeline; hovering a core injects urgent jobs that preempt ----------
  function realtime(W, H) {
    const rows = 4, padY = 14, rowH = (H - padY * 2) / rows, pxs = 70, nowX = W * 0.3;
    const lanes = [];
    for (let r = 0; r < rows; r++) {
      const period = rand(0.9, 1.5);
      lanes.push({ period, exec: period * rand(0.3, 0.55), release: rand(-nowX / pxs, 0), busy: -Infinity, jobs: [] });
    }
    let clock = 0, inject = 0;
    const X = (time) => nowX + (time - clock) * pxs;

    return {
      step(dt, t, m) {
        clock += dt;
        const horizon = clock + (W - nowX) / pxs + 1;
        for (const ln of lanes) {
          while (ln.release < horizon) {
            const s = Math.max(ln.release, ln.busy);
            ln.jobs.push({ s, e: s + ln.exec, d: ln.release + ln.period });
            ln.busy = s + ln.exec;
            ln.release += ln.period;
          }
          ln.jobs = ln.jobs.filter((j) => X(j.e) > -10);
        }
        // Hover: an urgent job preempts the hovered core; later work slides right and may miss deadlines.
        if (m.inside && (inject += dt) > 0.6) {
          inject = 0;
          const ln = lanes[clamp(Math.floor((m.y - padY) / rowH), 0, rows - 1)];
          const U = 0.3, extra = [];
          for (const j of ln.jobs) {
            if (j.urgent) continue;
            if (j.s >= clock) { j.s += U; j.e += U; }
            else if (j.e > clock) { extra.push({ s: clock + U, e: j.e + U, d: j.d }); j.e = clock; }
          }
          ln.jobs.push(...extra, { s: clock, e: clock + U, d: clock + U, urgent: true });
          ln.busy += U;
        }
      },
      draw(ctx) {
        lanes.forEach((ln, r) => {
          const y = padY + r * rowH, h = rowH * 0.5, yb = y + (rowH - h) / 2;
          ctx.strokeStyle = blue(0.15);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, yb + h + 0.5);
          ctx.lineTo(W, yb + h + 0.5);
          ctx.stroke();
          for (const j of ln.jobs) {
            const x0 = X(j.s), x1 = X(j.e);
            if (x1 < 0 || x0 > W) continue;
            const past = j.e < clock;
            const miss = !j.urgent && j.e > j.d + 1e-6;
            ctx.fillStyle = j.urgent ? cyan(past ? 0.4 : 0.9) : blue(past ? 0.3 : 0.65);
            ctx.fillRect(x0, yb, Math.max(1, x1 - x0 - 1), h);
            if (miss) {
              ctx.strokeStyle = warn(past ? 0.4 : 0.9);
              ctx.strokeRect(x0 + 0.5, yb + 0.5, Math.max(1, x1 - x0 - 2), h - 1);
            }
            if (!j.urgent) {
              // Deadline marker.
              const xd = X(j.d);
              ctx.fillStyle = miss ? warn(0.8) : blue(0.5);
              ctx.beginPath();
              ctx.moveTo(xd - 3, yb - 5);
              ctx.lineTo(xd + 3, yb - 5);
              ctx.lineTo(xd, yb - 1);
              ctx.fill();
            }
          }
        });
        ctx.strokeStyle = cyan(0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nowX, 4);
        ctx.lineTo(nowX, H - 4);
        ctx.stroke();
      },
    };
  }

  // ---------- Edge computing: devices offload to a distant cloud; near the cursor they compute locally ----------
  function edge(W, H) {
    const cloud = { x: W / 2, y: 24 }, R = Math.min(W, H) * 0.38;
    const devices = [];
    for (let i = 0; i < 10; i++) {
      devices.push({ x: W * (0.08 + 0.84 * (i + rand(0.2, 0.8)) / 10), y: rand(H * 0.55, H - 16), timer: rand(0, 2), pulse: 0, local: 0 });
    }
    let packets = [];
    const TRIP = 0.9;

    return {
      step(dt, t, m) {
        for (const d of devices) {
          const near = m.inside && Math.hypot(d.x - m.x, d.y - m.y) < R;
          d.local += ((near ? 1 : 0) - d.local) * ease(dt, 6);
          d.pulse = Math.max(0, d.pulse - dt * 2.5);
          if ((d.timer -= dt) > 0) continue;
          if (near) { d.timer = rand(0.35, 0.6); d.pulse = 1; } // on-device inference: fast, no network trip
          else { d.timer = rand(1.6, 2.6); packets.push({ d, k: 0, up: true }); }
        }
        for (const p of packets) {
          p.k += dt / TRIP;
          if (p.k >= 1 && p.up) { p.up = false; p.k = 0; }
          else if (p.k >= 1) { p.done = true; p.d.pulse = 0.6; }
        }
        packets = packets.filter((p) => !p.done);
      },
      draw(ctx, t, m) {
        // Cloud.
        ctx.fillStyle = blue(0.25);
        for (const [dx, dy, r] of [[-14, 4, 10], [0, -2, 14], [15, 4, 10]]) {
          ctx.beginPath();
          ctx.arc(cloud.x + dx, cloud.y + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.setLineDash([2, 5]);
        ctx.lineWidth = 1;
        for (const d of devices) {
          ctx.strokeStyle = blue(0.18 * (1 - d.local));
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(cloud.x, cloud.y + 10);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        for (const p of packets) {
          const k = p.up ? p.k : 1 - p.k;
          const x = p.d.x + (cloud.x - p.d.x) * k, y = p.d.y + (cloud.y + 10 - p.d.y) * k;
          ctx.fillStyle = p.up ? blue(0.9) : cyan(0.9);
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
        if (m.inside) {
          ctx.strokeStyle = cyan(0.25);
          ctx.beginPath();
          ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (const d of devices) {
          if (d.pulse > 0) {
            ctx.strokeStyle = cyan(d.pulse * 0.8);
            ctx.beginPath();
            ctx.arc(d.x, d.y, 7 + (1 - d.pulse) * 10, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = d.local > 0.5 ? cyan(0.95) : blue(0.7);
          ctx.fillRect(d.x - 5, d.y - 7, 10, 14);
          ctx.fillStyle = BG;
          ctx.fillRect(d.x - 3, d.y - 5, 6, 8);
        }
      },
    };
  }

  // ---------- Physical AI: a robot arm picks and places blocks; hover to steer it, press near a block to grab it ----------
  function physical(W, H) {
    const floor = H - 12, base = { x: W / 2, y: floor - 6 };
    const L1 = H * 0.42, L2 = H * 0.36, reach = L1 + L2 - 2, S = 16, GRAB_R = 16;
    const blocks = [
      { x: base.x - reach * 0.6, y: floor - S / 2, vy: 0 },
      { x: base.x + reach * 0.6, y: floor - S / 2, vy: 0 },
    ];
    const eff = { x: base.x, y: base.y - L1 };
    // held: block in the gripper; byUser: grabbed by the visitor rather than the idle routine.
    let held = null, byUser = false, target = blocks[0], drop = null, seek = 0;

    // A free floor spot the hand can reach (not right under the base, where the arm can't fold).
    const spot = () => {
      for (let k = 0; k < 30; k++) {
        const x = base.x + rand(-reach * 0.85, reach * 0.85);
        if (Math.abs(x - base.x) > 30 && blocks.every((b) => b === held || Math.abs(b.x - x) > S * 1.6)) return { x, y: floor - S / 2 };
      }
      return { x: base.x + reach * 0.5, y: floor - S / 2 };
    };
    // Where a free block comes to rest: the floor, or the top of a block below it.
    const restY = (b) => {
      let y = floor - S / 2;
      for (const o of blocks) if (o !== b && o !== held && Math.abs(o.x - b.x) < S && o.y > b.y) y = Math.min(y, o.y - S);
      return y;
    };
    // Two-link inverse kinematics, picking the elbow-up solution.
    function ik(tx, ty) {
      const dx = tx - base.x, dy = ty - base.y;
      const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1, L1 + L2 - 0.01);
      const a = Math.atan2(dy, dx);
      const q2 = Math.acos(clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
      let best = null;
      for (const s of [1, -1]) {
        const q1 = a - Math.atan2(L2 * Math.sin(s * q2), L1 + L2 * Math.cos(s * q2));
        const elbow = { x: base.x + Math.cos(q1) * L1, y: base.y + Math.sin(q1) * L1 };
        if (!best || elbow.y < best.elbow.y) best = { elbow, q1, q2: s * q2 };
      }
      const hand = { x: best.elbow.x + Math.cos(best.q1 + best.q2) * L2, y: best.elbow.y + Math.sin(best.q1 + best.q2) * L2 };
      return { elbow: best.elbow, hand };
    }

    return {
      step(dt, t, m) {
        const reachNow = ik(eff.x, eff.y).hand;
        if (m.inside) {
          if (held && !byUser) held = null; // the visitor takes over: drop what the arm was carrying
          if (m.down && !held) {
            const b = blocks.find((o) => Math.hypot(o.x - reachNow.x, o.y - reachNow.y) < GRAB_R);
            if (b) { held = b; byUser = true; }
          } else if (!m.down && held) held = null;
        } else if (held && byUser) held = null;

        let gx, gy;
        if (m.inside) { gx = m.x; gy = Math.min(m.y, floor - S / 2); }
        else if (held) { gx = drop.x; gy = drop.y; }
        else { gx = target.x; gy = target.y; }
        const speed = m.inside ? 10 : 3.2;
        eff.x += (gx - eff.x) * ease(dt, speed);
        eff.y += (gy - eff.y) * ease(dt, speed);
        const hand = ik(eff.x, eff.y).hand;

        // Idle routine: carry one block to a free spot, then go for the other one.
        if (!m.inside) {
          const close = (p) => Math.hypot(hand.x - p.x, hand.y - p.y) < 3;
          seek += dt;
          if (!held && close(target)) { held = target; byUser = false; drop = spot(); seek = 0; }
          else if (held && close(drop)) { const b = held; held = null; target = blocks.find((o) => o !== b); seek = 0; }
          else if (!held && seek > 4) { target = blocks.find((o) => o !== target); seek = 0; } // out of reach: try the other
        } else seek = 0;

        if (held) { held.x = hand.x; held.y = hand.y; held.vy = 0; }
        // Gravity for every block not in the gripper.
        for (const b of blocks) {
          if (b === held) continue;
          const ry = restY(b);
          if (b.y < ry) { b.vy += 900 * dt; b.y = Math.min(ry, b.y + b.vy * dt); }
          if (b.y >= ry) { b.y = ry; b.vy = 0; }
        }
      },
      draw(ctx, t, m) {
        ctx.strokeStyle = blue(0.3);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, floor + 0.5);
        ctx.lineTo(W, floor + 0.5);
        ctx.stroke();
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = blue(0.18);
        ctx.beginPath();
        ctx.arc(base.x, base.y, reach, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        const reachNow = ik(eff.x, eff.y).hand;
        const grabbable = m.inside && !held ? blocks.find((o) => Math.hypot(o.x - reachNow.x, o.y - reachNow.y) < GRAB_R) : null;
        for (const b of blocks) {
          ctx.fillStyle = b === held ? cyan(0.9) : b === grabbable ? blue(0.95) : blue(0.65);
          ctx.fillRect(b.x - S / 2, b.y - S / 2, S, S);
        }
        // Pulsing outline: the idle routine's next block, or the one the gripper can grab right now.
        const mark = grabbable || (!held && !m.inside ? target : null);
        if (mark) {
          ctx.strokeStyle = cyan(0.5 + 0.3 * Math.sin(t * 6));
          ctx.strokeRect(mark.x - S / 2 - 3.5, mark.y - S / 2 - 3.5, S + 7, S + 7);
        }
        if (held && !byUser && drop && !m.inside) {
          ctx.strokeStyle = cyan(0.35);
          ctx.setLineDash([2, 3]);
          ctx.strokeRect(drop.x - S / 2 - 0.5, drop.y - S / 2 - 0.5, S + 1, S + 1);
          ctx.setLineDash([]);
        }

        const { elbow, hand } = ik(eff.x, eff.y);
        const far = m.inside && Math.hypot(m.x - base.x, m.y - base.y) > reach;
        ctx.strokeStyle = cyan(0.95);
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(elbow.x, elbow.y);
        ctx.lineTo(hand.x, hand.y);
        ctx.stroke();
        ctx.lineCap = "butt";
        ctx.fillStyle = blue(0.9);
        ctx.fillRect(base.x - 14, base.y - 2, 28, 8);
        for (const p of [base, elbow]) {
          ctx.fillStyle = BG;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = cyan(0.95);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // Gripper.
        const ang = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
        const open = held ? 3 : 6;
        ctx.strokeStyle = far ? warn(0.9) : cyan(0.95);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const s of [1, -1]) {
          const px = hand.x + Math.cos(ang + (s * Math.PI) / 2) * open, py = hand.y + Math.sin(ang + (s * Math.PI) / 2) * open;
          ctx.moveTo(hand.x, hand.y);
          ctx.lineTo(px, py);
          ctx.lineTo(px + Math.cos(ang) * 6, py + Math.sin(ang) * 6);
        }
        ctx.stroke();
      },
    };
  }

  const makers = { mtp, llm, memory, gpu, realtime, driving, drone, physical, compression, edge, optimization };

  // ---------- Driver ----------
  for (const canvas of canvases) {
    const make = makers[canvas.dataset.anim];
    if (!make) continue;
    const ctx = canvas.getContext("2d");
    const m = { x: -1e4, y: -1e4, inside: false, down: false };
    let anim, W, H, running = false, visible = false, last = 0;

    function setup() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      anim = make(W, H);
    }
    function render(t) {
      if (!anim.skipBackground) {
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
      }
      anim.draw(ctx, t, m);
    }
    function still() {
      for (let i = 0; i < 90; i++) anim.step(1 / 30, i / 30, m);
      render(3);
    }
    function frame(time) {
      if (!running) return;
      const t = time / 1000;
      const dt = Math.min(0.05, last ? t - last : 0);
      last = t;
      anim.step(dt, t, m);
      render(t);
      requestAnimationFrame(frame);
    }
    function setRunning(on) {
      if (reduceMotion) return;
      if (on && !running) { running = true; last = 0; requestAnimationFrame(frame); }
      if (!on) running = false;
    }

    canvas.addEventListener("pointermove", (ev) => {
      const r = canvas.getBoundingClientRect();
      m.x = ev.clientX - r.left;
      m.y = ev.clientY - r.top;
      m.inside = true;
    });
    canvas.addEventListener("pointerleave", () => { m.inside = false; m.down = false; m.x = m.y = -1e4; });
    canvas.addEventListener("pointerdown", (ev) => {
      const r = canvas.getBoundingClientRect();
      m.x = ev.clientX - r.left;
      m.y = ev.clientY - r.top;
      m.inside = true;
      m.down = true;
    });
    for (const type of ["pointerup", "pointercancel"]) canvas.addEventListener(type, () => { m.down = false; });
    canvas.addEventListener("click", (ev) => {
      if (!anim.click) return;
      const r = canvas.getBoundingClientRect();
      // Use the animation clock (last frame time) so click-spawned effects line up with step().
      anim.click(ev.clientX - r.left, ev.clientY - r.top, last || performance.now() / 1000);
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { setup(); reduceMotion ? still() : render(last); }, 150);
    });

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      setRunning(visible && !document.hidden);
    }).observe(canvas);
    document.addEventListener("visibilitychange", () => setRunning(visible && !document.hidden));

    setup();
    still();
  }
})();
