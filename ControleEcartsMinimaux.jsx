//@target illustrator
/*
 * ControleEcartsMinimaux.jsx — v1.0.0
 * Contrôle des écarts minimaux et des parties trop fines / Minimum gap & thin-feature checker
 *
 * FR : Mesure la géométrie réelle des tracés (courbes de Bézier comprises) et repère
 *      les endroits où deux contours sont plus proches qu'un écart minimal : espaces
 *      trop étroits entre objets, et parties trop fines (ou encoches trop étroites)
 *      d'une même forme. Utile pour la découpe laser, le vinyle, le pochoir, la dorure,
 *      le gaufrage, la sérigraphie, la broderie et le marquage. Les zones fautives sont
 *      entourées sur un calque de repères non imprimable ; l'illustration n'est jamais modifiée.
 * EN : Measures the actual path geometry (Bézier curves included) and flags every place
 *      where two outlines are closer than a minimum gap: gaps that are too narrow between
 *      objects, and parts (or notches) of a single shape that are too thin. Useful for laser
 *      cutting, vinyl, stencils, foil, embossing, screen printing, embroidery and engraving.
 *      Problem areas are circled on a non-printing marker layer; artwork is never modified.
 *
 * Auteur / Author : Amirouche Amwanes — Licence MIT / MIT License
 * Cible / Target : Adobe Illustrator CC 2018+ (ExtendScript ES3). Non testé dans Illustrator.
 * Aucun appel réseau, aucune collecte de données. / No network calls, no data collection.
 */

/* ===================================================================== */
/*  1. CŒUR GÉOMÉTRIQUE (pur, sans Illustrator) / PURE GEOMETRY CORE      */
/* ===================================================================== */

var EM_CORE = (function () {

    // Distance d'un point à une droite (pour la planéité des courbes)
    // Distance from a point to a line (curve flatness)
    function distToLine(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
        if (L < 1e-12) { dx = px - ax; dy = py - ay; return Math.sqrt(dx * dx + dy * dy); }
        return Math.abs((px - ax) * dy - (py - ay) * dx) / L;
    }

    function len(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }

    // Point d'une cubique de Bézier / Point on a cubic Bézier
    function bez(p0, p1, p2, p3, t) {
        var u = 1 - t;
        return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    }

    /*
     * Aplatit un contour en polyligne avec abscisse curviligne.
     * Flattens a contour into a polyline with arc length.
     * pts : [[ax, ay, lx, ly, rx, ry], ...] (ancre, poignée gauche, poignée droite)
     * Retour / returns : { xs:[], ys:[], ss:[], total:Number }
     */
    function flatten(pts, closed, maxLen, flatTol) {
        var xs = [], ys = [], ss = [], s = 0, n = pts.length, i, segs;
        if (n < 2) return null;
        xs.push(pts[0][0]); ys.push(pts[0][1]); ss.push(0);
        segs = closed ? n : n - 1;
        for (i = 0; i < segs; i++) {
            var A = pts[i], B = pts[(i + 1) % n];
            var x0 = A[0], y0 = A[1], x1 = A[4], y1 = A[5], x2 = B[2], y2 = B[3], x3 = B[0], y3 = B[1];
            var poly = len(x0, y0, x1, y1) + len(x1, y1, x2, y2) + len(x2, y2, x3, y3);
            var dev = Math.max(distToLine(x1, y1, x0, y0, x3, y3), distToLine(x2, y2, x0, y0, x3, y3));
            var k = Math.ceil(poly / maxLen);
            if (dev > 1e-9) k = Math.max(k, Math.ceil(Math.sqrt(dev / flatTol)));
            if (k < 1) k = 1;
            if (k > 400) k = 400;
            var px = x0, py = y0, j;
            for (j = 1; j <= k; j++) {
                var t = j / k, qx, qy;
                if (dev <= 1e-9) { qx = x0 + (x3 - x0) * t; qy = y0 + (y3 - y0) * t; }
                else { qx = bez(x0, x1, x2, x3, t); qy = bez(y0, y1, y2, y3, t); }
                s += len(px, py, qx, qy);
                xs.push(qx); ys.push(qy); ss.push(s);
                px = qx; py = qy;
            }
        }
        return { xs: xs, ys: ys, ss: ss, total: s };
    }

    // Point le plus proche sur [a,b] depuis p / Closest point on [a,b] from p
    function closestOnSeg(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = 0;
        if (L2 > 1e-18) { t = ((px - ax) * dx + (py - ay) * dy) / L2; if (t < 0) t = 0; else if (t > 1) t = 1; }
        var cx = ax + dx * t, cy = ay + dy * t, ex = px - cx, ey = py - cy;
        return { t: t, x: cx, y: cy, d: Math.sqrt(ex * ex + ey * ey) };
    }

    /*
     * Distance minimale entre deux segments + points/paramètres les plus proches.
     * Minimum distance between two segments + closest points/parameters.
     */
    function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
        // Intersection propre / proper intersection
        var r1x = bx - ax, r1y = by - ay, r2x = dx - cx, r2y = dy - cy;
        var den = r1x * r2y - r1y * r2x;
        if (Math.abs(den) > 1e-18) {
            var ta = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
            var tb = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
            if (ta >= 0 && ta <= 1 && tb >= 0 && tb <= 1) {
                var ix = ax + r1x * ta, iy = ay + r1y * ta;
                return { d: 0, ta: ta, tb: tb, x1: ix, y1: iy, x2: ix, y2: iy };
            }
        }
        var best = null, c;
        c = closestOnSeg(ax, ay, cx, cy, dx, dy); best = { d: c.d, ta: 0, tb: c.t, x1: ax, y1: ay, x2: c.x, y2: c.y };
        c = closestOnSeg(bx, by, cx, cy, dx, dy); if (c.d < best.d) best = { d: c.d, ta: 1, tb: c.t, x1: bx, y1: by, x2: c.x, y2: c.y };
        c = closestOnSeg(cx, cy, ax, ay, bx, by); if (c.d < best.d) best = { d: c.d, ta: c.t, tb: 0, x1: c.x, y1: c.y, x2: cx, y2: cy };
        c = closestOnSeg(dx, dy, ax, ay, bx, by); if (c.d < best.d) best = { d: c.d, ta: c.t, tb: 1, x1: c.x, y1: c.y, x2: dx, y2: dy };
        return best;
    }

    // Union-Find
    function uf(n) { var p = [], i; for (i = 0; i < n; i++) p.push(i); return p; }
    function ufFind(p, a) { while (p[a] !== a) { p[a] = p[p[a]]; a = p[a]; } return a; }
    function ufUnion(p, a, b) { a = ufFind(p, a); b = ufFind(p, b); if (a !== b) p[b] = a; }

    /*
     * Analyse principale / Main analysis.
     * contours : [{ pts:[[ax,ay,lx,ly,rx,ry],...], closed:Boolean, obj:Number, sw:Number }]
     * opts : { t: écart minimal en pt / min gap (pt),
     *          useStroke: tenir compte des contours / account for stroke width,
     *          ignoreTouching: ignorer les contours qui se touchent ou se croisent / skip touching pairs,
     *          selfCheck: parties fines d'un même contour / thin parts within one outline,
     *          betweenCheck: écarts entre contours différents / gaps between different outlines,
     *          arcFactor: (défaut 2) }
     * Retour : { clusters:[...], pieces:N, tests:N, contactsSkipped:N, truncated:Boolean }
     */
    function analyze(contours, opts) {
        var T = opts.t, arcF = opts.arcFactor || 2;
        var maxSW = 0, ci, i, j;
        var maxLen = Math.max(T * 0.5, 0.05);
        var flatTol = Math.max(T / 25, 0.005);
        var EPS = Math.max(T * 1e-4, 1e-4);

        // Morceaux de polyligne / polyline pieces
        var X1 = [], Y1 = [], X2 = [], Y2 = [], S1 = [], S2 = [], PC = [];
        var cInfo = [];
        for (ci = 0; ci < contours.length; ci++) {
            var C = contours[ci];
            var sw = opts.useStroke ? (C.sw || 0) : 0;
            if (sw > maxSW) maxSW = sw;
            var f = flatten(C.pts, C.closed, maxLen, flatTol);
            var info = { total: f ? f.total : 0, closed: !!C.closed, obj: C.obj, sw: sw, l: 0, r: 0, t: 0, b: 0, selfHit: false };
            cInfo.push(info);
            if (!f) continue;
            info.l = info.r = f.xs[0]; info.t = info.b = f.ys[0];
            for (i = 1; i < f.xs.length; i++) {
                if (f.xs[i] < info.l) info.l = f.xs[i]; if (f.xs[i] > info.r) info.r = f.xs[i];
                if (f.ys[i] > info.t) info.t = f.ys[i]; if (f.ys[i] < info.b) info.b = f.ys[i];
            }
            for (i = 0; i + 1 < f.xs.length; i++) {
                if (f.ss[i + 1] - f.ss[i] < 1e-12) continue;
                X1.push(f.xs[i]); Y1.push(f.ys[i]); X2.push(f.xs[i + 1]); Y2.push(f.ys[i + 1]);
                S1.push(f.ss[i]); S2.push(f.ss[i + 1]); PC.push(ci);
            }
        }
        var N = X1.length;
        var R = T + maxSW;              // rayon de recherche / search radius
        var cell = Math.max(R, maxLen) * 2;
        var grid = {}, key, gx, gy;

        function cellsOf(k, pad, cb) {
            var x0 = Math.floor((Math.min(X1[k], X2[k]) - pad) / cell), x1 = Math.floor((Math.max(X1[k], X2[k]) + pad) / cell);
            var y0 = Math.floor((Math.min(Y1[k], Y2[k]) - pad) / cell), y1 = Math.floor((Math.max(Y1[k], Y2[k]) + pad) / cell);
            for (gx = x0; gx <= x1; gx++) for (gy = y0; gy <= y1; gy++) cb(gx + "_" + gy);
        }
        for (i = 0; i < N; i++) {
            (function (k) { cellsOf(k, 0, function (kk) { if (!grid[kk]) grid[kk] = []; grid[kk].push(k); }); })(i);
        }

        var stamp = []; for (i = 0; i < N; i++) stamp.push(-1);
        var touching = {};               // paires de contours en contact / contour pairs in contact
        var V = [];                      // violations
        var tests = 0, LIMIT = 300000, truncated = false;

        for (i = 0; i < N && !truncated; i++) {
            var cand = [];
            (function (k) {
                cellsOf(k, R, function (kk) {
                    var L = grid[kk], m;
                    if (!L) return;
                    for (m = 0; m < L.length; m++) {
                        var q = L[m];
                        if (q > k && stamp[q] !== k) { stamp[q] = k; cand.push(q); }
                    }
                });
            })(i);
            for (j = 0; j < cand.length; j++) {
                var q2 = cand[j], ca = PC[i], cb = PC[q2];
                var same = (ca === cb);
                if (same && !opts.selfCheck) continue;
                if (!same && opts.betweenCheck === false) continue;
                // Rejet rapide par boîtes / quick bbox reject
                if (Math.min(X1[q2], X2[q2]) > Math.max(X1[i], X2[i]) + R || Math.max(X1[q2], X2[q2]) < Math.min(X1[i], X2[i]) - R ||
                    Math.min(Y1[q2], Y2[q2]) > Math.max(Y1[i], Y2[i]) + R || Math.max(Y1[q2], Y2[q2]) < Math.min(Y1[i], Y2[i]) - R) continue;
                tests++;
                var r = segSeg(X1[i], Y1[i], X2[i], Y2[i], X1[q2], Y1[q2], X2[q2], Y2[q2]);
                var swSum = (cInfo[ca].sw + cInfo[cb].sw) / 2;
                var limit = T + swSum;
                if (r.d >= limit) continue;
                if (same) {
                    var sa = S1[i] + (S2[i] - S1[i]) * r.ta, sb = S1[q2] + (S2[q2] - S1[q2]) * r.tb;
                    var da = Math.abs(sa - sb);
                    if (cInfo[ca].closed) da = Math.min(da, cInfo[ca].total - da);
                    // Voisins le long du contour : pas une partie fine / neighbours along the outline
                    if (da <= arcF * limit) continue;
                    if (r.d < EPS) continue; // auto-intersection / self-intersection
                } else {
                    var pk = ca < cb ? ca + "|" + cb : cb + "|" + ca;
                    if (r.d < EPS) { touching[pk] = true; continue; }
                }
                if (same) cInfo[ca].selfHit = true;
                V.push({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, g: r.d - swSum, ca: ca, cb: cb });
                if (V.length > LIMIT) { truncated = true; break; }
            }
        }

        // Îlots (ou trous) fermés plus petits que l'écart : trop courts pour le critère le long du contour.
        // Closed islands (or holes) smaller than the gap: too short for the along-outline criterion.
        if (opts.selfCheck) {
            for (ci = 0; ci < cInfo.length; ci++) {
                var ic = cInfo[ci];
                if (!ic.closed || ic.selfHit || ic.total <= 0) continue;
                var bw = ic.r - ic.l, bh = ic.t - ic.b, lim2 = T + ic.sw, cxm = (ic.l + ic.r) / 2, cym = (ic.t + ic.b) / 2;
                if (Math.min(bw, bh) >= lim2) continue;
                if (bw <= bh) V.push({ x1: ic.l, y1: cym, x2: ic.r, y2: cym, g: bw - ic.sw, ca: ci, cb: ci });
                else V.push({ x1: cxm, y1: ic.b, x2: cxm, y2: ic.t, g: bh - ic.sw, ca: ci, cb: ci });
            }
        }

        // Filtre des contacts / contact filter
        var W = [], skipped = 0;
        for (i = 0; i < V.length; i++) {
            var v = V[i];
            if (v.ca !== v.cb && opts.ignoreTouching) {
                var pk2 = v.ca < v.cb ? v.ca + "|" + v.cb : v.cb + "|" + v.ca;
                if (touching[pk2]) { skipped++; continue; }
            }
            v.mx = (v.x1 + v.x2) / 2; v.my = (v.y1 + v.y2) / 2;
            W.push(v);
        }

        // Regroupement en zones (union-find sur une grille) / clustering into zones
        var JOIN = Math.max(T * 2, 1);
        var g2 = {}, P = uf(W.length);
        for (i = 0; i < W.length; i++) {
            var kx = Math.floor(W[i].mx / JOIN), ky = Math.floor(W[i].my / JOIN), a, b;
            for (a = kx - 1; a <= kx + 1; a++) for (b = ky - 1; b <= ky + 1; b++) {
                var L2 = g2[a + "_" + b];
                if (!L2) continue;
                for (j = 0; j < L2.length; j++) {
                    var w = W[L2[j]];
                    if (Math.abs(w.mx - W[i].mx) <= JOIN && Math.abs(w.my - W[i].my) <= JOIN) ufUnion(P, L2[j], i);
                }
            }
            key = kx + "_" + ky; if (!g2[key]) g2[key] = []; g2[key].push(i);
        }
        var roots = {}, clusters = [];
        for (i = 0; i < W.length; i++) {
            var rt = ufFind(P, i), z = roots[rt];
            var wv = W[i];
            if (z === undefined) {
                z = clusters.length; roots[rt] = z;
                clusters.push({ minGap: wv.g, x1: wv.x1, y1: wv.y1, x2: wv.x2, y2: wv.y2,
                    left: wv.mx, right: wv.mx, top: wv.my, bottom: wv.my, objs: {}, self: false, between: false, count: 0 });
            }
            var cl = clusters[z];
            cl.count++;
            if (wv.g < cl.minGap) { cl.minGap = wv.g; cl.x1 = wv.x1; cl.y1 = wv.y1; cl.x2 = wv.x2; cl.y2 = wv.y2; }
            var xs = [wv.x1, wv.x2], ys = [wv.y1, wv.y2], h;
            for (h = 0; h < 2; h++) {
                if (xs[h] < cl.left) cl.left = xs[h]; if (xs[h] > cl.right) cl.right = xs[h];
                if (ys[h] > cl.top) cl.top = ys[h]; if (ys[h] < cl.bottom) cl.bottom = ys[h];
            }
            cl.objs[cInfo[wv.ca].obj] = true; cl.objs[cInfo[wv.cb].obj] = true;
            if (wv.ca === wv.cb) cl.self = true; else cl.between = true;
        }
        clusters.sort(function (p, q) { return p.minGap - q.minGap; });
        return { clusters: clusters, pieces: N, tests: tests, contactsSkipped: skipped, truncated: truncated };
    }

    // Conversion d'unités / unit conversion (vers points / to points)
    var UNITS = { mm: 72 / 25.4, cm: 72 / 2.54, pt: 1, px: 1, "in": 72 };
    function toPt(v, u) { return v * (UNITS[u] || 1); }
    function fromPt(v, u) { return v / (UNITS[u] || 1); }
    function fmt(v, u) {
        var x = fromPt(v, u), d = (u === "pt" || u === "px") ? 2 : 3;
        if (x < 0) x = 0;
        var s = x.toFixed(d);
        s = s.replace(/0+$/, "").replace(/\.$/, "");
        return s + " " + u;
    }

    return { flatten: flatten, segSeg: segSeg, analyze: analyze, toPt: toPt, fromPt: fromPt, fmt: fmt };
})();

/* ===================================================================== */
/*  2. PARTIE ILLUSTRATOR / ILLUSTRATOR PART                             */
/* ===================================================================== */

var EM_LAYER = "Contrôle écarts minimaux";

function EM_isFr() {
    var loc = "";
    try { loc = String(app.locale || $.locale || ""); } catch (e) { loc = ""; }
    return loc.toLowerCase().indexOf("fr") === 0;
}

var EM_T = EM_isFr() ? {
    title: "Contrôle des écarts minimaux v1.0.0",
    noDoc: "Aucun document ouvert. Ouvrez un document puis relancez le script.",
    noSel: "Rien n'est sélectionné. Sélectionnez des objets ou choisissez une autre portée.",
    gap: "Écart minimal :", scope: "Portée", sSel: "Sélection", sArt: "Plan de travail actif", sDoc: "Document entier",
    checks: "Contrôles", cBetween: "Écarts entre objets ou contours trop étroits",
    cSelf: "Parties fines et encoches trop étroites d'une même forme",
    oStroke: "Tenir compte de l'épaisseur des contours (traits)",
    oTouch: "Ignorer les objets qui se touchent ou se chevauchent",
    oClip: "Ignorer les tracés de masque d'écrêtage",
    oLabel: "Afficher la distance mesurée sur chaque repère",
    oSelObj: "Après marquage, sélectionner les objets concernés (sinon les repères)",
    analyze: "Analyser", mark: "Marquer les zones", clear: "Effacer les repères", cancel: "Annuler",
    tip: "Conseil : travaillez sur une copie. L'illustration n'est jamais modifiée ; seuls des repères sont ajoutés sur un calque non imprimable.",
    ready: "Réglez l'écart puis cliquez sur Analyser.",
    badNum: "Entrez un écart minimal supérieur à 0.",
    res: "{z} zone(s) trop étroite(s). Écart le plus petit : {m}. Tracés analysés : {p}.",
    resNone: "Aucune zone sous {t}. Tracés analysés : {p}.",
    skipped: "Non analysés (texte, images, symboles, maillages…) : {n}. Vectorisez une copie pour les contrôler.",
    contacts: "Contacts ignorés : {n}.", trunc: "Analyse interrompue : trop de résultats, augmentez l'écart ou réduisez la portée.",
    many: "Seules les {n} zones les plus critiques ont été marquées.",
    done: "{z} zone(s) marquée(s) sur le calque « {l} ».\nÉcart le plus petit : {m}.",
    cleared: "Calque de repères supprimé.", noLayer: "Aucun calque de repères à supprimer.",
    zone: "Écart", thin: "fin", working: "Analyse en cours…"
} : {
    title: "Minimum gap checker v1.0.0",
    noDoc: "No document is open. Open a document and run the script again.",
    noSel: "Nothing is selected. Select objects or choose another scope.",
    gap: "Minimum gap:", scope: "Scope", sSel: "Selection", sArt: "Active artboard", sDoc: "Whole document",
    checks: "Checks", cBetween: "Gaps between objects or outlines that are too narrow",
    cSelf: "Thin parts and narrow notches within one shape",
    oStroke: "Account for stroke width",
    oTouch: "Ignore objects that touch or overlap",
    oClip: "Ignore clipping paths",
    oLabel: "Show the measured distance on each marker",
    oSelObj: "After marking, select the affected objects (otherwise the markers)",
    analyze: "Analyze", mark: "Mark zones", clear: "Clear markers", cancel: "Cancel",
    tip: "Tip: work on a copy. Artwork is never modified; only markers are added on a non-printing layer.",
    ready: "Set the gap, then click Analyze.",
    badNum: "Enter a minimum gap greater than 0.",
    res: "{z} zone(s) too narrow. Smallest gap: {m}. Paths analyzed: {p}.",
    resNone: "No zone under {t}. Paths analyzed: {p}.",
    skipped: "Not analyzed (text, images, symbols, meshes…): {n}. Outline a copy to check them.",
    contacts: "Contacts ignored: {n}.", trunc: "Analysis stopped: too many results, raise the gap or narrow the scope.",
    many: "Only the {n} most critical zones were marked.",
    done: "{z} zone(s) marked on layer \"{l}\".\nSmallest gap: {m}.",
    cleared: "Marker layer removed.", noLayer: "No marker layer to remove.",
    zone: "Gap", thin: "thin", working: "Analyzing…"
};

function EM_fill(s, o) { var k; for (k in o) s = s.split("{" + k + "}").join(o[k]); return s; }

/* Réglages mémorisés (fichier local) / remembered settings (local file) */
function EM_cfgFile() { return new File(Folder.userData + "/ControleEcartsMinimaux.cfg"); }
function EM_loadCfg() {
    var c = { gap: "1", unit: "mm", scope: "doc", between: "1", self: "1", stroke: "1", touch: "1", clip: "1", label: "1", selobj: "0" };
    try {
        var f = EM_cfgFile();
        if (f.exists && f.open("r")) {
            while (!f.eof) { var ln = f.readln(), p = ln.indexOf("="); if (p > 0) c[ln.substring(0, p)] = ln.substring(p + 1); }
            f.close();
        }
    } catch (e) {}
    return c;
}
function EM_saveCfg(c) {
    try { var f = EM_cfgFile(), k; if (f.open("w")) { for (k in c) f.writeln(k + "=" + c[k]); f.close(); } } catch (e) {}
}

/* Collecte des tracés / path collection */
function EM_collect(doc, scope, opt) {
    var out = { contours: [], items: [], skipped: 0, paths: 0 };
    var abRect = null;
    if (scope === "art") abRect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;

    function inArtboard(it) {
        if (!abRect) return true;
        var b = it.geometricBounds; // [left, top, right, bottom]
        return !(b[2] < abRect[0] || b[0] > abRect[2] || b[1] < abRect[3] || b[3] > abRect[1]);
    }
    function addPath(p, objId) {
        try {
            if (p.guides) return;
            if (opt.clip && p.clipping) return;
            if (!p.filled && !p.stroked && !p.clipping) return;
            var pp = p.pathPoints, n = pp.length, pts = [], i;
            if (n < 2) return;
            for (i = 0; i < n; i++) {
                var q = pp[i];
                pts.push([q.anchor[0], q.anchor[1], q.leftDirection[0], q.leftDirection[1], q.rightDirection[0], q.rightDirection[1]]);
            }
            out.contours.push({ pts: pts, closed: p.closed, obj: objId, sw: p.stroked ? p.strokeWidth : 0 });
            out.paths++;
        } catch (e) { out.skipped++; }
    }
    function visit(it, ignoreLocks) {
        if (!ignoreLocks && (it.locked || it.hidden)) return;
        var ty = it.typename;
        if (ty === "GroupItem") {
            var k; for (k = 0; k < it.pageItems.length; k++) visit(it.pageItems[k], ignoreLocks);
        } else if (ty === "CompoundPathItem") {
            if (!inArtboard(it)) return;
            var id = out.items.length; out.items.push(it);
            var m; for (m = 0; m < it.pathItems.length; m++) addPath(it.pathItems[m], id);
        } else if (ty === "PathItem") {
            if (!inArtboard(it)) return;
            var id2 = out.items.length; out.items.push(it); addPath(it, id2);
        } else {
            if (inArtboard(it)) out.skipped++;
        }
    }
    function visitLayer(L) {
        if (!L.visible || L.locked || L.name === EM_LAYER) return;
        var i; for (i = 0; i < L.pageItems.length; i++) visit(L.pageItems[i], false);
        for (i = 0; i < L.layers.length; i++) visitLayer(L.layers[i]);
    }
    if (scope === "sel") {
        var s = doc.selection, i2;
        for (i2 = 0; i2 < s.length; i2++) {
            var it = s[i2];
            // Sous-tracé d'un tracé composé sélectionné à la flèche blanche / direct-selected compound sub-path
            if (it.typename === "PathItem" && it.parent && it.parent.typename === "CompoundPathItem") it = it.parent;
            if (it.layer && it.layer.name === EM_LAYER) continue;
            visit(it, true);
        }
    } else {
        var j; for (j = 0; j < doc.layers.length; j++) visitLayer(doc.layers[j]);
    }
    return out;
}

function EM_red(doc) {
    if (doc.documentColorSpace === DocumentColorSpace.CMYK) {
        var c = new CMYKColor(); c.cyan = 0; c.magenta = 100; c.yellow = 100; c.black = 0; return c;
    }
    var r = new RGBColor(); r.red = 255; r.green = 0; r.blue = 0; return r;
}

function EM_findLayer(doc) {
    var i; for (i = 0; i < doc.layers.length; i++) if (doc.layers[i].name === EM_LAYER) return doc.layers[i];
    return null;
}
function EM_clear(doc) {
    var L = EM_findLayer(doc);
    if (!L) return false;
    L.locked = false; L.visible = true; L.remove();
    return true;
}

function EM_mark(doc, res, st, collected) {
    EM_clear(doc);
    var L = doc.layers.add();
    L.name = EM_LAYER;
    L.zOrder(ZOrderMethod.BRINGTOFRONT);
    try { var lc = new RGBColor(); lc.red = 255; lc.green = 0; lc.blue = 0; L.color = lc; } catch (e) {}
    var red = EM_red(doc), MAX = 500, n = Math.min(res.clusters.length, MAX), i;
    var pad = Math.max(st.t * 1.5, 4), sw = Math.max(Math.min(st.t / 4, 1.5), 0.5);
    var groups = [], objMap = {};
    for (i = 0; i < n; i++) {
        var c = res.clusters[i];
        var g = L.groupItems.add();
        g.name = EM_T.zone + " " + EM_CORE.fmt(c.minGap, st.unit) + (c.self && !c.between ? " (" + EM_T.thin + ")" : "");
        var l = c.left - pad, r = c.right + pad, t = c.top + pad, b = c.bottom - pad;
        var w = r - l, h = t - b;
        var e = g.pathItems.roundedRectangle(t, l, w, h, Math.min(w, h) / 2, Math.min(w, h) / 2);
        e.filled = false; e.stroked = true; e.strokeColor = red; e.strokeWidth = sw; e.strokeDashes = [];
        var ln = g.pathItems.add();
        ln.setEntirePath([[c.x1, c.y1], [c.x2, c.y2]]);
        ln.filled = false; ln.stroked = true; ln.strokeColor = red; ln.strokeWidth = sw;
        if (st.label) {
            var tf = g.textFrames.pointText([r + 2, t]);
            tf.contents = EM_CORE.fmt(c.minGap, st.unit);
            try { tf.textRange.characterAttributes.size = Math.max(6, Math.min(pad, 14)); tf.textRange.characterAttributes.fillColor = red; } catch (e2) {}
        }
        groups.push(g);
        var k; for (k in c.objs) objMap[k] = true;
    }
    L.printable = false;
    doc.selection = null;
    if (st.selobj) {
        var k2; for (k2 in objMap) { try { collected.items[Number(k2)].selected = true; } catch (e3) {} }
    } else {
        for (i = 0; i < groups.length; i++) groups[i].selected = true;
    }
    return n;
}

function EM_run(doc, st) {
    var col = EM_collect(doc, st.scope, st);
    var res = EM_CORE.analyze(col.contours, { t: st.t, useStroke: st.stroke, ignoreTouching: st.touch, selfCheck: st.self, betweenCheck: st.between });
    res.col = col;
    return res;
}

function EM_summary(res, st) {
    var s;
    if (res.clusters.length) s = EM_fill(EM_T.res, { z: res.clusters.length, m: EM_CORE.fmt(res.clusters[0].minGap, st.unit), p: res.col.paths });
    else s = EM_fill(EM_T.resNone, { t: EM_CORE.fmt(st.t, st.unit), p: res.col.paths });
    if (res.col.skipped) s += "\n" + EM_fill(EM_T.skipped, { n: res.col.skipped });
    if (res.contactsSkipped) s += "\n" + EM_fill(EM_T.contacts, { n: res.contactsSkipped });
    if (res.truncated) s += "\n" + EM_T.trunc;
    return s;
}

function EM_main() {
    if (app.documents.length === 0) { alert(EM_T.noDoc); return; }
    var doc = app.activeDocument, cfg = EM_loadCfg();
    var hasSel = doc.selection && doc.selection.length > 0;

    var w = new Window("dialog", EM_T.title);
    w.orientation = "column"; w.alignChildren = "fill";
    var r1 = w.add("group"); r1.add("statictext", undefined, EM_T.gap);
    var eGap = r1.add("edittext", undefined, cfg.gap); eGap.characters = 7;
    var units = ["mm", "cm", "pt", "px", "in"], dUnit = r1.add("dropdownlist", undefined, units), u;
    dUnit.selection = 0; for (u = 0; u < units.length; u++) if (units[u] === cfg.unit) dUnit.selection = u;

    var pS = w.add("panel", undefined, EM_T.scope); pS.orientation = "row";
    var rbSel = pS.add("radiobutton", undefined, EM_T.sSel), rbArt = pS.add("radiobutton", undefined, EM_T.sArt), rbDoc = pS.add("radiobutton", undefined, EM_T.sDoc);
    if (cfg.scope === "sel" || hasSel) rbSel.value = true; else if (cfg.scope === "art") rbArt.value = true; else rbDoc.value = true;
    if (!hasSel) { rbSel.enabled = false; if (rbSel.value) rbDoc.value = true; }

    var pC = w.add("panel", undefined, EM_T.checks); pC.alignChildren = "left";
    var cbB = pC.add("checkbox", undefined, EM_T.cBetween); cbB.value = cfg.between === "1";
    var cbS = pC.add("checkbox", undefined, EM_T.cSelf); cbS.value = cfg.self === "1";
    var cbW = pC.add("checkbox", undefined, EM_T.oStroke); cbW.value = cfg.stroke === "1";
    var cbT = pC.add("checkbox", undefined, EM_T.oTouch); cbT.value = cfg.touch === "1";
    var cbC = pC.add("checkbox", undefined, EM_T.oClip); cbC.value = cfg.clip === "1";
    var cbL = pC.add("checkbox", undefined, EM_T.oLabel); cbL.value = cfg.label === "1";
    var cbO = pC.add("checkbox", undefined, EM_T.oSelObj); cbO.value = cfg.selobj === "1";

    var info = w.add("statictext", undefined, EM_T.ready, { multiline: true }); info.preferredSize = [460, 70];
    var tip = w.add("statictext", undefined, EM_T.tip, { multiline: true }); tip.preferredSize = [460, 34];

    var bg = w.add("group"); bg.alignment = "right";
    var bA = bg.add("button", undefined, EM_T.analyze), bM = bg.add("button", undefined, EM_T.mark, { name: "ok" });
    var bX = bg.add("button", undefined, EM_T.clear), bC = bg.add("button", undefined, EM_T.cancel, { name: "cancel" });

    function readSt() {
        var v = parseFloat(String(eGap.text).replace(",", "."));
        if (!(v > 0)) { info.text = EM_T.badNum; return null; }
        var unit = dUnit.selection ? dUnit.selection.text : "mm";
        return { t: EM_CORE.toPt(v, unit), unit: unit, gapText: String(v),
            scope: rbSel.value ? "sel" : (rbArt.value ? "art" : "doc"),
            between: cbB.value, self: cbS.value, stroke: cbW.value, touch: cbT.value, clip: cbC.value, label: cbL.value, selobj: cbO.value };
    }
    function store(st) {
        EM_saveCfg({ gap: st.gapText, unit: st.unit, scope: st.scope, between: st.between ? "1" : "0", self: st.self ? "1" : "0",
            stroke: st.stroke ? "1" : "0", touch: st.touch ? "1" : "0", clip: st.clip ? "1" : "0", label: st.label ? "1" : "0", selobj: st.selobj ? "1" : "0" });
    }
    var chosen = null;
    bA.onClick = function () {
        var st = readSt(); if (!st) return;
        info.text = EM_T.working; w.update();
        try { info.text = EM_summary(EM_run(doc, st), st); } catch (e) { info.text = String(e); }
    };
    bM.onClick = function () { var st = readSt(); if (!st) return; chosen = st; w.close(1); };
    bX.onClick = function () { w.close(3); };
    var rc = w.show();

    if (rc === 3) { alert(EM_clear(doc) ? EM_T.cleared : EM_T.noLayer); return; }
    if (rc !== 1 || !chosen) return;
    store(chosen);
    if (chosen.scope === "sel" && !(doc.selection && doc.selection.length)) { alert(EM_T.noSel); return; }
    var res = EM_run(doc, chosen);
    var msg = EM_summary(res, chosen);
    if (res.clusters.length) {
        var n = EM_mark(doc, res, chosen, res.col);
        msg = EM_fill(EM_T.done, { z: n, l: EM_LAYER, m: EM_CORE.fmt(res.clusters[0].minGap, chosen.unit) }) + "\n\n" + msg;
        if (n < res.clusters.length) msg += "\n" + EM_fill(EM_T.many, { n: n });
    }
    app.redraw();
    alert(msg);
}

if (typeof app !== "undefined" && typeof EM_NO_MAIN === "undefined") {
    try { EM_main(); } catch (err) { alert("ControleEcartsMinimaux : " + err + (err.line ? " (ligne " + err.line + ")" : "")); }
}
