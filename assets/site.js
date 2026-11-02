// Renders the shared header and page content from window.SITE (data/content.js).

(function () {
  const D = window.SITE;
  const page = document.body.dataset.page;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Image or a tinted placeholder block when no image is set.
  const img = (src, alt, cls, label) =>
    src
      ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`
      : `<div class="${cls} placeholder" role="img" aria-label="${esc(alt)}"><span>${esc(label ?? alt)}</span></div>`;

  const stars = `<canvas id="dots-canvas" data-mode="stars" aria-hidden="true"></canvas>`;
  // The same field with a model held formed and turning (car and LLM take turns).
  const showcase = `<canvas id="dots-canvas" data-mode="model" aria-hidden="true"></canvas>`;
  const empty = (what) => `<section><p class="empty">${what} will be listed here soon.</p></section>`;

  // ---------- Header ----------
  const nav = [
    ["index", "Home", "index.html"],
    ["research", "Research", "research.html"],
    ["publications", "Publications", "publications.html"],
  ];
  // About sits on its own at the top left.
  const leftNav = [["about", "About", "about.html"]];
  // About, clicked again from the About page, goes home.
  const links = (list) =>
    list.map(([key, label, href]) => `<a href="${key === page && key === "about" ? "index.html" : href}" class="${key === page ? "active" : ""}">${label}</a>`).join("");

  const header = document.getElementById("site-header");
  header.innerHTML = `
    <div class="header-inner">
      <nav class="nav">${links(leftNav)}</nav>
      <nav class="nav">${links(nav)}</nav>
    </div>`;

  // Transparent at the top; a faint frosted band once content scrolls under it.
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const main = document.getElementById("content");

  // ---------- Pages ----------
  const renders = {
    // Full-screen dot field; assets/dots.js animates it.
    index() {
      return `<canvas id="dots-canvas" aria-hidden="true"></canvas>`;
    },

    // The other pages sit on the same dot field as home: plain stars behind About, a held
    // model behind Research and Publications.
    about() {
      return `${stars}
      <div class="container">
        <h1 class="page-title">About</h1>
        <section class="intro">
          <p class="intro-headline">${esc(D.about.headline)}</p>
          <dl class="intro-rows">
            ${D.about.rows.map(([label, text]) => `<dt>${esc(label)}</dt><dd>${[].concat(text).map((t) => (t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.text)}</a>` : esc(t))).join("")}</dd>`).join("")}
            ${D.about.links.length ? `<dt>Links</dt><dd class="intro-links">${D.about.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join("")}</dd>` : ""}
            ${D.contact.email ? `<dt>Contact</dt><dd><a href="mailto:${esc(D.contact.email)}">${esc(D.contact.email)}</a></dd>` : ""}
          </dl>
        </section>
      </div>`;
    },

    research() {
      return `${showcase}
      <div class="container">
        <h1 class="page-title">Research</h1>
        ${D.research.length ? "" : empty("Research")}
        ${D.research
          .map(
            (p) => `
          <article class="project">
            ${img(p.image, p.title, "project-img", p.title)}
            <div class="project-body">
              <h3>${esc(p.title)}</h3>
              <p>${esc(p.summary)}</p>
              ${p.link ? `<a class="more" href="${esc(p.link)}">Link</a>` : ""}
            </div>
          </article>`
          )
          .join("")}
      </div>`;
    },

    publications() {
      const years = [...new Set(D.publications.map((p) => p.year))].sort((a, b) => b - a);
      const linkLabels = { pdf: "PDF", code: "Code", project: "Project", bibtex: "BibTeX", video: "Video" };
      return `${showcase}
      <div class="container">
        <h1 class="page-title">Publications</h1>
        ${years.length ? "" : empty("Publications")}
        ${years
          .map(
            (y) => `
          <section>
            <h2>${y}</h2>
            <ul class="pubs">
              ${D.publications
                .filter((p) => p.year === y)
                .map(
                  (p) => `
                <li>
                  <div class="pub-title">${esc(p.title)}</div>
                  <div class="pub-authors">${esc(p.authors)}</div>
                  <div class="pub-venue">${esc(p.venue)}</div>
                  <div class="pub-links">
                    ${Object.entries(p.links || {})
                      .map(([k, href]) =>
                        href
                          ? `<a href="${esc(href)}">[${linkLabels[k] || k}]</a>`
                          : `<span class="disabled">[${linkLabels[k] || k}]</span>`
                      )
                      .join(" ")}
                  </div>
                </li>`
                )
                .join("")}
            </ul>
          </section>`
          )
          .join("")}
      </div>`;
    },
  };

  main.innerHTML = renders[page]();
  // On a page with a held model, its own menu link, clicked again, swaps the model instead.
  if (main.querySelector('#dots-canvas[data-mode="model"]'))
    header.querySelector(".nav a.active").addEventListener("click", (e) => {
      e.preventDefault();
      window.dispatchEvent(new Event("showcase-next"));
    });
  const pageName = [...nav, ...leftNav].find(([key]) => key === page)[1];
  document.title = D.name ? (page === "index" ? D.name : `${pageName} | ${D.name}`) : pageName;
})();
