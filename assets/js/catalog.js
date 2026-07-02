/* MC678 site — client-side catalog filter, search, nav, reveal. Vanilla JS, no deps. */
(function () {
  "use strict";

  /* ---- Sticky nav state + mobile toggle ---- */
  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var toggle = nav.querySelector(".nav__toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      nav.querySelectorAll(".nav__link, .nav__cta").forEach(function (a) {
        a.addEventListener("click", function () { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); });
      });
    }
  }

  /* ---- Scroll reveal ---- */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Catalog filtering ---- */
  var grid = document.getElementById("catalog-grid");
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".pcard"));
  var gradeChips = document.querySelectorAll("[data-filter-grade]");
  var strandChips = document.querySelectorAll("[data-filter-strand]");
  var searchInput = document.getElementById("catalog-search");
  var countEl = document.getElementById("catalog-count");
  var emptyEl = document.getElementById("catalog-empty");

  var state = { grade: "all", strand: "all", q: "" };

  function strandsForGrade(grade) {
    // Show only strand chips that exist within the active grade
    strandChips.forEach(function (chip) {
      var s = chip.getAttribute("data-filter-strand");
      if (s === "all") { chip.hidden = false; return; }
      if (grade === "all") { chip.hidden = false; return; }
      var exists = cards.some(function (c) {
        return c.getAttribute("data-grade") === grade && c.getAttribute("data-strand") === s;
      });
      chip.hidden = !exists;
    });
  }

  function apply() {
    var shown = 0;
    var q = state.q.trim().toLowerCase();
    cards.forEach(function (card) {
      var okGrade = state.grade === "all" || card.getAttribute("data-grade") === state.grade;
      var okStrand = state.strand === "all" || card.getAttribute("data-strand") === state.strand;
      var hay = card.getAttribute("data-search") || "";
      var okQ = !q || hay.indexOf(q) !== -1;
      var visible = okGrade && okStrand && okQ;
      card.classList.toggle("is-hidden", !visible);
      if (visible) shown++;
    });
    if (countEl) countEl.innerHTML = "<b>" + shown + "</b> " + (shown === 1 ? "sheet" : "sheets");
    if (emptyEl) emptyEl.classList.toggle("show", shown === 0);
  }

  gradeChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      gradeChips.forEach(function (c) { c.classList.remove("is-active"); c.setAttribute("aria-pressed", "false"); });
      chip.classList.add("is-active"); chip.setAttribute("aria-pressed", "true");
      state.grade = chip.getAttribute("data-filter-grade");
      // reset strand if it no longer applies
      strandsForGrade(state.grade);
      var activeStrandChip = document.querySelector("[data-filter-strand].is-active");
      if (activeStrandChip && activeStrandChip.hidden) {
        activeStrandChip.classList.remove("is-active");
        var allStrand = document.querySelector('[data-filter-strand="all"]');
        if (allStrand) { allStrand.classList.add("is-active"); state.strand = "all"; }
      }
      apply();
    });
  });

  strandChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      strandChips.forEach(function (c) { c.classList.remove("is-active"); c.setAttribute("aria-pressed", "false"); });
      chip.classList.add("is-active"); chip.setAttribute("aria-pressed", "true");
      state.strand = chip.getAttribute("data-filter-strand");
      apply();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", function () { state.q = searchInput.value; apply(); });
  }

  /* ---- Deep-link: ?grade=6 etc. ---- */
  var params = new URLSearchParams(window.location.search);
  var g = params.get("grade");
  if (g && ["6", "7", "8"].indexOf(g) !== -1) {
    var target = document.querySelector('[data-filter-grade="' + g + '"]');
    if (target) target.click();
  }

  strandsForGrade(state.grade);
  apply();
})();
