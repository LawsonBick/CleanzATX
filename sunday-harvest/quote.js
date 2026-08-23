/* ==========================================================================
   Sunday Harvest Co. — Quote Page Logic
   Real-time estimate + submission handling.
   ========================================================================== */

(function () {
  // Formsubmit.co delivers submissions to Kate's inbox with no signup.
  // First submission triggers a one-time activation email to Kate.
  const FORM_ENDPOINT = "https://formsubmit.co/ajax/katedurham46@gmail.com";
  const KATE_EMAIL    = "katedurham46@gmail.com";

  const BASE_PER_PERSON = 60;
  const HIGH_MULTIPLIER = 1.4;
  const CHARCUTERIE_FLAT = 150;

  const form = document.getElementById("quote-form");
  const guestInput = document.getElementById("guests");
  const eventTypeSelect = document.getElementById("event-type");
  const estimateRange = document.getElementById("estimate-range");
  const estimateNote = document.getElementById("estimate-note");
  const estimateRundown = document.getElementById("estimate-rundown");
  const smsFallback = document.getElementById("sms-fallback-link");
  const thanks = document.getElementById("thanks-overlay");
  const thanksMessage = document.getElementById("thanks-message");
  const calendarBtn = document.getElementById("add-to-calendar");
  const thanksClose = document.getElementById("thanks-close");

  function formatMoney(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  function computeEstimate() {
    const guests = parseInt(guestInput.value, 10);
    const eventType = eventTypeSelect.value;

    if (eventType === "Charcuterie Board") {
      estimateRange.textContent = formatMoney(CHARCUTERIE_FLAT);
      estimateNote.textContent = "Charcuterie boards are flat-rate. Final pricing confirmed by Kate after review.";
      estimateRundown.innerHTML = `
        <div>Charcuterie board <span>flat $150</span></div>
        <div>Includes cured meats, cheeses, seasonal fruit</div>
      `;
      return;
    }

    if (!guests || guests < 2) {
      estimateRange.textContent = "Add guests to see a range";
      estimateNote.textContent = "Estimates update as you fill in your guest count.";
      estimateRundown.innerHTML = `
        <div>Base rate <span>${formatMoney(BASE_PER_PERSON)} / person</span></div>
        <div>Minimum <span>2 guests</span></div>
        <div>Maximum <span>20 guests</span></div>
      `;
      return;
    }

    const safeGuests = Math.min(Math.max(guests, 2), 20);
    const low = BASE_PER_PERSON * safeGuests;
    const high = low * HIGH_MULTIPLIER;

    estimateRange.textContent = `${formatMoney(low)} – ${formatMoney(high)}`;
    estimateNote.textContent = "Final pricing confirmed by Kate after review.";
    estimateRundown.innerHTML = `
      <div>Guests <span>${safeGuests}</span></div>
      <div>Base rate <span>${formatMoney(BASE_PER_PERSON)} / person</span></div>
      <div>Range multiplier <span>1.0× – 1.4×</span></div>
    `;
  }

  function buildSmsFallback() {
    const name    = document.getElementById("name").value || "";
    const guests  = guestInput.value || "";
    const type    = eventTypeSelect.value || "";
    const date    = document.getElementById("event-date").value || "";
    const message = `Hi Kate! I'd like a quote. Name: ${name}. Event: ${type}. Date: ${date}. Guests: ${guests}.`;
    smsFallback.href = "sms:+18304468326?&body=" + encodeURIComponent(message);
  }

  function buildCalendarLink(formData) {
    const title = encodeURIComponent("Sunday Harvest Co. — " + (formData.get("event-type") || "Private Chef Event"));
    const rawDate = formData.get("event-date");
    let start = "", end = "";

    if (rawDate) {
      const d = rawDate.replace(/-/g, "");
      start = d + "T170000";
      end   = d + "T210000";
    }

    const details = encodeURIComponent(
      "Estimate requested via Sunday Harvest Co. Kate will text you at " +
      (formData.get("phone") || "") + " to confirm. Guests: " +
      (formData.get("guests") || "") + "."
    );
    const location = encodeURIComponent(formData.get("location") || "West Austin, TX");

    const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
    return `${base}&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
  }

  function showThanks(name, phone, formData) {
    thanksMessage.innerHTML = `
      Thank you, <strong>${escapeHtml(name || "friend")}</strong>!
      Kate will text you at <strong>${escapeHtml(phone || "your phone")}</strong>
      within 24 hours with your confirmed quote. Check your phone!
    `;
    if (formData.get("event-date")) {
      calendarBtn.href = buildCalendarLink(formData);
      calendarBtn.style.display = "inline-block";
    } else {
      calendarBtn.style.display = "none";
    }
    thanks.classList.add("is-open");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function buildMailtoFallback(formData) {
    const lines = [
      "New quote request from Sunday Harvest Co.",
      "",
      "Name: "     + (formData.get("name") || ""),
      "Phone: "    + (formData.get("phone") || ""),
      "Email: "    + (formData.get("email") || ""),
      "Event: "    + (formData.get("event-type") || ""),
      "Date: "     + (formData.get("event-date") || ""),
      "Location: " + (formData.get("location") || ""),
      "Guests: "   + (formData.get("guests") || ""),
      "Budget: "   + (formData.get("budget") || ""),
      "Dietary: "  + formData.getAll("dietary").join(", "),
      "Heard via: " + (formData.get("hear") || ""),
      "",
      "Notes:",
      (formData.get("notes") || "")
    ];
    const subject = "Quote request — " + (formData.get("name") || "New guest");
    return "mailto:" + KATE_EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    const formData = new FormData(form);
    const name = formData.get("name");
    const phone = formData.get("phone");

    formData.append("_subject", "New quote request — " + (name || "Sunday Harvest"));
    formData.append("_template", "table");
    formData.append("_captcha", "false");

    let delivered = false;
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" }
      });
      delivered = res.ok;
    } catch (err) {
      console.warn("Form POST failed, falling back to mailto.", err);
    }

    if (!delivered) {
      window.location.href = buildMailtoFallback(formData);
    }

    showThanks(name, phone, formData);
    submitBtn.disabled = false;
    submitBtn.textContent = "Send My Quote Request";
    form.reset();
    computeEstimate();
  }

  if (form) {
    form.addEventListener("submit", handleSubmit);
    [guestInput, eventTypeSelect].forEach(el => {
      el?.addEventListener("input", computeEstimate);
      el?.addEventListener("change", computeEstimate);
    });
    form.addEventListener("input", buildSmsFallback);

    computeEstimate();
    buildSmsFallback();
  }

  if (thanksClose) {
    thanksClose.addEventListener("click", () => thanks.classList.remove("is-open"));
  }
})();
