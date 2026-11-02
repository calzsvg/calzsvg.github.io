// Renders the shared header/footer and page content from window.SITE (data/content.js).

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

  const empty = (what) => `<section><p class="empty">${what} will be listed here soon.</p></section>`;

  // ---------- Header / footer ----------
  const nav = [
    ["index", "Home", "index.html"],
    ["research", "Research", "research.html"],
    ["publications", "Publications", "publications.html"],
    ["contact", "Contact", "contact.html"],
  ];
  const navLinks = nav.map(([key, label, href]) => `<a href="${href}" class="${key === page ? "active" : ""}">${label}</a>`).join("");

  // Hovering the three-line button (or tapping it) shows the links as plain text below it;
  // wide screens also keep them top right.
  const header = document.getElementById("site-header");
  header.innerHTML = `
    <div class="header-inner">
      <div class="menu">
        <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="menu-links">
          <span></span><span></span><span></span>
        </button>
        <nav class="menu-links" id="menu-links">${navLinks}</nav>
      </div>
      <nav class="nav">${navLinks}</nav>
    </div>`;

  const menu = header.querySelector(".menu");
  const toggle = header.querySelector(".nav-toggle");
  const setMenu = (open) => {
    menu.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  let closeTimer;
  menu.addEventListener("mouseenter", () => { clearTimeout(closeTimer); setMenu(true); });
  menu.addEventListener("mouseleave", () => { closeTimer = setTimeout(() => setMenu(false), 200); });
  // With a mouse, hover already opened it, so a click shouldn't close it again.
  const canHover = matchMedia("(hover: hover)").matches;
  toggle.addEventListener("click", () => setMenu(canHover || !menu.classList.contains("open")));
  document.addEventListener("click", (e) => !menu.contains(e.target) && setMenu(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  // Transparent at the top; a faint frosted band once content scrolls under it.
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.getElementById("site-footer").innerHTML = `
    <div class="container footer-inner">
      <div>© ${new Date().getFullYear()} ${esc(D.name)}</div>
      ${D.contact.email ? `<div><a href="mailto:${esc(D.contact.email)}">${esc(D.contact.email)}</a></div>` : ""}
    </div>`;

  const main = document.getElementById("content");

  // ---------- Pages ----------
  const renders = {
    // Full-screen dot field; assets/dots.js animates it.
    index() {
      return `<canvas id="dots-canvas" aria-hidden="true"></canvas>`;
    },

    research() {
      return `
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
      return `
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

    contact() {
      const C = D.contact;
      return `
      <div class="container">
        <h1 class="page-title">Contact</h1>
        ${C.email || C.links.length ? "" : empty("Contact details")}
        <section>
          ${C.email ? `<h2>Email</h2><p><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></p>` : ""}
          ${C.links.length
            ? `<h2>Elsewhere</h2>
          <p>${C.links.map((l) => `<span class="contact-label">${esc(l.label)}</span><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.text)}</a>`).join("<br>")}</p>`
            : ""}
        </section>
      </div>`;
    },
  };

  main.innerHTML = renders[page]();
  const pageName = nav.find(([key]) => key === page)[1];
  document.title = D.name ? (page === "index" ? D.name : `${pageName} | ${D.name}`) : pageName;
})();
