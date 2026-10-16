// Simulation des objets Illustrator (collecte + marquage) — ne remplace pas un essai réel.
// Simulated Illustrator objects (collection + marking) — not a substitute for a real test.
var fs = require("fs"), vm = require("vm"), path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "ControleEcartsMinimaux.jsx"), "utf8");
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log("ok   " + n); } else { fail++; console.log("FAIL " + n + (e !== undefined ? " -> " + e : "")); } }
function col(list) { var a = list.slice(); a.add = function () { var o = mkGroup(); a.push(o); return o; }; return a; }
function mkPath(pts, o) {
    o = o || {};
    var pp = pts.map(function (p) { return { anchor: p, leftDirection: p, rightDirection: p }; });
    var b = [Math.min.apply(null, pts.map(function (p) { return p[0]; })), Math.max.apply(null, pts.map(function (p) { return p[1]; })),
             Math.max.apply(null, pts.map(function (p) { return p[0]; })), Math.min.apply(null, pts.map(function (p) { return p[1]; }))];
    return { typename: "PathItem", pathPoints: pp, closed: o.closed !== false, filled: true, stroked: !!o.sw, strokeWidth: o.sw || 0,
             guides: false, clipping: !!o.clip, locked: !!o.locked, hidden: !!o.hidden, geometricBounds: b, layer: o.layer };
}
var created = { groups: 0, rr: 0, lines: 0, texts: 0 };
function mkGroup() {
    var g = { typename: "GroupItem", pageItems: [], selected: false };
    g.pathItems = { roundedRectangle: function () { created.rr++; return {}; }, add: function () { created.lines++; return { setEntirePath: function (a) { this.p = a; } }; } };
    g.textFrames = { pointText: function () { created.texts++; return { textRange: { characterAttributes: {} } }; } };
    created.groups++;
    return g;
}
function rect(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
var MM = 72 / 25.4;
var a = mkPath(rect(0, 0, 20 * MM, 10 * MM)), b = mkPath(rect(20.5 * MM, 0, 20 * MM, 10 * MM));
var lockedP = mkPath(rect(0, 100, 10, 0.1), { locked: true });
var clipP = mkPath(rect(0, 200, 10, 0.1), { clip: true });
var cp = { typename: "CompoundPathItem", locked: false, hidden: false, pathItems: [mkPath(rect(300, 0, 10, 10)), mkPath(rect(300, 10.2, 10, 10))], geometricBounds: [300, 20.2, 310, 0] };
var text = { typename: "TextFrame", locked: false, hidden: false, geometricBounds: [0, 0, 1, 1] };
var grp = { typename: "GroupItem", locked: false, hidden: false, pageItems: [b, cp] };
var layers = [];
var L1 = { name: "Calque 1", visible: true, locked: false, pageItems: [a, grp, lockedP, clipP, text], layers: [] };
layers.push(L1);
layers.add = function () { var L = { name: "", visible: true, locked: false, pageItems: [], layers: [], groupItems: col([]), zOrder: function () {}, remove: function () { layers.splice(layers.indexOf(L), 1); } }; layers.unshift(L); return L; };
var doc = { layers: layers, selection: [], documentColorSpace: "RGB", artboards: { getActiveArtboardIndex: function () { return 0; } } };
doc.artboards[0] = { artboardRect: [0, 50, 100, -10] };
var ctx = { Math: Math, String: String, Number: Number, EM_NO_MAIN: true, $: { locale: "fr_FR" },
    app: { locale: "fr_FR" }, DocumentColorSpace: { CMYK: "CMYK" }, ZOrderMethod: { BRINGTOFRONT: 1 },
    RGBColor: function () {}, CMYKColor: function () {} };
vm.createContext(ctx); vm.runInContext(src, ctx);

var st = { t: 1 * MM, unit: "mm", scope: "doc", between: true, self: true, stroke: true, touch: true, clip: true, label: true, selobj: false };
var res = ctx.EM_run(doc, st);
ok("collecte : 4 contours (verrouillé et masque ignorés)", res.col.paths === 4, res.col.paths);
ok("collecte : texte compté comme non analysé", res.col.skipped === 1, res.col.skipped);
ok("collecte : les 2 sous-tracés du tracé composé = un seul objet", res.col.contours[2].obj === res.col.contours[3].obj && res.col.contours[1].obj !== res.col.contours[2].obj);
ok("analyse : 2 zones (écart 0,5 mm + écart du tracé composé)", res.clusters.length === 2, res.clusters.length);
ok("résumé en français", /zone\(s\) trop étroite\(s\)/.test(ctx.EM_summary(res, st)), ctx.EM_summary(res, st));
var n = ctx.EM_mark(doc, res, st, res.col);
var mk = ctx.EM_findLayer(doc);
ok("marquage : calque de repères créé et non imprimable", mk && mk.printable === false && mk.name === ctx.EM_LAYER);
ok("marquage : 1 groupe, 1 cadre, 1 trait, 1 étiquette par zone", n === 2 && created.groups === 2 && created.rr === 2 && created.lines === 2 && created.texts === 2, JSON.stringify(created));
ok("marquage : repères sélectionnés", mk.groupItems.every(function (g) { return g.selected; }));
var res2 = ctx.EM_run(doc, st);
ok("le calque de repères n'est pas analysé", res2.col.paths === 4, res2.col.paths);
st.selobj = true; ctx.EM_mark(doc, res2, st, res2.col);
ok("relancer remplace le calque de repères", doc.layers.filter(function (l) { return l.name === ctx.EM_LAYER; }).length === 1);
ok("option : sélection des objets concernés", a.selected === true && b.selected === true && cp.selected === true);
ok("effacer les repères", ctx.EM_clear(doc) === true && !ctx.EM_findLayer(doc));
st.scope = "art"; var res3 = ctx.EM_run(doc, st);
ok("portée plan de travail : objets hors plan exclus", res3.col.items.length === 2, res3.col.items.length);
console.log("\n" + pass + " réussis, " + fail + " échoués");
process.exit(fail ? 1 : 0);
