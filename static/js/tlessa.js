// T-LESSA project page: navbar, zoomable figures, BibTeX copy, video gallery.

(function () {
  "use strict";

  const SPEC_NAME = { neg: "NEG", conj: "CONJ", order: "ORDER", templog: "TEMPLOG" };
  const SPEC_FORMULA = {
    neg: "◇A ∧ □¬B",
    conj: "◇A ∧ ◇B",
    order: "◇(A ∧ ◇(B ∧ ◇C))",
    templog: "◇(A ∧ ◇B) ∧ □¬C",
  };
  const SPEC_WORDS = {
    neg: "A appears and B never appears",
    conj: "A and B both appear",
    order: "A, then B, then C",
    templog: "A, then B, and C never appears",
  };
  const BACKBONES = ["Wan2.1-14B", "CogVideoX-5B", "VideoCrafter2", "AnimateDiff"];
  const SPECS = ["neg", "conj", "order", "templog"];
  const PAGE_SIZE = 6;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else node.setAttribute(k, v);
    }
    for (const child of children || []) {
      node.append(child);
    }
    return node;
  }

  // ---- Navbar burger (mobile) ----
  function initNavbar() {
    const burger = document.querySelector(".navbar-burger");
    const menu = document.querySelector(".navbar-menu");
    if (!burger || !menu) return;
    burger.addEventListener("click", () => {
      burger.classList.toggle("is-active");
      menu.classList.toggle("is-active");
      burger.setAttribute("aria-expanded", burger.classList.contains("is-active"));
    });
  }

  // ---- Zoomable figures (same behavior as the lab's other pages) ----
  function initZoom() {
    const overlay = el("div", { class: "zoom-overlay" });
    const big = el("img", { alt: "" });
    overlay.append(big);
    document.body.append(overlay);
    document.querySelectorAll(".zoomable-image").forEach((img) => {
      img.addEventListener("click", () => {
        big.src = img.getAttribute("data-highres") || img.src;
        big.alt = img.alt;
        overlay.classList.add("active");
      });
    });
    const close = () => {
      overlay.classList.remove("active");
      big.removeAttribute("src");
    };
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  // ---- BibTeX copy ----
  function initBibtex() {
    const btn = document.querySelector(".bibtex-copy");
    const code = document.querySelector("#bibtex-code");
    if (!btn || !code) return;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = "Copied";
      } catch (err) {
        btn.textContent = "Select and copy";
      }
      setTimeout(() => (btn.textContent = "Copy"), 1800);
    });
  }

  // ---- Gallery ----
  function promptNode(item) {
    const frag = el("div", { class: "g-prompt" });
    const spans = item.spans.slice().sort((a, b) => a[0] - b[0]);
    let pos = 0;
    for (const [start, end, sym, role] of spans) {
      if (start < pos) continue; // overlapping spans: keep the first
      frag.append(item.prompt.slice(pos, start));
      const cls = "ev " + (role === "never" ? "never c-never" : "c-" + sym);
      frag.append(
        el("span", { class: cls }, [item.prompt.slice(start, end), el("span", { class: "tag", text: sym })])
      );
      pos = end;
    }
    frag.append(item.prompt.slice(pos));
    return frag;
  }

  function specNode(item) {
    const node = el("div", { class: "g-spec" });
    const never = new Set(item.spans.filter((s) => s[3] === "never").map((s) => s[2]));
    node.append("Specification: ");
    for (const ch of SPEC_FORMULA[item.spec]) {
      if ("ABCD".includes(ch)) {
        node.append(el("span", { class: "sym " + (never.has(ch) ? "c-never" : "c-" + ch), text: ch }));
      } else {
        node.append(ch);
      }
    }
    node.append(el("span", { class: "g-seed", text: "  ·  " + SPEC_WORDS[item.spec] }));
    return node;
  }

  function cardNode(item) {
    const replay = el("button", { class: "g-replay", type: "button", text: "↻ Restart together" });
    const head = el("div", { class: "g-head" }, [
      el("span", { class: "g-badge", text: SPEC_NAME[item.spec] }),
      el("span", { class: "g-bb", text: item.bb }),
      el("span", { class: "g-seed", text: "seed " + item.seed }),
      replay,
    ]);
    const card = el("article", { class: "g-card" }, [head, promptNode(item), specNode(item)]);
    if (item.given) {
      card.append(
        el("details", { class: "g-given" }, [
          el("summary", { text: "Prompt as given to " + item.bb }),
          el("div", { text: item.given }),
        ])
      );
    }
    const clips = el("div", { class: "g-clips n" + item.arms.length });
    clips.style.setProperty("--n", item.arms.length);
    for (const [arm, label, src, poster] of item.arms) {
      const video = el("video", {
        muted: "",
        loop: "",
        playsinline: "",
        preload: "none",
        poster: poster,
        "data-src": src,
        "aria-label": label + " video for: " + item.prompt,
      });
      video.muted = true;
      clips.append(
        el("figure", { class: "g-clip" + (arm === "tlessa" ? " ours" : "") }, [
          el("figcaption", { text: arm === "unsteered" ? item.bb + " (unsteered)" : label }),
          video,
        ])
      );
    }
    card.append(clips);
    if (item.note) {
      card.append(el("div", { class: "g-note" }, [el("strong", { text: "What to look for: " }), item.note]));
    }
    replay.addEventListener("click", () => restart(card));
    return card;
  }

  function videosOf(card) {
    return Array.from(card.querySelectorAll("video"));
  }

  function restart(card) {
    for (const v of videosOf(card)) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  }

  // Load a card's clips when it scrolls near the viewport, start them together,
  // and pause them when it leaves.
  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const card = entry.target;
              const videos = videosOf(card);
              if (entry.isIntersecting) {
                if (!card.dataset.loaded) {
                  card.dataset.loaded = "1";
                  const ready = videos.map(
                    (v) =>
                      new Promise((resolve) => {
                        v.addEventListener("canplay", resolve, { once: true });
                        v.addEventListener("error", resolve, { once: true });
                        v.src = v.dataset.src;
                        v.load();
                      })
                  );
                  Promise.all(ready).then(() => restart(card));
                } else {
                  videos.forEach((v) => v.play().catch(() => {}));
                }
              } else {
                videos.forEach((v) => v.pause());
              }
            }
          },
          { rootMargin: "200px 0px" }
        )
      : null;

  function initGallery() {
    const root = document.getElementById("gallery");
    const data = window.TLESSA_GALLERY;
    if (!root || !data) return;

    const state = { view: "selected", spec: "all", bb: "all", shown: PAGE_SIZE };
    const about = root.querySelector(".g-about");
    const filters = root.querySelector(".g-filters");
    const list = root.querySelector(".g-list");
    const more = root.querySelector(".g-more button");
    const tabs = Array.from(root.querySelectorAll(".g-tab"));

    function matches(item, spec, bb) {
      return (spec === "all" || item.spec === spec) && (bb === "all" || item.bb === bb);
    }

    function pillRow(label, key, values, names) {
      const row = el("div", { class: "g-filter-row", role: "group", "aria-label": label }, [
        el("span", { class: "g-row-label", text: label }),
      ]);
      for (const value of ["all"].concat(values)) {
        const n = data[state.view].filter((it) =>
          key === "spec" ? matches(it, value, state.bb) : matches(it, state.spec, value)
        ).length;
        const pill = el("button", {
          class: "g-pill",
          type: "button",
          "aria-pressed": String(state[key] === value),
        }, [value === "all" ? "All" : names[value] || value, el("span", { class: "count", text: n })]);
        pill.addEventListener("click", () => {
          state[key] = value;
          state.shown = PAGE_SIZE;
          render();
        });
        row.append(pill);
      }
      return row;
    }

    function render() {
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === state.view)));
      about.querySelectorAll("[data-view]").forEach((p) => (p.hidden = p.dataset.view !== state.view));

      filters.replaceChildren(
        pillRow("Class", "spec", SPECS, SPEC_NAME),
        pillRow("Backbone", "bb", BACKBONES, {})
      );

      if (observer) list.querySelectorAll(".g-card").forEach((c) => observer.unobserve(c));
      list.querySelectorAll("video").forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.load();
      });

      const items = data[state.view].filter((it) => matches(it, state.spec, state.bb));
      const visible = items.slice(0, state.shown);
      list.replaceChildren(...visible.map(cardNode));
      if (!visible.length) {
        list.append(el("p", { class: "g-empty", text: "No clips for this combination in this set." }));
      }
      list.querySelectorAll(".g-card").forEach((c) => {
        if (observer) observer.observe(c);
        else c.querySelectorAll("video").forEach((v) => (v.src = v.dataset.src));
      });

      const remaining = items.length - visible.length;
      more.parentElement.hidden = remaining <= 0;
      more.textContent = "Show " + Math.min(PAGE_SIZE, remaining) + " more (" + remaining + " left)";
    }

    tabs.forEach((t) =>
      t.addEventListener("click", () => {
        state.view = t.dataset.view;
        state.spec = "all";
        state.bb = "all";
        state.shown = PAGE_SIZE;
        render();
      })
    );

    more.addEventListener("click", () => {
      const before = list.querySelectorAll(".g-card").length;
      state.shown += PAGE_SIZE;
      const items = data[state.view].filter((it) => matches(it, state.spec, state.bb));
      const added = items.slice(before, state.shown).map(cardNode);
      list.append(...added);
      added.forEach((c) => {
        if (observer) observer.observe(c);
        else c.querySelectorAll("video").forEach((v) => (v.src = v.dataset.src));
      });
      const remaining = items.length - Math.min(state.shown, items.length);
      more.parentElement.hidden = remaining <= 0;
      more.textContent = "Show " + Math.min(PAGE_SIZE, remaining) + " more (" + remaining + " left)";
    });

    render();
  }

  function initMath() {
    if (typeof renderMathInElement !== "function") return;
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavbar();
    initZoom();
    initBibtex();
    initGallery();
    initMath();
  });
})();
