// Tests de la logique géométrique sur données simulées (Node.js) — pas de test dans Illustrator.
// Geometry logic tests on simulated data (Node.js) — not an Illustrator test.
var fs = require("fs"), vm = require("vm"), path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "ControleEcartsMinimaux.jsx"), "utf8");
var ctx = { Math: Math, String: String, Number: Number, EM_NO_MAIN: true, $: { locale: "fr_FR" } };
vm.createContext(ctx); vm.runInContext(src, ctx);
var C = ctx.EM_CORE, MM = 72 / 25.4, pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("ok   " + name); } else { fail++; console.log("FAIL " + name + (extra ? " -> " + extra : "")); } }
function L(x, y) { return [x, y, x, y, x, y]; }
function rect(x, y, w, h) { return [L(x, y), L(x + w, y), L(x + w, y + h), L(x, y + h)]; }
var K = 0.5522847498;
function circle(cx, cy, r) {
    return [[cx + r, cy, cx + r, cy - K * r, cx + r, cy + K * r], [cx, cy + r, cx + K * r, cy + r, cx - K * r, cy + r],
            [cx - r, cy, cx - r, cy + K * r, cx - r, cy - K * r], [cx, cy - r, cx - K * r, cy - r, cx + K * r, cy - r]];
}
function star(cx, cy, R, r, n) { var p = [], i; for (i = 0; i < 2 * n; i++) { var a = Math.PI * i / n, q = i % 2 ? r : R; p.push(L(cx + q * Math.cos(a), cy + q * Math.sin(a))); } return p; }
function run(cs, t, o) { o = o || {}; return C.analyze(cs, { t: t, useStroke: !!o.stroke, ignoreTouching: o.touch !== false, selfCheck: o.self !== false, betweenCheck: o.between !== false }); }
function near(a, b, e) { return Math.abs(a - b) <= e; }

// 1. Deux rectangles à 0,5 mm, seuil 1 mm
var r = run([{ pts: rect(0, 0, 20 * MM, 10 * MM), closed: true, obj: 0 }, { pts: rect(20.5 * MM, 0, 20 * MM, 10 * MM), closed: true, obj: 1 }], 1 * MM);
ok("1 rectangles à 0,5 mm : 1 zone", r.clusters.length === 1, r.clusters.length);
ok("1 écart mesuré 0,5 mm", r.clusters.length && near(r.clusters[0].minGap, 0.5 * MM, 1e-6), r.clusters.length && r.clusters[0].minGap / MM);
ok("1 zone marquée « entre objets »", r.clusters.length && r.clusters[0].between && !r.clusters[0].self);
// 2. À 2 mm : rien
r = run([{ pts: rect(0, 0, 20 * MM, 10 * MM), closed: true, obj: 0 }, { pts: rect(22 * MM, 0, 20 * MM, 10 * MM), closed: true, obj: 1 }], 1 * MM);
ok("2 rectangles à 2 mm : 0 zone", r.clusters.length === 0, r.clusters.length);
// 3. Barre fine 0,3 mm x 20 mm
r = run([{ pts: rect(0, 0, 20 * MM, 0.3 * MM), closed: true, obj: 0 }], 1 * MM);
ok("3 barre de 0,3 mm : 1 zone (partie fine)", r.clusters.length === 1 && r.clusters[0].self, r.clusters.length);
ok("3 largeur mesurée 0,3 mm", r.clusters.length && near(r.clusters[0].minGap, 0.3 * MM, 1e-6));
ok("3 la zone couvre presque toute la barre", r.clusters.length && (r.clusters[0].right - r.clusters[0].left) > 16 * MM, r.clusters.length && (r.clusters[0].right - r.clusters[0].left) / MM);
// 4. Carré 10 mm : angles droits non signalés
r = run([{ pts: rect(0, 0, 10 * MM, 10 * MM), closed: true, obj: 0 }], 1 * MM);
ok("4 carré : aucun faux positif aux angles", r.clusters.length === 0, r.clusters.length);
// 5. Cercle de Bézier r = 5 mm
r = run([{ pts: circle(0, 0, 5 * MM), closed: true, obj: 0 }], 1 * MM);
ok("5 cercle : aucun faux positif", r.clusters.length === 0, r.clusters.length);
// 6. Petit cercle r = 0,3 mm (diamètre 0,6 < 1 mm)
r = run([{ pts: circle(0, 0, 0.3 * MM), closed: true, obj: 0 }], 1 * MM);
ok("6 cercle de 0,6 mm de diamètre : signalé", r.clusters.length === 1, r.clusters.length);
ok("6 diamètre mesuré ≈ 0,6 mm", r.clusters.length && near(r.clusters[0].minGap, 0.6 * MM, 0.02 * MM), r.clusters.length && r.clusters[0].minGap / MM);
// 7. Étoile à branches très pointues
r = run([{ pts: star(0, 0, 20 * MM, 3 * MM, 5), closed: true, obj: 0 }], 1 * MM);
ok("7 étoile pointue : 5 pointes signalées", r.clusters.length === 5, r.clusters.length);
// 8. Hexagone (angles 120°) : rien
r = run([{ pts: star(0, 0, 10 * MM, 10 * MM, 3), closed: true, obj: 0 }], 1 * MM);
ok("8 hexagone : aucun faux positif", r.clusters.length === 0, r.clusters.length);
// 9. Rectangles accolés (contact)
var acc = [{ pts: rect(0, 0, 10 * MM, 10 * MM), closed: true, obj: 0 }, { pts: rect(10 * MM, 0, 10 * MM, 10 * MM), closed: true, obj: 1 }];
r = run(acc, 1 * MM);
ok("9 rectangles accolés, contacts ignorés : 0 zone", r.clusters.length === 0, r.clusters.length);
ok("9 contacts comptés", r.contactsSkipped > 0);
r = run(acc, 1 * MM, { touch: false });
ok("9b contacts non ignorés : signalés", r.clusters.length >= 1, r.clusters.length);
// 10. Traits : deux lignes à 3 pt, épaisseur 2 pt, seuil 1,5 pt
var lines = [{ pts: [L(0, 0), L(100, 0)], closed: false, obj: 0, sw: 2 }, { pts: [L(0, 3), L(100, 3)], closed: false, obj: 1, sw: 2 }];
r = run(lines, 1.5);
ok("10 sans épaisseur : 3 pt > 1,5 pt, rien", r.clusters.length === 0, r.clusters.length);
r = run(lines, 1.5, { stroke: true });
ok("10 avec épaisseur : blanc de 1 pt signalé", r.clusters.length === 1 && near(r.clusters[0].minGap, 1, 1e-6), r.clusters.length && r.clusters[0].minGap);
// 11. Anneau (tracé composé) de 0,3 mm d'épaisseur
r = run([{ pts: circle(0, 0, 10 * MM), closed: true, obj: 0 }, { pts: circle(0, 0, 9.7 * MM), closed: true, obj: 0 }], 1 * MM);
ok("11 anneau fin : 1 zone continue", r.clusters.length === 1, r.clusters.length);
ok("11 épaisseur ≈ 0,3 mm", r.clusters.length && near(r.clusters[0].minGap, 0.3 * MM, 0.02 * MM), r.clusters.length && r.clusters[0].minGap / MM);
// 12. Épingle ouverte (U serré)
var U = [L(0, 0), L(50, 0), [50, 1, 51, 0, 51, 1], L(0, 1)];
r = run([{ pts: [L(0, 0), L(50, 0), L(50, 1), L(0, 1)], closed: false, obj: 0 }], 2);
ok("12 tracé ouvert en épingle : signalé", r.clusters.length === 1 && near(r.clusters[0].minGap, 1, 1e-6), r.clusters.length);
// 13. Ligne droite seule : rien
r = run([{ pts: [L(0, 0), L(300, 0)], closed: false, obj: 0 }], 5);
ok("13 ligne droite : aucun faux positif", r.clusters.length === 0, r.clusters.length);
// 14. Contrôles désactivables
r = run([{ pts: rect(0, 0, 20 * MM, 0.3 * MM), closed: true, obj: 0 }], 1 * MM, { self: false });
ok("14 parties fines désactivées : 0 zone", r.clusters.length === 0);
r = run([{ pts: rect(0, 0, 20 * MM, 10 * MM), closed: true, obj: 0 }, { pts: rect(20.5 * MM, 0, 20 * MM, 10 * MM), closed: true, obj: 1 }], 1 * MM, { between: false });
ok("14b écarts entre objets désactivés : 0 zone", r.clusters.length === 0);
// 15. Deux zones distinctes triées par gravité
r = run([{ pts: rect(0, 0, 10 * MM, 10 * MM), closed: true, obj: 0 }, { pts: rect(10.8 * MM, 0, 10 * MM, 10 * MM), closed: true, obj: 1 },
         { pts: rect(0, 50 * MM, 10 * MM, 10 * MM), closed: true, obj: 2 }, { pts: rect(10.2 * MM, 50 * MM, 10 * MM, 10 * MM), closed: true, obj: 3 }], 1 * MM);
ok("15 deux zones, la plus critique en premier", r.clusters.length === 2 && near(r.clusters[0].minGap, 0.2 * MM, 1e-6) && near(r.clusters[1].minGap, 0.8 * MM, 1e-6), r.clusters.length);
ok("15 objets concernés par zone", r.clusters.length === 2 && r.clusters[0].objs[2] && r.clusters[0].objs[3] && !r.clusters[0].objs[0]);
// 16. Unités et format
ok("16 conversion mm", near(C.toPt(1, "mm"), 2.834645669, 1e-6) && near(C.fromPt(72, "in"), 1, 1e-9));
ok("16 format 0,5 mm", C.fmt(0.5 * MM, "mm") === "0.5 mm", C.fmt(0.5 * MM, "mm"));
// 17. Segments qui se croisent
var x = C.segSeg(0, 0, 10, 10, 0, 10, 10, 0);
ok("17 segments croisés : distance 0", x.d === 0 && near(x.x1, 5, 1e-9));
// 17b. Point isolé minuscule et trou minuscule dans une grande forme
r = run([{ pts: rect(0, 0, 30 * MM, 30 * MM), closed: true, obj: 0 }, { pts: circle(15 * MM, 15 * MM, 0.2 * MM), closed: true, obj: 0 }], 1 * MM);
ok("17b trou de 0,4 mm signalé une fois", r.clusters.length === 1 && near(r.clusters[0].minGap, 0.4 * MM, 0.01 * MM), r.clusters.length);
// 18. Performance : 400 cercles en grille
var many = [], i, j; for (i = 0; i < 20; i++) for (j = 0; j < 20; j++) many.push({ pts: circle(i * 12 * MM, j * 12 * MM, 5 * MM), closed: true, obj: many.length });
var t0 = Date.now(); r = run(many, 1 * MM);
ok("18 400 cercles espacés de 2 mm : 0 zone (" + (Date.now() - t0) + " ms en Node)", r.clusters.length === 0, r.clusters.length);

console.log("\n" + pass + " réussis, " + fail + " échoués");
process.exit(fail ? 1 : 0);
