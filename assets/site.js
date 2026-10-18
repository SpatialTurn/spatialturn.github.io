/* SpatialTurn homepage: theme switch, hero map (contour draw, street lens, cursor coordinates) and a true scale bar. */
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

    /* street lens and coordinate readout follow the pointer */
    var frame = null;
    function move(e) {
      var cx = e.clientX, cy = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var p = toMap(cx, cy); if (!p) return;
        dot.setAttribute("cx", p.x.toFixed(0)); dot.setAttribute("cy", p.y.toFixed(0));
        var g = ll(p);
        if (readout) readout.textContent = "Cursor " + dms(g[0], "N", "S") + ", " + dms(g[1], "E", "W");
      });
    }
    function leave() {
      dot.setAttribute("cx", home[0]); dot.setAttribute("cy", home[1]);
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
      sb.parentNode.setAttribute("title", "Scale of the hero map at this window size");
    }
    function layout() { corners(); scalebar(); }
    layout();
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
  }).catch(function () { /* the static image stays in place */ });
})();
