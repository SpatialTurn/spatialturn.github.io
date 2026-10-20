/* SpatialTurn homepage: theme switch, hero map (contour draw, street lens, cursor coordinates), a true scale bar,
   and the "View by tool" switch (All modules, Python path, QGIS path) built from assets/paths.json. */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");

  /* ---------- theme switch (dark by default, choice remembered on this device only) ---------- */
  var btn = document.querySelector(".theme-toggle");
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    if (!btn) return;
    var next = t === "dark" ? "light" : "dark";
    btn.setAttribute("aria-pressed", t === "light" ? "true" : "false");
    btn.setAttribute("aria-label", "Switch to " + next + " theme");
    btn.querySelector(".theme-label").textContent = next === "light" ? "Light" : "Dark";
  }
  applyTheme(root.getAttribute("data-theme") === "light" ? "light" : "dark");
  if (btn) btn.addEventListener("click", function () {
    var t = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(t);
    try { localStorage.setItem("st-theme", t); } catch (e) {}
  });

  /* ---------- UTM (zone 16N, GRS80) to latitude and longitude ---------- */
  function utmToLatLon(E, N, zone) {
    var a = 6378137, f = 1 / 298.257222101, k0 = 0.9996;
    var e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    var x = E - 500000, M = N / k0;
    var mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
    var e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    var p = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
      + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
      + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu) + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
    var s = Math.sin(p), c = Math.cos(p), t = Math.tan(p);
    var N1 = a / Math.sqrt(1 - e2 * s * s), T1 = t * t, C1 = ep2 * c * c;
    var R1 = a * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5), D = x / (N1 * k0);
    var lat = p - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4) / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6) / 720);
    var lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / c;
    return [lat * 180 / Math.PI, (zone * 6 - 183) + lon * 180 / Math.PI];
  }
  function dms(v, pos, neg) {
    var h = v < 0 ? neg : pos; v = Math.abs(v);
    var d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
    if (s === 60) { s = 0; m += 1; } if (m === 60) { m = 0; d += 1; }
    return d + "°" + (m < 10 ? "0" : "") + m + "′" + (s < 10 ? "0" : "") + s + "″ " + h;
  }

  /* ---------- hero map ---------- */
  var holder = document.getElementById("hero-map");
  var readout = document.getElementById("cursor-readout");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!holder || !window.fetch || !window.DOMParser) return;

  fetch("assets/hero-map.svg").then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (txt) {
    var doc = new DOMParser().parseFromString(txt, "image/svg+xml");
    var svg = document.importNode(doc.documentElement, true);
    holder.replaceChild(svg, holder.querySelector("img"));
    var X0 = +svg.getAttribute("data-x0"), Y1 = +svg.getAttribute("data-y1"), ZONE = +svg.getAttribute("data-utm-zone");
    var dot = svg.querySelector("#lens-dot");
    var home = [+dot.getAttribute("cx"), +dot.getAttribute("cy")];
    var pt = svg.createSVGPoint();

    function toMap(cx, cy) {
      var m = svg.getScreenCTM(); if (!m) return null;
      pt.x = cx; pt.y = cy; return pt.matrixTransform(m.inverse());
    }
    function ll(p) { return utmToLatLon(X0 + p.x, Y1 - p.y, ZONE); }

    /* contours draw once, when the map first comes into view */
    if (!reduce) {
      var go = function () { holder.classList.add("drawn"); };
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { go(); io.disconnect(); } });
        io.observe(holder);
      } else go();
    } else holder.classList.add("drawn");

    /* coordinate readout follows the pointer; the street lens stays fixed on Purdue */
    var frame = null;
    function move(e) {
      var cx = e.clientX, cy = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var p = toMap(cx, cy); if (!p) return;
        /* Street lens follow-the-cursor is switched off for now (October 2026). To turn it back on, uncomment:
        dot.setAttribute("cx", p.x.toFixed(0)); dot.setAttribute("cy", p.y.toFixed(0)); */
        var g = ll(p);
        if (readout) readout.textContent = "Cursor " + dms(g[0], "N", "S") + ", " + dms(g[1], "E", "W");
      });
    }
    function leave() {
      /* dot.setAttribute("cx", home[0]); dot.setAttribute("cy", home[1]); (lens stays at Purdue) */
      if (readout) readout.textContent = "UTM zone 16N · NAD83";
    }
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerleave", leave);

    /* corner coordinates and true scale bar, recomputed when the layout changes */
    function corners() {
      var r = svg.getBoundingClientRect();
      var nw = toMap(r.left, r.top), ne = toMap(r.right, r.top), sw = toMap(r.left, r.bottom);
      if (!nw) return;
      var a = ll(nw), b = ll(ne), c = ll(sw);
      var set = function (id, t) { var el = document.getElementById(id); if (el) el.textContent = t; };
      set("corner-nw", dms(a[0], "N", "S") + ", " + dms(a[1], "E", "W"));
      set("corner-ne", dms(b[1], "E", "W"));
      set("corner-sw", dms(c[0], "N", "S"));
    }
    function scalebar() {
      var sb = document.getElementById("scalebar"); var m = svg.getScreenCTM();
      if (!sb || !m) return;
      var mPerPx = 1 / m.a, maxPx = 190, nice = [100, 200, 250, 500, 1000, 2000, 2500, 5000], len = nice[0];
      for (var i = 0; i < nice.length; i++) if (nice[i] / mPerPx <= maxPx) len = nice[i];
      var w = len / mPerPx, seg = w / 4, ns = "http://www.w3.org/2000/svg", out = [];
      for (var k = 0; k < 4; k++) out.push('<rect class="' + (k % 2 ? "sb-b" : "sb-a") + '" x="' + (k * seg).toFixed(1) + '" y="6" width="' + seg.toFixed(1) + '" height="7"/>');
      var lab = len >= 1000 ? (len / 1000) + " km" : len + " m";
      out.push('<text x="0" y="27">0</text><text x="' + w.toFixed(1) + '" y="27" text-anchor="end">' + lab + '</text>');
      sb.setAttribute("width", Math.ceil(w) + 2); sb.setAttribute("viewBox", "0 0 " + (Math.ceil(w) + 2) + " 30");
      sb.innerHTML = out.join("");
    }
    function layout() { corners(); scalebar(); }
    layout();
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
  }).catch(function () { /* the static image stays in place */ });
})();

/* ---------- View by tool: All modules / Python path / QGIS path ----------
   Episode data comes from assets/paths.json (written by SpatialTurn_build_scripts/utils/homepage_paths.py).
   In the Python and QGIS views a second switch lists the episodes by module or in a suggested order (numbered
   stages from paths.json "order"); every episode shows a level badge (B, I, A). Module and stage tiles span the
   full width in these views, with their episodes in two columns, so no tile is stretched to match another.
   The choice is kept in the address (#python, #qgis, #python-suggested, #qgis-suggested) so it can be shared,
   and remembered on this device only. */
(function () {
  "use strict";
  var sw = document.querySelector(".tool-switch");
  var list = document.querySelector(".modules");
  if (!sw || !list || !window.fetch) return;

  var VIEWS = ["all", "python", "qgis"];
  var LABEL = { python: "Python", qgis: "QGIS", theory: "Theory", both: "Py + QGIS" };
  var LEVEL = { B: "Beginner", I: "Intermediate", A: "Advanced" };
  var HERO = {
    all: { btn: "Start with Foundations", href: "https://spatialturn.github.io/Foundations/" },
    python: { btn: "Start with Python Basics", href: "https://spatialturn.github.io/Foundations/python-basics.html" },
    qgis: { btn: "Start with your first QGIS map", href: "https://spatialturn.github.io/Foundations/qgisintro.html" }
  };
  var LEDE = {
    python: "The Python path: every episode with a notebook, plus the shared theory episodes.",
    qgis: "The QGIS path: every desktop GIS exercise, including the Workshop 2026 Track A sessions, plus the shared theory episodes."
  };
  var title = document.getElementById("legend-title"), summary = document.getElementById("legend-summary");
  var key = document.querySelector(".tool-key"), lede = document.getElementById("lede"), start = document.getElementById("start-btn");
  var osw = document.querySelector(".order-switch"), stages = document.querySelector(".stages");
  var orig = { title: title.textContent, lede: lede ? lede.textContent : "" };
  var data = null, order = "module", current = "all", MODNAME = {};

  function fmt(m) { return m >= 60 ? Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) : "") : m + " min"; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function inPath(e, view) { return view === "all" || e.tag === "theory" || e.tag === "both" || e.tag === view; }
  function levels(eps) {
    var seen = {}; eps.forEach(function (e) { if (e.level) seen[e.level] = 1; });
    return "BIA".split("").filter(function (l) { return seen[l]; });
  }

  function epRow(e, withModule) {
    var item = el("li", e.tag), a = el("a");
    a.href = e.url; a.target = "_blank"; a.rel = "noopener";
    a.appendChild(el("span", "lvl lvl-" + e.level, e.level));
    var t = el("span", "ep-title", e.title);
    if (e.ws) t.appendChild(el("span", "ws-tag", e.ws));
    if (withModule) t.appendChild(el("span", "ep-mod", MODNAME[e.url]));
    a.appendChild(t);
    a.appendChild(el("span", "chip chip-" + e.tag, LABEL[e.tag]));
    a.appendChild(el("span", "ep-mins", fmt(e.mins)));
    a.setAttribute("aria-label", e.title + (e.ws ? ", " + e.ws : "") + (withModule ? ", " + MODNAME[e.url] : "") +
      ", " + LEVEL[e.level] + ", " + LABEL[e.tag] + ", " + fmt(e.mins));
    item.appendChild(a);
    return item;
  }

  function render(view) {
    var total = 0, mins = 0, shared = 0, all = 0;
    data.modules.forEach(function (m) {
      var li = list.querySelector('[data-module="' + m.repo + '"]'); if (!li) return;
      var desc = li.querySelector(".desc");
      if (!desc.hasAttribute("data-desc")) desc.setAttribute("data-desc", desc.textContent);
      var old = li.querySelectorAll(".chips, .eps"); for (var i = 0; i < old.length; i++) li.removeChild(old[i]);
      all += m.episodes.filter(function (e) { return !e.ws; }).length;
      if (view === "all") {
        desc.textContent = desc.getAttribute("data-desc");
        var counts = {};
        m.episodes.forEach(function (e) { counts[e.tag] = (counts[e.tag] || 0) + 1; });   /* workshop episodes count as QGIS */
        var chips = el("div", "chips");
        [["python", "Python"], ["qgis", "QGIS"], ["both", "Python + QGIS"], ["theory", "Theory"]].forEach(function (t) {
          if (counts[t[0]]) chips.appendChild(el("span", "chip chip-" + t[0], counts[t[0]] + " " + t[1]));
        });
        var lv = levels(m.episodes), box = el("span", "lvls");
        lv.forEach(function (l) { box.appendChild(el("span", "lvl lvl-" + l, l)); });
        box.setAttribute("role", "img");
        box.setAttribute("aria-label", "Levels: " + lv.map(function (l) { return LEVEL[l]; }).join(", "));
        chips.appendChild(box);
        li.appendChild(chips);
        return;
      }
      var eps = m.episodes.filter(function (e) { return inPath(e, view); });
      var sum = eps.reduce(function (s, e) { return s + e.mins; }, 0);
      total += eps.length; mins += sum; shared += eps.filter(function (e) { return e.tag === "theory"; }).length;
      var theoryOnly = eps.every(function (e) { return e.tag === "theory"; });
      desc.textContent = (theoryOnly ? "Theory for both paths · " : "") + eps.length +
        (eps.length === 1 ? " episode" : " episodes") + " · about " + fmt(sum);
      var ul = el("ul", "eps");
      eps.forEach(function (e) { ul.appendChild(epRow(e, false)); });
      li.appendChild(ul);
    });

    var sug = view !== "all" && order === "suggested" && data.order && data.order[view];
    list.classList.toggle("path-view", view !== "all");
    list.hidden = !!sug;
    if (stages) { stages.hidden = !sug; if (sug) renderStages(view); }
    if (osw) {
      osw.hidden = view === "all";
      var ob = osw.querySelectorAll("button");
      for (var k = 0; k < ob.length; k++) {
        var onk = ob[k].getAttribute("data-order") === order;
        ob[k].setAttribute("aria-checked", onk ? "true" : "false"); ob[k].tabIndex = onk ? 0 : -1;
      }
    }
    if (view === "all") {
      title.textContent = orig.title;
      summary.textContent = data.modules.length + " modules · " + all + " episodes";
      if (lede) lede.textContent = orig.lede;
    } else {
      title.textContent = (view === "python" ? "Python path" : "QGIS path") + (sug ? ": suggested order" : ": episodes by module");
      summary.textContent = total + " episodes · about " + Math.round(mins / 60) + " hours · " + shared + " shared theory episodes";
      if (lede) lede.textContent = LEDE[view];
    }
    key.hidden = false;
    var keys = key.querySelectorAll("li");
    for (var z = 0; z < keys.length; z++) {
      var c = keys[z].className;
      keys[z].hidden = c === "key-lvl" ? false : (view === "all" || (c === "key-ws" && view !== "qgis"));
    }
    if (start) { start.textContent = HERO[view].btn; start.href = HERO[view].href; }
    var bs = sw.querySelectorAll("button");
    for (var j = 0; j < bs.length; j++) {
      var on = bs[j].getAttribute("data-view") === view;
      bs[j].setAttribute("aria-checked", on ? "true" : "false");
      bs[j].tabIndex = on ? 0 : -1;
    }
  }

  /* Suggested order: numbered stages, each a full-width tile listing its episodes with their module */
  function renderStages(view) {
    var byUrl = {};
    data.modules.forEach(function (m) { m.episodes.forEach(function (e) { byUrl[e.url] = e; }); });
    stages.textContent = "";
    data.order[view].forEach(function (s, i) {
      var eps = s.eps.map(function (u) { return byUrl[u]; }).filter(Boolean);
      var sum = eps.reduce(function (a, e) { return a + e.mins; }, 0);
      var li = el("li"), head = el("div", "tilehead"), txt = el("span");
      head.appendChild(el("span", "num", String(i + 1)));
      txt.appendChild(el("b", null, s.stage));
      txt.appendChild(el("span", "desc", eps.length + (eps.length === 1 ? " episode" : " episodes") + " · about " + fmt(sum) +
        " · " + levels(eps).map(function (l) { return LEVEL[l]; }).join(" to ")));
      head.appendChild(txt); li.appendChild(head);
      var ul = el("ul", "eps");
      eps.forEach(function (e) { ul.appendChild(epRow(e, true)); });
      li.appendChild(ul); stages.appendChild(li);
    });
  }

  function setView(view, push) {
    current = view;
    render(view);
    try { localStorage.setItem("st-view", view); localStorage.setItem("st-order", order); } catch (e) {}
    if (push && window.history && history.replaceState) {
      history.replaceState(null, "", view === "all" ? location.pathname + location.search :
        "#" + view + (order === "suggested" ? "-suggested" : ""));
    }
  }

  function fromHash() {
    var h = location.hash.replace("#", "").split("-");
    if (VIEWS.indexOf(h[0]) > 0) { order = h[1] === "suggested" ? "suggested" : "module"; return h[0]; }
    return null;
  }

  function initial() {
    var h = fromHash(); if (h) return h;
    try {
      if (localStorage.getItem("st-order") === "suggested") order = "suggested";
      var v = localStorage.getItem("st-view"); if (VIEWS.indexOf(v) >= 0) return v;
    } catch (e) {}
    return "all";
  }

  function radioKeys(group, attr, onPick) {
    group.addEventListener("keydown", function (e) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) < 0) return;
      var bs = group.querySelectorAll("button"), cur = 0;
      for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute("aria-checked") === "true") cur = i;
      var next = (cur + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? bs.length - 1 : 1)) % bs.length;
      onPick(bs[next].getAttribute(attr)); bs[next].focus(); e.preventDefault();
    });
  }

  fetch("assets/paths.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
    data = d;
    var names = list.querySelectorAll("li[data-module]");
    for (var q = 0; q < names.length; q++) {
      var b = names[q].querySelector("b").cloneNode(true), x = b.querySelectorAll(".num, em");
      for (var y = 0; y < x.length; y++) x[y].parentNode.removeChild(x[y]);
      var repo = names[q].getAttribute("data-module"), nm = b.textContent.trim();
      data.modules.forEach(function (m) {
        if (m.repo === repo) m.episodes.forEach(function (e) { MODNAME[e.url] = e.ws ? "Workshop 2026" : nm; });
      });
    }
    sw.hidden = false;
    sw.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-view]"); if (b) setView(b.getAttribute("data-view"), true);
    });
    radioKeys(sw, "data-view", function (v) { setView(v, true); });
    if (osw) {
      osw.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-order]"); if (!b) return;
        order = b.getAttribute("data-order"); setView(current, true);
      });
      radioKeys(osw, "data-order", function (o) { order = o; setView(current, true); });
    }
    window.addEventListener("hashchange", function () { var h = fromHash(); if (h) setView(h, false); });
    setView(initial(), false);
  }).catch(function () { /* without the data file the page stays on the plain module legend */ });
})();
