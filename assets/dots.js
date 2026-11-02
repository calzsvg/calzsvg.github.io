// Home page: a full-screen field of wandering white dots, like stars. Bringing the pointer
// toward the middle gathers them into a 3D point-cloud model (a Hyundai Ioniq, an LLM, a
// monitor, multi-token prediction, a MacBook-style laptop, in turn) that turns slowly like a
// showroom turntable. Each model lasts 2 s (a click restarts that, dragging it round pauses
// it), then the dots scatter back into stars. With data-mode="stars" on the canvas it's only the
// wandering stars, as a background for other pages.

(function () {
  const canvas = document.getElementById("dots-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const STAR = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "238, 242, 250";

  const HOLD_MS = 2000; // a model lasts this long once formed, or after a click
  const REST_MS = 1200; // after it scatters, the pointer can't regather for this long
  const SPIN = 0.24; // turntable speed, rad/s (a full turn in ~26 s)
  const PITCH = 0.32; // camera looks down at the model by this much, rad
  const CAMERA = 4.2; // camera distance, in normalised model radii
  const START_ANGLE = -0.62; // each model first appears in a front three-quarter view
  const MODEL_SHARE = 0.85; // fraction of the dots that build the model; the rest stay stars
  // Get inside this central ellipse (radii relative to the viewport) to gather the dots...
  const ENTER = [0.17, 0.22];
  // ...and move this many px past the model's on-screen bounds to let it go.
  const LEAVE_PAD = 36;

  // ---------- 3D point-cloud helpers ----------
  // Points are [x, y, z, kind]: y up, +x the model's front (car nose), +z its right side.
  // SURF points fill in bodies and screens faintly, LINE points trace edges, LIGHT points
  // (lamps, screen edges, tokens) are drawn larger and brighter.
  const SURF = 0, LINE = 1, LIGHT = 2;
  const STEP = 0.03;

  function seg(out, a, b, kind = LINE, step = STEP) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, kind]);
    }
  }
  function poly(out, pts, closed, kind = LINE, step = STEP) {
    for (let i = 0; i < pts.length - 1; i++) seg(out, pts[i], pts[i + 1], kind, step);
    if (closed) seg(out, pts[pts.length - 1], pts[0], kind, step);
    else out.push([...pts[pts.length - 1], kind]);
  }
  // Circle (or arc) around c in the plane facing ±x, ±y or ±z.
  function arc(out, c, r, facing, kind = LINE, a0 = 0, a1 = Math.PI * 2) {
    const n = Math.max(6, Math.ceil((r * (a1 - a0)) / STEP));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n, u = r * Math.cos(a), v = r * Math.sin(a);
      out.push(facing === "z" ? [c[0] + u, c[1] + v, c[2], kind]
        : facing === "y" ? [c[0] + u, c[1], c[2] + v, kind]
        : [c[0], c[1] + v, c[2] + u, kind]);
    }
  }
  function box(out, [x0, y0, z0], [x1, y1, z1], kind = LINE) {
    const c = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
    for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]])
      seg(out, c(a), c(b), kind);
  }
  // Point at c + U·a + V·b, for drawing in an arbitrary plane.
  const at = (c, U, V, a, b) => [c[0] + U[0] * a + V[0] * b, c[1] + U[1] * a + V[1] * b, c[2] + U[2] * a + V[2] * b];
  // Rounded rectangle centred at c in the plane of unit vectors U, V (half sizes hw, hh).
  function rrect(out, c, U, V, hw, hh, r, kind = LINE, step = STEP) {
    const pts = [];
    for (const [a, b, a0] of [[hw - r, hh - r, 0], [r - hw, hh - r, Math.PI / 2], [r - hw, r - hh, Math.PI], [hw - r, r - hh, Math.PI * 1.5]])
      for (let i = 0; i <= 6; i++) {
        const t = a0 + (i / 6) * (Math.PI / 2);
        pts.push(at(c, U, V, a + r * Math.cos(t), b + r * Math.sin(t)));
      }
    poly(out, pts, true, kind, step);
  }
  // Grid of points over a rectangle centred at c in the plane U, V, for lit or textured faces.
  function grid(out, c, U, V, hw, hh, nu, nv, kind = SURF, keep = () => true) {
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const a = -hw + ((i + 0.5) / nu) * 2 * hw, b = -hh + ((j + 0.5) / nv) * 2 * hh;
        if (keep(a, b)) out.push([...at(c, U, V, a, b), kind]);
      }
  }
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const jitter = (n) => (Math.random() - 0.5) * n;

  // Smooth y(x) through control points sorted by x (Catmull-Rom), held flat past the ends.
  function curve(pts) {
    return (x) => {
      let i = 0;
      while (i < pts.length - 2 && x > pts[i + 1][0]) i++;
      const p0 = pts[Math.max(i - 1, 0)][1], p1 = pts[i][1], p2 = pts[i + 1][1], p3 = pts[Math.min(i + 2, pts.length - 1)][1];
      const t = Math.min(1, Math.max(0, (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0])));
      return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
    };
  }
  // Centre on the bounding box and scale so the model's radius is about 1. Height counts a
  // little extra so tall models don't run into the header; `size` shrinks deep, near-facing models.
  function normalise(pts, size = 1) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    const mid = lo.map((v, k) => (v + hi[k]) / 2);
    const r = Math.max((hi[0] - lo[0]) / 2, ((hi[1] - lo[1]) / 2) * 1.5, (hi[2] - lo[2]) / 2) / size;
    return pts.map((p) => [(p[0] - mid[0]) / r, (p[1] - mid[1]) / r, (p[2] - mid[2]) / r, p[3]]);
  }

  // ---------- Models ----------
  // Hyundai Ioniq Electric (2020 facelift), in metres: 4.47 m five-door liftback, 2.7 m
  // wheelbase. A long low hood over a wide hexagonal closed grille, slim headlamps sweeping
  // up the fenders and C-shaped lamps in the bumper corners; a steep windscreen and a roof
  // that arcs over the B-pillar and slopes to a spoiler splitting the rear glass, above a
  // near-vertical lower tail panel; wedge tail lamps wrapping onto the tailgate; chrome
  // window line and sill trim; twin-spoke wheels.
  function ioniq() {
    const out = [];
    const L = 2.235, WHEELS = [-1.35, 1.35], WY = 0.32;
    const roof = curve([[-2.08, 1.09], [-1.95, 1.16], [-1.6, 1.27], [-1.1, 1.38], [-0.4, 1.45], [0.05, 1.41], [0.45, 1.22], [0.85, 1.01], [1.4, 0.95], [1.9, 0.86], [2.15, 0.74], [L, 0.62]]);
    // Behind the spoiler the lower tail glass drops almost vertically, then the bumper.
    const top = (x) => (x >= -2.08 ? roof(x) : x >= -2.2 ? 1.09 - ((-2.08 - x) / 0.12) * 0.23 : 0.86 - ((-2.2 - x) / 0.035) * 0.2);
    const belt = curve([[-1.95, 1.1], [-1.75, 1.07], [-0.5, 1.03], [0.85, 0.99]]);
    const shoulder = curve([[-L, 0.95], [-1.8, 0.93], [0, 0.89], [1.6, 0.86], [L, 0.8]]);
    const bottom = curve([[-L, 0.42], [-2.05, 0.3], [-1.8, 0.24], [1.8, 0.24], [2.1, 0.28], [L, 0.36]]);
    const taper = (x) => (x > 1.6 ? 1 - 0.3 * ((x - 1.6) / 0.64) ** 2 : x < -1.7 ? 1 - 0.12 * ((-x - 1.7) / 0.54) ** 2 : 1);
    const hasGlass = (x) => x > -1.85 && x < 0.85;
    const inArch = (x, y, z) => Math.abs(z) > 0.55 && WHEELS.some((wx) => (x - wx) ** 2 + (y - WY) ** 2 < 0.41 ** 2);

    // Half cross-section at station x, roof centre down to the rocker, as [y, z] pairs.
    const section = (x) => {
      const f = taper(x), t = top(x), lo = bottom(x), sh = Math.min(shoulder(x), t - 0.1);
      const upper = hasGlass(x)
        ? [[t, 0], [t - 0.03, 0.4 * f], [t - 0.08, 0.58 * f], [Math.min(belt(x), t - 0.02), 0.8 * f]]
        : [[t, 0], [t - 0.02, 0.45 * f], [t - 0.06, 0.78 * f]];
      return [...upper, [sh, 0.91 * f], [lo + 0.25, 0.91 * f], [lo + 0.08, 0.86 * f], [lo, 0.76 * f]];
    };
    // Where the side glass sits at height y: between the belt and the roof edge.
    const glassZ = (x, y) => {
      const b = belt(x), e = top(x) - 0.08;
      return (0.8 + (0.58 - 0.8) * Math.min(1, Math.max(0, (y - b) / (e - b)))) * taper(x);
    };
    const side = (x, y, s, kind = LINE) => [x, y, s * glassZ(x, y), kind];

    // Body shell: points walked along each cross-section, both sides.
    for (let x = -L + 0.02; x < L; x += 0.055) {
      const sec = section(x);
      for (let i = 0; i < sec.length - 1; i++) {
        const [y0, z0] = sec[i], [y1, z1] = sec[i + 1];
        const n = Math.max(1, Math.round(Math.hypot(y1 - y0, z1 - z0) / 0.065));
        for (let k = 0; k < n; k++) {
          const y = y0 + ((y1 - y0) * k) / n, z = z0 + ((z1 - z0) * k) / n;
          for (const s of [-1, 1]) if (!inArch(x, y, z)) out.push([x + jitter(0.03), y, s * z, SURF]);
        }
      }
    }
    // Nose and tail faces.
    grid(out, [L - 0.01, 0.48, 0], Z, Y, 0.62, 0.12, 14, 4);
    grid(out, [-2.215, 0.63, 0], Z, Y, 0.78, 0.2, 16, 5);

    // Profile: roof, hood and tail along the centre line, and the roof edges.
    for (let x = -2.2; x <= L; x += STEP) out.push([x, top(x), 0, LINE]);
    for (let x = -1.85; x <= 0.85; x += STEP) for (const s of [-1, 1]) out.push([x, top(x) - 0.08, s * 0.58 * taper(x), LINE]);

    for (const s of [-1, 1]) {
      // Side windows: A-pillar along the windscreen, roof line, rounded rear quarter, chrome belt.
      const dlo = [];
      for (let x = 0.8; x >= 0.0; x -= 0.05) dlo.push([x, belt(0.8) + (top(0) - 0.13 - belt(0.8)) * ((0.8 - x) / 0.8)]);
      for (let x = -0.05; x >= -1.65; x -= 0.05) dlo.push([x, top(x) - 0.13]);
      for (let k = 1; k <= 6; k++) { const x = -1.65 - k * 0.03; dlo.push([x, top(-1.65) - 0.13 - (top(-1.65) - 0.13 - belt(x)) * (k / 6) ** 0.7]); }
      for (let x = -1.83; x <= 0.8; x += 0.05) dlo.push([x, belt(x)]);
      poly(out, dlo.map(([x, y]) => side(x, y, s)), true);
      for (const [xa, xb] of [[-0.45, -0.42], [-1.3, -1.38]]) seg(out, side(xa, top(xa) - 0.13, s), side(xb, belt(xb), s));
      // Shoulder character line, door shut lines and the chrome sill.
      for (let x = 1.95; x >= -2.1; x -= STEP) { const y = shoulder(x), z = s * 0.91 * taper(x); if (!inArch(x, y, z)) out.push([x, y, z, LINE]); }
      for (const x of [0.75, -0.45, -1.42]) seg(out, [x, belt(x) - 0.03, s * 0.86], [x, bottom(x) + 0.1, s * 0.91]);
      seg(out, [0.9, 0.3, s * 0.89], [-0.9, 0.3, s * 0.89]);
      // Mirror.
      poly(out, [[0.76, 1.0, s * 0.82], [0.7, 1.07, s * 1.0], [0.6, 1.05, s * 1.0], [0.65, 0.98, s * 0.84]], true);
      // Headlamp: slim, sweeping up and back along the fender.
      poly(out, [[2.14, 0.7, s * 0.52], [2.02, 0.77, s * 0.74], [1.86, 0.84, s * 0.86], [1.9, 0.8, s * 0.88], [2.06, 0.71, s * 0.8], [2.16, 0.66, s * 0.56]], true, LIGHT);
      // C-shaped lamp in the bumper corner.
      poly(out, [[2.08, 0.52, s * 0.8], [2.16, 0.48, s * 0.7], [2.18, 0.36, s * 0.68], [2.12, 0.32, s * 0.8]], false, LIGHT);
      // Tail lamp: a wedge from the rear quarter wrapping onto the tailgate.
      poly(out, [[-1.98, 1.02, s * 0.88], [-2.16, 1.0, s * 0.72], [-2.19, 0.96, s * 0.42], [-2.18, 0.93, s * 0.62], [-2.02, 0.95, s * 0.9]], true, LIGHT);
      seg(out, [-2.21, 0.42, s * 0.72], [-2.21, 0.55, s * 0.74], LIGHT); // bumper reflector
    }
    // Windscreen base and header, the rear spoiler with its brake light, the tail glass edge.
    poly(out, [[0.85, 0.99, -0.8], [0.86, 1.01, 0], [0.85, 0.99, 0.8]], false);
    poly(out, [[0.02, top(0) - 0.05, -0.56], [0.02, top(0), 0], [0.02, top(0) - 0.05, 0.56]], false);
    poly(out, [[-2.08, 1.1, -0.82], [-2.1, 1.12, 0], [-2.08, 1.1, 0.82]], false);
    seg(out, [-2.1, 1.125, -0.3], [-2.1, 1.125, 0.3], LIGHT);
    poly(out, [[-2.2, 0.86, -0.76], [-2.21, 0.87, 0], [-2.2, 0.86, 0.76]], false);

    // Hexagonal closed grille with its pattern, and the badge.
    const hex = [[0.6, -0.48], [0.6, 0.48], [0.47, 0.66], [0.3, 0.46], [0.3, -0.46], [0.47, -0.66]];
    const noseX = (z) => L - 0.01 - 0.12 * (Math.abs(z) / 0.7) ** 2;
    poly(out, hex.map(([y, z]) => [noseX(z), y, z]), true);
    const inHex = (z, y) => hex.every(([y0, z0], i) => {
      const [y1, z1] = hex[(i + 1) % hex.length];
      return (z1 - z0) * (y - y0) - (y1 - y0) * (z - z0) <= 0;
    });
    for (let y = 0.33; y < 0.6; y += 0.05) for (let z = -0.6; z <= 0.6; z += 0.07) if (inHex(z, y)) out.push([noseX(z) + 0.005, y, z, SURF]);
    arc(out, [L, 0.52, 0], 0.06, "x", LIGHT);

    // Wheels: tyre faces, twin-spoke rims, hubs, and the arches over them.
    for (const wx of WHEELS)
      for (const s of [-1, 1]) {
        arc(out, [wx, WY, s * 0.86], 0.32, "z");
        arc(out, [wx, WY, s * 0.68], 0.32, "z");
        arc(out, [wx, WY, s * 0.87], 0.24, "z");
        arc(out, [wx, WY, s * 0.87], 0.05, "z");
        for (let k = 0; k < 5; k++)
          for (const da of [-0.09, 0.09]) {
            const a = (k / 5) * Math.PI * 2 + da;
            seg(out, [wx + 0.05 * Math.cos(a), WY + 0.05 * Math.sin(a), s * 0.87], [wx + 0.24 * Math.cos(a), WY + 0.24 * Math.sin(a), s * 0.87]);
          }
        arc(out, [wx, WY, s * 0.9], 0.41, "z", LINE, 0.1, Math.PI - 0.1);
      }
    return out;
  }

  // Monitor in the style of a modern slim display: a thin flat panel with narrow even
  // bezels, one angled aluminium arm onto a flat foot, and a low-profile keyboard and mouse.
  function monitor() {
    const out = [];
    const C = [0, 0.43, 0], HW = 0.31, HH = 0.18;
    rrect(out, C, X, Y, HW, HH, 0.012);
    rrect(out, [0, 0.43, -0.022], X, Y, HW - 0.004, HH - 0.004, 0.012);
    for (const [a, b] of [[HW, HH], [-HW, HH], [HW, -HH], [-HW, -HH]]) seg(out, [a, 0.43 + b, 0], [a * 0.985, 0.43 + b * 0.98, -0.022]);
    rrect(out, [0, 0.43, 0.001], X, Y, HW - 0.012, HH - 0.012, 0.004, LIGHT);
    grid(out, [0, 0.43, 0.001], X, Y, HW - 0.02, HH - 0.02, 18, 10);
    // Arm: a flat plate from behind the panel down and back to the foot.
    const arm = [[-0.07, 0.36, -0.024], [0.07, 0.36, -0.024], [0.07, 0.012, -0.19], [-0.07, 0.012, -0.19]];
    poly(out, arm, true);
    grid(out, [0, 0.186, -0.107], X, [0, 0.902, -0.432], 0.06, 0.18, 4, 6);
    rrect(out, [0, 0.012, -0.09], X, Z, 0.085, 0.12, 0.025);
    rrect(out, [0, 0, -0.09], X, Z, 0.085, 0.12, 0.025);
    // Keyboard and mouse.
    rrect(out, [-0.04, 0.008, 0.25], X, Z, 0.15, 0.055, 0.01);
    grid(out, [-0.04, 0.009, 0.25], X, Z, 0.135, 0.042, 15, 5);
    rrect(out, [0.2, 0.01, 0.26], X, Z, 0.028, 0.05, 0.026);
    return out;
  }

  // Laptop in the style of a MacBook Pro: thin rounded aluminium slab, keyboard well with
  // speaker grilles either side, a wide trackpad, a thumb notch at the front edge, the lid
  // open past upright with slim bezels, a camera notch and a logo on the back.
  function macbook() {
    const out = [];
    const T = 0.0155, HW = 0.156, HD = 0.1105;
    rrect(out, [0, 0, 0], X, Z, HW, HD, 0.012, LINE, 0.012);
    rrect(out, [0, T, 0], X, Z, HW, HD, 0.012, LINE, 0.012);
    rrect(out, [0, T, -0.025], X, Z, 0.128, 0.056, 0.006, LINE, 0.01);
    grid(out, [0, T, -0.025], X, Z, 0.122, 0.05, 15, 6);
    for (const s of [-1, 1]) grid(out, [s * 0.143, T, -0.025], X, Z, 0.006, 0.05, 2, 9);
    rrect(out, [0, T, 0.062], X, Z, 0.072, 0.04, 0.006, LINE, 0.01);
    arc(out, [0, T, HD], 0.016, "y", LINE, 0, Math.PI);
    // Lid, tipped 20° back from upright about the hinge along the back edge.
    const tilt = (20 * Math.PI) / 180, LH = 0.215;
    const up = [0, Math.cos(tilt), -Math.sin(tilt)], back = [0, -Math.sin(tilt), -Math.cos(tilt)];
    const hinge = [0, T, -HD];
    const lidC = at(hinge, X, up, 0, LH / 2);
    rrect(out, lidC, X, up, HW, LH / 2, 0.01, LINE, 0.012);
    rrect(out, at(lidC, X, back, 0, 0.006), X, up, HW, LH / 2, 0.01, LINE, 0.012);
    rrect(out, at(lidC, X, back, 0, -0.0005), X, up, HW - 0.006, LH / 2 - 0.007, 0.008, LIGHT, 0.01);
    grid(out, lidC, X, up, HW - 0.012, LH / 2 - 0.014, 16, 10);
    poly(out, [at(lidC, X, up, -0.016, LH / 2 - 0.007), at(lidC, X, up, -0.016, LH / 2 - 0.016), at(lidC, X, up, 0.016, LH / 2 - 0.016), at(lidC, X, up, 0.016, LH / 2 - 0.007)], false, LIGHT, 0.008);
    const logo = [];
    arc(logo, [0, 0, 0], 0.018, "z", LIGHT, 0.6, Math.PI * 2 - 0.25);
    for (const [a, b] of logo) out.push([...at(at(lidC, X, back, 0, 0.0065), X, up, a, b), LIGHT]);
    return out;
  }

  // Token cube: a small glowing box centred at c.
  const token = (out, [x, y, z], s = 0.06) => box(out, [x - s, y - s, z - s], [x + s, y + s, z + s], LIGHT);

  // LLM: input tokens rise through a stack of transformer layers; between layers each token
  // attends to itself and every earlier token (causal attention). The next token glows on top.
  function llm() {
    const out = [];
    const xs = [-0.48, -0.24, 0, 0.24, 0.48], LAYERS = 4, GAP = 0.3;
    for (const x of xs) token(out, [x, -0.2, 0]);
    for (let l = 0; l < LAYERS; l++) {
      const y = l * GAP;
      poly(out, [[-0.62, y, -0.36], [0.62, y, -0.36], [0.62, y, 0.36], [-0.62, y, 0.36]], true);
      if (l < LAYERS - 1)
        xs.forEach((xk, k) => xs.slice(0, k + 1).forEach((xj) => seg(out, [xj, y, 0], [xk, y + GAP, 0], SURF)));
    }
    for (const x of xs) seg(out, [x, -0.14, 0], [x, 0, 0]);
    seg(out, [0.48, (LAYERS - 1) * GAP, 0], [0.48, (LAYERS - 1) * GAP + 0.16, 0]);
    token(out, [0.48, (LAYERS - 1) * GAP + 0.24, 0], 0.08);
    return out;
  }

  // MTP (multi-token prediction): a shared trunk of layers feeds several output heads side by
  // side, each predicting a different future token (t+1 … t+4), chained left to right.
  function mtp() {
    const out = [];
    for (let l = 0; l < 4; l++) {
      const y = l * 0.12;
      poly(out, [[-0.36, y, -0.3], [0.36, y, -0.3], [0.36, y, 0.3], [-0.36, y, 0.3]], true);
    }
    for (const [x, z] of [[-0.36, -0.3], [0.36, -0.3], [0.36, 0.3], [-0.36, 0.3]]) seg(out, [x, 0, z], [x, 0.36, z]);
    const heads = [-0.66, -0.22, 0.22, 0.66];
    heads.forEach((hx) => {
      seg(out, [0, 0.36, 0], [hx, 0.66, 0], SURF);
      box(out, [hx - 0.1, 0.66, -0.1], [hx + 0.1, 0.76, 0.1]);
      seg(out, [hx, 0.76, 0], [hx, 0.9, 0]);
      token(out, [hx, 0.98, 0], 0.07);
    });
    for (let i = 0; i < heads.length - 1; i++) seg(out, [heads[i] + 0.09, 0.98, 0], [heads[i + 1] - 0.09, 0.98, 0], LIGHT);
    return out;
  }

  const MODELS = [[ioniq(), 1], [llm(), 1], [monitor(), 0.9], [mtp(), 1], [macbook(), 0.72]].map(([m, size]) => normalise(m, size));

  // ---------- Dots ----------
  let W = 0, H = 0;
  const dots = [];
  const makeDot = () => {
    const a = Math.random() * Math.PI * 2, maxV = 0.8 + Math.random() * 1.8;
    const big = Math.random() < 0.1;
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: Math.cos(a) * maxV, vy: Math.sin(a) * maxV, maxV,
      k: 0.05 + Math.random() * 0.05, // spring strength, varied so dots arrive at different times
      r: big ? 1.6 + Math.random() * 0.9 : 0.6 + Math.random() * 1.0,
      tw: 1 + Math.random() * 3, ph: Math.random() * 6.3, // twinkle rate and phase
      mi: -1, // index into the current model's points, or -1 for a free star
      a: 0,
    };
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = Math.max(1100, Math.min(2600, Math.round((W * H) / 520)));
    while (dots.length < want) dots.push(makeDot());
    dots.length = want;
    if (mode !== "wander") assign(MODELS[modelIndex]);
  }

  // Give a random share of the dots a point of the model. Lights go first (up to a fifth),
  // then edges, with about a third of what's left for surfaces; each kind is thinned evenly.
  function assign(model) {
    const count = Math.round(dots.length * MODEL_SHARE);
    const byKind = [[], [], []];
    model.forEach((p, i) => byKind[p[3]].push(i));
    const take = (arr, n) => (n >= arr.length ? arr : Array.from({ length: n }, (_, i) => arr[Math.floor((i * arr.length) / n)]));
    const lights = take(byKind[LIGHT], Math.round(count * 0.2));
    const left = count - lights.length;
    const surfWant = Math.min(byKind[SURF].length, Math.round(left * 0.35));
    const lines = take(byKind[LINE], left - surfWant);
    const surfs = take(byKind[SURF], left - lines.length);
    const picks = [...lights, ...lines, ...surfs];
    const order = dots.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((di, i) => (dots[di].mi = i < picks.length ? picks[i] : -1));
  }

  // ---------- Behaviour ----------
  let mode = "wander"; // "wander" | "shape" (formed) | "hold" (clicked: stays even if the pointer leaves)
  let releaseAt = 0; // when the current model scatters
  let modelIndex = -1;
  let angle = START_ANGLE;
  let pitch = PITCH;
  let spin = SPIN; // current turn rate; a fling sets it, then it eases back to SPIN
  let restUntil = 0;
  // Dragging a formed model turns it by hand: sideways spins it, up and down tips it.
  const DRAG_TURN = 0.008; // rad per px
  let drag = null; // { x, y, t, moved } while the pointer is held down on the model
  let dragged = false; // the last press was a drag, so its click shouldn't hold/scatter

  const zone = (x, y, [rx, ry]) => ((x - W / 2) / (W * rx)) ** 2 + ((y - H / 2) / (H * ry)) ** 2;

  // Pages other than home use the field as a plain starry background: nothing gathers.
  const STARS_ONLY = canvas.dataset.mode === "stars";

  function gather() {
    if (STARS_ONLY) return;
    modelIndex = (modelIndex + 1) % MODELS.length;
    angle = START_ANGLE;
    pitch = PITCH;
    spin = SPIN;
    assign(MODELS[modelIndex]);
    mode = "shape";
    releaseAt = performance.now() + HOLD_MS;
  }

  function scatter(rest) {
    mode = "wander";
    restUntil = performance.now() + rest;
    for (const d of dots) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
      d.vx = Math.cos(a) * sp;
      d.vy = Math.sin(a) * sp;
    }
  }

  // The model's projected bounds, updated every frame while it's formed; the pointer is
  // checked against them on every move and every frame, since the model keeps turning.
  let bounds = null;
  let pointer = null;
  const outsideModel = () =>
    bounds && pointer &&
    (pointer.x < bounds.x0 - LEAVE_PAD || pointer.x > bounds.x1 + LEAVE_PAD ||
     pointer.y < bounds.y0 - LEAVE_PAD || pointer.y > bounds.y1 + LEAVE_PAD);

  function onPointer(e) {
    pointer = { x: e.clientX, y: e.clientY };
    if (drag) {
      const dx = pointer.x - drag.x, dy = pointer.y - drag.y, now = performance.now();
      angle += dx * DRAG_TURN;
      pitch = Math.max(-1.3, Math.min(1.3, pitch + dy * DRAG_TURN));
      spin = (dx * DRAG_TURN) / Math.max(0.008, (now - drag.t) / 1000); // fling speed on release
      drag = { x: pointer.x, y: pointer.y, t: now, moved: drag.moved + Math.abs(dx) + Math.abs(dy) };
      return;
    }
    if (mode === "wander") {
      if (zone(pointer.x, pointer.y, ENTER) < 1 && performance.now() >= restUntil) gather();
    } else if (mode === "shape" && outsideModel()) {
      scatter(300);
    }
  }
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerdown", (e) => e.pointerType !== "mouse" && onPointer(e));
  canvas.addEventListener("pointerdown", (e) => {
    if (mode === "wander") return;
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    document.body.classList.add("dragging");
  });
  const endDrag = () => {
    if (!drag) return;
    dragged = drag.moved > 6;
    if (performance.now() - drag.t > 120) spin = SPIN; // held still before letting go: no fling
    drag = null;
    document.body.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  // Pointer left the window: let the model go (a click-hold still runs its 2 s).
  document.addEventListener("mouseout", (e) => {
    if (!e.relatedTarget && mode === "shape" && !drag) scatter(300);
  });
  window.addEventListener("click", (e) => {
    if (dragged) { dragged = false; return; }
    if (mode === "wander" || e.target.closest("#site-header")) return;
    mode = "hold";
    releaseAt = performance.now() + HOLD_MS;
  });
  window.addEventListener("resize", resize);

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode !== "wander") {
      if (drag) releaseAt = now + HOLD_MS; // turning it by hand keeps it, then 2 s after letting go
      else if (now >= releaseAt) scatter(REST_MS);
    }
    const formed = mode !== "wander";
    if (formed && !drag) {
      angle += spin * dt;
      spin += (SPIN - spin) * Math.min(1, dt * 1.5);
    }
    document.body.classList.toggle("shaped", formed); // the page shows a grab cursor over a model

    const model = formed ? MODELS[modelIndex] : null;
    const ca = Math.cos(angle), sa = Math.sin(angle), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cx = W / 2, cy = H / 2 + H * 0.02, scale = Math.min(W * 0.36, H * 0.48);
    const t = now / 1000;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = `rgb(${STAR})`;
    const box = model ? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity } : null;
    for (const d of dots) {
      let goal, size = d.r;
      if (model && d.mi >= 0) {
        // Turntable about the vertical axis, then tip toward the camera, then perspective.
        const [x, y, z, kind] = model[d.mi];
        const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp; // near side drops: seen from above
        const persp = CAMERA / (CAMERA - z2);
        const near = Math.min(1, Math.max(0, (z2 + 1) / 2)); // 0 far side, 1 near side
        const tx = cx + x1 * scale * persp, ty = cy - y2 * scale * persp;
        if (tx < box.x0) box.x0 = tx;
        if (tx > box.x1) box.x1 = tx;
        if (ty < box.y0) box.y0 = ty;
        if (ty > box.y1) box.y1 = ty;
        d.vx = (d.vx + (tx - d.x) * d.k) * 0.78;
        d.vy = (d.vy + (ty - d.y) * d.k) * 0.78;
        goal = (0.22 + 0.78 * near) * [0.5, 0.85, 1][kind];
        size = (0.9 + 0.5 * near) * persp * [0.75, 1, 1][kind] + (kind === LIGHT ? 0.5 : 0);
      } else {
        d.vx += jitter(0.6);
        d.vy += jitter(0.6);
        const v = Math.hypot(d.vx, d.vy);
        if (v > d.maxV) {
          const f = Math.max(d.maxV / v, 0.95); // ease off a scatter burst over ~1 s
          d.vx *= f;
          d.vy *= f;
        }
        goal = (formed ? 0.3 : 0.75) * (0.65 + 0.35 * Math.sin(t * d.tw + d.ph));
      }
      d.x += d.vx;
      d.y += d.vy;
      if (!model || d.mi < 0) {
        if (d.x < -8) d.x = W + 8; else if (d.x > W + 8) d.x = -8;
        if (d.y < -8) d.y = H + 8; else if (d.y > H + 8) d.y = -8;
      }
      d.a += (goal - d.a) * 0.08;

      if (d.r > 1.6 && !(model && d.mi >= 0)) {
        // a soft halo on the bigger stars
        ctx.globalAlpha = d.a * 0.12;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    bounds = box;
    if (mode === "shape" && !drag && outsideModel()) scatter(300);
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
