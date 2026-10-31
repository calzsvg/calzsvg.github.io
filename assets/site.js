// Renders the shared header/footer and page content from window.AISL (data/content.js).

(function () {
  const D = window.AISL;
  const page = document.body.dataset.page;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Korean names show the full Hangul name; others show initials.
  const initials = (name) => {
    const base = name.split(" (")[0].trim();
    if (/[가-힣]/.test(base)) return base;
    return base.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  };

  // Image or a tinted placeholder block when no image is set.
  const img = (src, alt, cls, label) =>
    src
      ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`
      : `<div class="${cls} placeholder" role="img" aria-label="${esc(alt)}"><span>${esc(label ?? alt)}</span></div>`;

  // ---------- Header / footer ----------
  const nav = [
    ["index", "Home", "index.html"],
    ["people", "People", "people.html"],
    ["research", "Research", "research.html"],
    ["publications", "Publications", "publications.html"],
  ];

  document.getElementById("site-header").innerHTML = `
    <div class="container header-inner">
      <a class="logo" href="index.html" aria-label="${esc(D.lab.name)} home">
        <img class="logo-img" src="images/aisl-logo.png" alt="${esc(D.lab.fullName)}">
      </a>
      <div class="header-actions">
        <nav class="nav">
          ${nav.map(([key, label, href]) => `<a href="${href}" class="${key === page ? "active" : ""}">${label}</a>`).join("")}
        </nav>
        <button class="nav-toggle" aria-label="Menu" aria-expanded="false">☰</button>
      </div>
    </div>`;

  const toggle = document.querySelector(".nav-toggle");
  toggle.addEventListener("click", () => {
    const open = document.querySelector(".nav").classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });

  document.getElementById("site-footer").innerHTML = `
    <div class="container footer-inner">
      <div>
        <strong>${esc(D.lab.fullName)}</strong><br>
        ${esc(D.lab.university)}
        ${D.lab.address ? `<br>${esc(D.lab.address)}` : ""}
      </div>
      <div class="footer-right">
        ${D.lab.email ? `<strong>Contact us:</strong> <a href="mailto:${esc(D.lab.email)}">${esc(D.lab.email)}</a><br>` : ""}
        © ${new Date().getFullYear()} ${esc(D.lab.name)}
      </div>
    </div>`;

  const main = document.getElementById("content");

  // ---------- Pages ----------
  const projectRows = (items) =>
    items
      .map(
        (p) => `
      <article class="project">
        ${p.image || !p.anim
          ? img(p.image, p.title, "project-img", p.title)
          : `<canvas class="project-img project-anim" data-anim="${esc(p.anim)}" role="img" aria-label="${esc(p.title)} animation"></canvas>`}
        <div class="project-body">
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.summary)}</p>
          ${p.link ? `<a class="more" href="${esc(p.link)}">Link</a>` : ""}
        </div>
      </article>`
      )
      .join("");

  const renders = {
    index() {
      return `
      <section class="hero">
        <canvas id="hero-canvas" aria-hidden="true"></canvas>
        <div class="hero-fade"></div>
        <div class="container hero-inner">
          <div class="hero-text">
            <h1>Welcome to ${esc(D.lab.fullName)}</h1>
            <p>${esc(D.lab.intro)}</p>
            <p><strong>Join us:</strong> ${esc(D.lab.join)}</p>
          </div>
          ${D.lab.groupPhoto ? img(D.lab.groupPhoto, "AISL group photo", "hero-img") : ""}
        </div>      </section>
      <div class="container">
        <section class="news">
          <h2>News</h2>
          <ul>${D.news.map((n) => `<li><span class="date">${esc(n.date)}</span>${esc(n.text)}</li>`).join("")}</ul>
        </section>
        <section>
          <h2>Research Highlights</h2>
          ${projectRows(D.research.filter((r) => r.featured))}
        </section>
      </div>`;
    },

    people() {
      const groups = [...new Set(D.people.map((p) => p.group))];
      return `
      <div class="container">
        <h1 class="page-title">People</h1>
        ${groups
          .map(
            (g) => `
          <section>
            <h2>${esc(g)}</h2>
            <div class="people-grid ${g === "Faculty" ? "faculty" : ""}">
              ${D.people
                .filter((p) => p.group === g)
                .map(
                  (p) => `
                <div class="person">
                  ${img(p.image, p.name, "avatar", initials(p.name))}
                  <div class="person-name">${
                    p.github
                      ? `<a href="https://github.com/${esc(p.github)}" target="_blank" rel="noopener" title="GitHub: ${esc(p.github)}">${esc(p.name)}</a>`
                      : p.link ? `<a href="${esc(p.link)}">${esc(p.name)}</a>` : esc(p.name)
                  }</div>
                  ${p.nameEn ? `<div class="person-name-en">${esc(p.nameEn)}</div>` : ""}
                  ${p.role ? `<div class="person-role">${esc(p.role)}</div>` : ""}
                  ${p.interests?.length ? `<div class="person-interests">${p.interests.map(esc).join(" · ")}</div>` : ""}
                  ${p.email ? `<div class="person-email"><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>` : ""}                </div>`
                )
                .join("")}
            </div>
          </section>`
          )
          .join("")}
      </div>`;
    },

    research() {
      return `
      <div class="container">
        <h1 class="page-title">Research</h1>
        ${projectRows(D.research)}
      </div>`;
    },

    publications() {
      const years = [...new Set(D.publications.map((p) => p.year))].sort((a, b) => b - a);
      const linkLabels = { pdf: "PDF", code: "Code", project: "Project", bibtex: "BibTeX", video: "Video" };
      return `
      <div class="container">
        <h1 class="page-title">Publications</h1>
        ${years.length ? "" : `<section><p class="empty">Publications will be listed here soon.</p></section>`}
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
  document.title = page === "index" ? `${D.lab.fullName}` : `${page[0].toUpperCase() + page.slice(1)} | ${D.lab.name}`;
})();
