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
    const objects = [];
    for (let i = 0; i < 14; i++) {
      const s = rand(7, 14);
      objects.push({ x: rand(pad, W - pad), y: rand(pad, H - pad), w: s * rand(1, 1.6), h: s, seen: -9 });
    }
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
      step(dt, t, m) {
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
      draw(ctx, t) {
        // Ground grid.
        ctx.strokeStyle = blue(0.07);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < W; x += 24) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
        for (let y = 0; y < H; y += 24) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
        ctx.stroke();

        // Objects on the ground, with a detection box while (and shortly after) in view.
        for (const o of objects) {
          ctx.fillStyle = blue(0.35);
          ctx.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
          const a = clamp(1 - (t - o.seen) / 1.5, 0, 1);
          if (a <= 0) continue;
          const x0 = o.x - o.w / 2 - 4, y0 = o.y - o.h / 2 - 4, x1 = o.x + o.w / 2 + 4, y1 = o.y + o.h / 2 + 4, c = 5;
          ctx.strokeStyle = cyan(a);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x0, y0 + c); ctx.lineTo(x0, y0); ctx.lineTo(x0 + c, y0);
          ctx.moveTo(x1 - c, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + c);
          ctx.moveTo(x1, y1 - c); ctx.lineTo(x1, y1); ctx.lineTo(x1 - c, y1);
          ctx.moveTo(x0 + c, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - c);
          ctx.stroke();
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

  const makers = { mtp, memory, driving, drone, compression, optimization };

  // ---------- Driver ----------
  for (const canvas of canvases) {
    const make = makers[canvas.dataset.anim];
    if (!make) continue;
    const ctx = canvas.getContext("2d");
    const m = { x: -1e4, y: -1e4, inside: false };
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
    canvas.addEventListener("pointerleave", () => { m.inside = false; m.x = m.y = -1e4; });

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
