/* ==========================================================================
   Sunday Harvest Co. — Shared Components
   Injects navigation + footer + floating CTA so they're written once.
   ========================================================================== */

(function () {
  const NAV_ITEMS = [
    { href: "index.html",    label: "Home" },
    { href: "services.html", label: "Services" },
    { href: "about.html",    label: "About" },
    { href: "gallery.html",  label: "Gallery" },
    { href: "quote.html",    label: "Get a Quote" },
    { href: "contact.html",  label: "Contact" }
  ];

  const currentPage = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  function buildNav() {
    const mount = document.getElementById("site-nav");
    if (!mount) return;

    const links = NAV_ITEMS.map(item => {
      const isActive = currentPage === item.href.toLowerCase();
      return `<li><a href="${item.href}" class="${isActive ? "is-active" : ""}">${item.label}</a></li>`;
    }).join("");

    mount.innerHTML = `
      <nav class="nav" aria-label="Primary">
        <div class="nav-inner">
          <a href="index.html" class="nav-logo">Sunday Harvest <span>Co.</span></a>
          <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false">&#9776;</button>
          <ul class="nav-links" id="nav-links">
            ${links}
            <li><a href="quote.html" class="btn btn-primary nav-cta">Reserve Your Date</a></li>
          </ul>
        </div>
      </nav>
    `;

    const toggle = mount.querySelector(".nav-toggle");
    const linksEl = mount.querySelector("#nav-links");
    toggle?.addEventListener("click", () => {
      const isOpen = linksEl.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function buildFloatingCTA() {
    if (currentPage === "quote.html") return; // hide on quote page itself
    if (document.querySelector(".floating-cta")) return;
    const a = document.createElement("a");
    a.href = "quote.html";
    a.className = "floating-cta";
    a.setAttribute("aria-label", "Book Sunday Harvest Co.");
    a.textContent = "Book Now";
    document.body.appendChild(a);
  }

  function buildFooter() {
    const mount = document.getElementById("site-footer");
    if (!mount) return;

    const year = new Date().getFullYear();

    mount.innerHTML = `
      <footer>
        <div class="footer-grid">
          <div class="footer-brand">
            <h3>Sunday Harvest Co.</h3>
            <p>Clean eating, clean kitchen. Farm-to-table private chef &amp; event catering for West Austin.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul class="footer-links">
              <li><a href="index.html">Home</a></li>
              <li><a href="services.html">Services</a></li>
              <li><a href="about.html">About Chef Kate</a></li>
              <li><a href="gallery.html">Gallery</a></li>
              <li><a href="quote.html">Get a Quote</a></li>
              <li><a href="contact.html">Contact</a></li>
            </ul>
          </div>
          <div class="footer-contact">
            <h4>Gather With Us</h4>
            <p><a href="mailto:katedurham46@gmail.com">katedurham46@gmail.com</a></p>
            <p><a href="tel:8304468326">(830) 446-8326</a></p>
            <p>Serving West Austin &amp; surrounding areas<br>Within 30 miles of Lakeway, TX</p>
          </div>
        </div>
        <div class="footer-bottom">
          <span>&copy; ${year} Sunday Harvest Co. All rights reserved.</span>
          <span>Crafted with care in the Texas Hill Country.</span>
        </div>
      </footer>
    `;
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildNav();
    buildFooter();
    buildFloatingCTA();
  });
})();
