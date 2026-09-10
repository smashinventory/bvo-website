#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  STEP 1 — JMV revenue basis
#  Per JMV_REVENUE_DEFINITION.md (approved 2026-09-10, amended same day).
#
#  Gates EXECUTE. They load the local DB dump into SQLite and run the
#  controller's own SQL strings against it — not a re-typed copy, which
#  would only prove the copy is consistent with itself.
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

CTRL="src/controllers/jmvReportsController.js"
VIEW="views/pages/admin/marketing/jmv-financials.ejs"
ROLLUP="src/jobs/jmvMovementRollup.js"
MIG="database/migrations/017_jmv_snapshots_msrp.sql"
DEFN="JMV_REVENUE_DEFINITION.md"
DUMP="../u222311468_BVO_website.20260908172420/u222311468_BVO_website.20260908172420.sql"

echo "──────────────────────────────────────────────────────────────"
echo " GATES"
echo "──────────────────────────────────────────────────────────────"

cat > ./.gates.rev.py <<'PYEOF'
import re, os, io, sys, json, subprocess, sqlite3, tempfile

CTRL   = "src/controllers/jmvReportsController.js"
VIEW   = "views/pages/admin/marketing/jmv-financials.ejs"
ROLLUP = "src/jobs/jmvMovementRollup.js"
MIG    = "database/migrations/017_jmv_snapshots_msrp.sql"
DEFN   = "JMV_REVENUE_DEFINITION.md"
DUMP   = os.environ.get("BVO_DUMP", "")
DB     = "/tmp/bvo_gate.sqlite"

ctrl   = io.open(CTRL,   encoding="utf-8").read()
view   = io.open(VIEW,   encoding="utf-8").read()
rollup = io.open(ROLLUP, encoding="utf-8").read()

GATES = []

# ── SQL assembly, lifted from the controller source ──────────────────
def frag(src, name):
    m = re.search(r"const %s\s*=\s*`([\s\S]*?)`;" % name, src)
    return m.group(1) if m else None

def build_sql(src, scope="all"):
    f = re.search(r"const MSRP_TO_MAP\s*=\s*([0-9.]+);", src)
    if not f: return None, "MSRP_TO_MAP constant is missing"
    for n in ("NOT_A_COMBO", "NOT_A_SAMPLE", "UNIT_PRICE", "BASE_JOIN",
              "BASE_WHERE", "PRICED"):
        if frag(src, n) is None: return None, "fragment missing: " + n
    scope_sql = "1=1" if scope == "all" else "d.product_type IN ('Cabinet','Top')"
    m = re.search(r"const ASSEMBLED_TYPES\s*=\s*\[([\s\S]*?)\];", src)
    if not m: return None, "ASSEMBLED_TYPES list is missing"
    at = re.findall(r"'([^']+)'", m.group(1))
    at_sql = ",".join("'%s'" % t for t in at)
    up = frag(src, "UNIT_PRICE").replace("${MSRP_TO_MAP}", f.group(1))
    bw = (frag(src, "BASE_WHERE")
          .replace("${SCOPE_SQL}", scope_sql)
          .replace("${NOT_A_COMBO}", frag(src, "NOT_A_COMBO").replace("${AT_SQL}", at_sql))
          .replace("${NOT_A_SAMPLE}", frag(src, "NOT_A_SAMPLE"))
          .replace("${UNIT_PRICE}", up))
    priced = (frag(src, "PRICED").replace("${UNIT_PRICE}", up)
              .replace("${BASE_JOIN}", frag(src, "BASE_JOIN"))
              .replace("${BASE_WHERE}", bw))
    return priced, None

def db():
    if not os.path.exists(DB): return None
    con = sqlite3.connect(DB)
    con.create_function("DATE_FORMAT", 2, lambda v, f: (v or "")[:10])
    return con

WIN = ('2026-08-01', '2026-09-09')


def g1(src=None):
    """The retired machinery must be gone from the revenue path, not merely
       unused. A dormant PIVOT is an invitation to wire it back up."""
    src = src if src is not None else ctrl
    body = src[src.index("async function getFinancials"):]
    body = body[:body.index("\n}\n")] if "\n}\n" in body else body
    for tok in ("${PIVOT}", "combo_u", "combo_p", "GREATEST(0,"):
        if tok in body: return "revenue path still contains " + tok
    return None
GATES.append(("G1 pivot / combo_u / GREATEST gone from getFinancials", g1,
    lambda: g1(ctrl.replace("const PRICED = `", "const PIVOT_X = `${PIVOT}`;\n    const PRICED = `", 1))))


def g2(src=None):
    """EXECUTE: no combo SKU may contribute revenue. Definition §2."""
    con = db()
    if con is None: return None  # dump unavailable — G0 already said so
    priced, err = build_sql(src if src is not None else ctrl)
    if err: return err
    n = con.execute("SELECT COUNT(*) FROM (%s) g JOIN jmv_dimensions d2 "
                    "ON d2.sku=g.sku WHERE d2.top_finish IS NOT NULL "
                    "AND d2.top_finish <> '' AND d2.product_type IN "
                    "('Vanity','Console','Countertop Unit','Storage Cabinet','Drawer Unit')"
                    % priced, list(WIN)).fetchone()[0]
    return None if n == 0 else "%d combo rows leaked into revenue" % n
GATES.append(("G2 no combo SKU contributes revenue (executed)", g2,
    lambda: g2(ctrl.replace("const NOT_A_COMBO =\n      `NOT (", "const NOT_A_COMBO =\n      `NOT (FALSE AND ", 1))))


def g3(src=None):
    """EXECUTE: Tops must still count. The combo rule keys on top_finish and
       every Top carries one, so an over-broad rule silently deletes the
       single largest revenue line — 3,575,809 of it."""
    con = db()
    if con is None: return None
    priced, err = build_sql(src if src is not None else ctrl)
    if err: return err
    n = con.execute("SELECT COUNT(*) FROM (%s) g JOIN jmv_dimensions d2 "
                    "ON d2.sku=g.sku WHERE d2.product_type='Top'"
                    % priced, list(WIN)).fetchone()[0]
    return None if n > 0 else "Tops were excluded — the combo rule is too broad"
GATES.append(("G3 Tops still counted despite carrying top_finish (executed)", g3,
    lambda: g3(ctrl.replace("AND d.product_type IN (${AT_SQL})", "", 1))))


def g4(src=None):
    """EXECUTE: the assembled Countertop/Storage/Drawer/Console SKUs are
       combos too — 90 of them — and a bare product_type list misses every
       one, because those types also ship in plain form.

       Floating Console is deliberately NOT in this list: its 15 top_finish
       SKUs are not derived from any base SKU, so they are solid pieces that
       merely share a stone name. G15 guards that they keep counting."""
    con = db()
    if con is None: return None
    priced, err = build_sql(src if src is not None else ctrl)
    if err: return err
    n = con.execute("SELECT COUNT(*) FROM (%s) g JOIN jmv_dimensions d2 "
                    "ON d2.sku=g.sku WHERE d2.product_type IN "
                    "('Countertop Unit','Storage Cabinet','Drawer Unit',"
                    "'Console') AND d2.top_finish IS NOT NULL "
                    "AND d2.top_finish <> ''" % priced, list(WIN)).fetchone()[0]
    return None if n == 0 else "%d assembled non-Vanity SKUs leaked" % n
GATES.append(("G4 assembled Countertop/Storage/Drawer/Console excluded (executed)", g4,
    lambda: g4(ctrl.replace("'Storage Cabinet', 'Drawer Unit'];", "];", 1))))


def g5(src=None):
    """EXECUTE: the 13 mis-typed Chianti/Mantova cabinets must be counted, and
       counted by the RULE — no allow-list. They are Vanity-typed with no
       top_finish, which is precisely what makes them individual products."""
    con = db()
    if con is None: return None
    src = src if src is not None else ctrl
    # Strip comments before looking for an allow-list: the controller
    # *documents* these SKUs by name, and a gate that cannot tell prose from
    # code fails on correct source.
    code = re.sub(r"/\*[\s\S]*?\*/", "", src)
    code = re.sub(r"//[^\n]*", "", code)
    if "533-V20-GW-BNK" in code:
        return "an allow-list crept in — the rule should cover these"
    priced, err = build_sql(src)
    if err: return err
    skus = ('533-V20-GW-BNK','533-V20-GW-CB','533-V20-GW-MBK','533-V20-WLW-BNK',
            '533-V20-WLW-CB','533-V20-WLW-MBK','533-V24-GW-BNK','533-V24-GW-CB',
            '533-V24-GW-MBK','533-V24-WLW-BNK','533-V24-WLW-CB','533-V24-WLW-MBK',
            '805-V31.5-WLT-CB')
    ph = ",".join("?" * len(skus))
    moved = con.execute("SELECT COUNT(DISTINCT sku) FROM jmv_daily_movement "
                        "WHERE is_valid=1 AND movement_date BETWEEN ? AND ? "
                        "AND demand_min > 0 AND sku IN (%s)" % ph,
                        [*WIN, *skus]).fetchone()[0]
    got = con.execute("SELECT COUNT(DISTINCT g.sku) FROM (%s) g WHERE g.sku IN (%s)"
                      % (priced, ph), [*WIN, *skus]).fetchone()[0]
    if moved == 0: return None
    return None if moved == got else "%d of %d mis-typed cabinets dropped" % (moved - got, moved)
GATES.append(("G5 the 13 mis-typed cabinets included by rule, no allow-list (executed)", g5,
    lambda: g5(ctrl.replace("d.top_finish IS NOT NULL AND d.top_finish <> '' AND ", "", 1))))


def g6(src=None):
    """EXECUTE: samples never count. $9.99 postage items are not merchandise."""
    con = db()
    if con is None: return None
    priced, err = build_sql(src if src is not None else ctrl)
    if err: return err
    n = con.execute("SELECT COUNT(*) FROM (%s) g JOIN jmv_dimensions d2 "
                    "ON d2.sku=g.sku WHERE d2.product_type LIKE 'Sample - %%'"
                    % priced, list(WIN)).fetchone()[0]
    return None if n == 0 else "%d sample rows leaked" % n
def _g6_mutant():
    """Samples carry no MAP and no compare_price, so the price filter already
       excludes them and neutering NOT_A_SAMPLE alone changes nothing — the
       first version of this mutant passed and proved the gate worthless.
       Remove BOTH so the sample predicate is the only thing left holding
       them out."""
    m = ctrl.replace("const NOT_A_SAMPLE = `(d.product_type NOT LIKE 'Sample - %')`;",
                     "const NOT_A_SAMPLE = `(1=1)`;", 1)
    m = m.replace("        AND ${UNIT_PRICE} IS NOT NULL", "", 1)
    return g6(m)
GATES.append(("G6 samples excluded (executed)", g6, _g6_mutant))


def g7(src=None):
    """EXECUTE: price must come from the movement's OWN day.

       Proved by perturbing the DATA, not by comparing two hand-written
       queries. MAP prices are near-static in this window, so a code-level
       swap to the latest snapshot produces an identical total and the first
       version of this gate passed its own mutant.

       Here: bump one SKU's map_price on a day that is NOT the newest
       snapshot, and require the total to move by exactly units x delta.
       Code joined to the latest snapshot cannot see that change at all.
       Rolled back, so the gate leaves no trace."""
    con = db()
    if con is None: return None
    priced, err = build_sql(src if src is not None else ctrl)
    if err: return err
    day = '2026-08-26'
    newest = con.execute("SELECT MAX(snapshot_date) FROM jmv_snapshots").fetchone()[0]
    if day >= (newest or ''): return "probe day is not older than the newest snapshot"

    row = con.execute(
        """SELECT m.sku, m.demand_min FROM jmv_daily_movement m
             JOIN jmv_dimensions d ON d.sku = m.sku
             JOIN jmv_snapshots s ON s.sku = m.sku AND s.snapshot_date = m.movement_date
            WHERE m.is_valid=1 AND m.movement_date = ? AND m.demand_min > 0
              AND s.map_price IS NOT NULL
              AND (d.top_finish IS NULL OR d.top_finish='' OR d.product_type='Top')
              AND d.product_type NOT LIKE 'Sample - %'
            LIMIT 1""", [day]).fetchone()
    if not row: return "no priced movement on the probe day"
    sku, units = row

    def total():
        return con.execute("SELECT ROUND(SUM(g.revenue),0) FROM (%s) g "
                           "WHERE g.movement_date = ?" % priced,
                           [day, day, day]).fetchone()[0] or 0
    before = total()
    con.execute("UPDATE jmv_snapshots SET map_price = map_price + 100 "
                "WHERE sku = ? AND snapshot_date = ?", [sku, day])
    after = total()
    con.rollback()

    moved = round(after - before)
    want  = round(units * 100)
    if moved == 0:
        return ("changing %s's price on %s moved nothing — revenue is not "
                "priced from the movement's own day" % (sku, day))
    if abs(moved - want) > 2:
        return "total moved %s, expected %s (%s units x $100)" % (moved, want, units)
    return None
GATES.append(("G7 revenue priced from the movement's own day (executed)", g7,
    lambda: g7(ctrl.replace("sd.snapshot_date = m.movement_date",
                            "sd.snapshot_date = (SELECT MAX(snapshot_date) FROM jmv_snapshots)", 1))))


def g8(src=None):
    """The price fallback chain must be MAP -> snapshot MSRP -> products MSRP,
       in that order. A reordered COALESCE silently prefers an estimate over a
       real price and nothing on screen would show it."""
    src = src if src is not None else ctrl
    up = frag(src, "UNIT_PRICE")
    if up is None: return "UNIT_PRICE fragment missing"
    # Order by where each token actually APPEARS. The first version filtered a
    # fixed tuple by membership, which returns that tuple's order regardless of
    # the source — it passed its own mutant.
    toks = [t for t in ("sd.map_price", "sd.msrp", "pr.compare_price") if t in up]
    order = sorted(toks, key=up.index)
    if order != ["sd.map_price", "sd.msrp", "pr.compare_price"]:
        return "fallback order is %s" % order
    if "COALESCE(...,0)" in up or re.search(r"COALESCE\([^)]*,\s*0\s*\)", up):
        return "COALESCE(...,0) is back — unpriced SKUs would book units at $0"
    return None
GATES.append(("G8 price fallback chain in the right order, no COALESCE(...,0)", g8,
    lambda: g8(ctrl.replace("COALESCE(sd.map_price, sd.msrp",
                            "COALESCE(sd.msrp, sd.map_price", 1))))


def g9(src=None):
    """Unpriced depletion is dropped from BOTH revenue and units, and the
       count is surfaced. Booking units at $0 makes the two cards disagree
       with nothing on the page explaining why."""
    src = src if src is not None else ctrl
    bw = frag(src, "BASE_WHERE")
    if bw is None or "IS NOT NULL" not in bw:
        return "BASE_WHERE does not filter unpriceable rows"
    if "unpricedSkus" not in src or "unpricedUnits" not in src:
        return "the excluded total is not surfaced to the view"
    if "unpricedUnits" not in view:
        return "the view never renders the excluded total"
    return None
GATES.append(("G9 unpriced rows dropped from both, and surfaced", g9,
    lambda: g9(ctrl.replace("AND ${UNIT_PRICE} IS NOT NULL", "", 1))))


def g10(src=None):
    """Every local the view reads must exist on all three render paths, or a
       failed query turns a handled 500 into a template crash."""
    src = src if src is not None else ctrl
    blocks = re.findall(r"res\.(?:status\(\d+\)\.)?render\('pages/admin/marketing/jmv-financials'[\s\S]*?\n\s*\}\);", src)
    if len(blocks) != 3: return "expected 3 render paths, found %d" % len(blocks)
    need = ["cabinetRevenue", "cabinetUnits", "topRevenue", "topUnits",
            "otherRevenue", "otherUnits", "unpricedSkus", "unpricedUnits",
            "collectedDays", "rev30", "rev15", "rev7", "rev24"]
    for i, b in enumerate(blocks, 1):
        miss = [k for k in need if k not in b]
        if miss: return "render path %d missing: %s" % (i, ", ".join(miss))
    return None
GATES.append(("G10 all locals on all three render paths", g10,
    lambda: g10(ctrl.replace("otherRevenue: 0, otherUnits: 0, unpricedSkus: 0, unpricedUnits: 0,", "", 1))))


def g11(src=None):
    """The view must render on all three paths, and must not still advertise
       the retired methodology."""
    src = src if src is not None else view
    L = {"pageTitle": "x", "fromDate": "2026-08-01", "toDate": "2026-09-09",
         "scope": "all", "latestDate": "2026-09-09", "mapRevenue": 1, "qtySold": 1,
         "rev30": {"total": 0, "days": 6, "avg": 1}, "rev15": {"total": 0, "days": 6, "avg": 1},
         "rev7": {"total": 0, "days": 6, "avg": 1}, "rev24": 1, "rev24Date": "2026-09-05",
         "cabinetRevenue": 1, "cabinetUnits": 1, "topRevenue": 1, "topUnits": 1,
         "otherRevenue": 1, "otherUnits": 1, "unpricedSkus": 2, "unpricedUnits": 9,
         "top10Revenue": [], "revenueByDay": "[]", "collectedDays": "[]",
         "revenueByCategory": "[]", "revenueByCollection": "[]", "revenueByFinish": "[]",
         "excludedNoCollectionRev": 0, "excludedNoCollectionUnits": 0,
         "excludedNoFinishRev": 0, "excludedNoFinishUnits": 0,
         "comboVsIndividual": "[]", "style": "", "LAYOUT": {}}
    tf = tempfile.NamedTemporaryFile("w", suffix=".ejs", delete=False, encoding="utf-8")
    tf.write(src); tf.close()
    script = ("const ejs=require('ejs');const L=" + json.dumps(L) + ";\n"
              "try{const o=ejs.render(require('fs').readFileSync(" + json.dumps(tf.name) + ",'utf8'),L,"
              "{filename:" + json.dumps(os.path.abspath(VIEW)) + "});"
              "console.log('OK'+JSON.stringify(o.replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ')));}"
              "catch(e){console.log('ERR '+e.message.split('\\n').filter(Boolean).pop());}")
    r = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    out = (r.stdout or r.stderr).strip()
    os.unlink(tf.name)
    if not out.startswith("OK"): return "render failed: " + out[4:150]
    text = json.loads(out[2:])
    for gone in ("Combo (Vanity) Revenue", "Individual SKU Revenue",
                 "Conservative Floor", "Combo vs Individual"):
        if gone in text: return "retired label still on the page: " + gone
    for want in ("Cabinet Revenue", "Top Revenue", "Composition",
                 "unpriced units excluded"):
        if want not in text: return "missing from the page: " + want
    return None
GATES.append(("G11 view renders; retired labels gone, new ones present", g11,
    lambda: g11(view.replace("Cabinet Revenue", "Combo (Vanity) Revenue", 1))))


def g12(src=None):
    """The rollup must capture MSRP, or price rule 4.2 can never engage and
       history never improves."""
    src = src if src is not None else rollup
    if "msrp:         'MSRP'" not in src and "msrp:" not in src:
        return "XLSX_COL_MAP has no msrp entry"
    if "INSERT INTO jmv_snapshots (snapshot_date, sku, qty, map_price, msrp)" not in src:
        return "the snapshot upsert does not write msrp"
    if "msrp=VALUES(msrp)" not in src:
        return "ON DUPLICATE KEY does not update msrp — a re-run would not backfill"
    if not os.path.exists(MIG): return "migration 017 is missing"
    mig = io.open(MIG, encoding="utf-8").read()
    if "`msrp` DECIMAL(10,2)" not in mig:
        return "migration 017 does not add the column"
    # Idempotent WITHOUT reading the catalogue. The first version guarded the
    # ALTER with a SELECT on information_schema and died on Hostinger with
    # #1044 Access denied — the shared-hosting grant has no catalogue access,
    # so @col was NULL, @sql was NULL, and PREPARE failed with nothing applied.
    if "IF NOT EXISTS" not in mig:
        return "migration 017 is not idempotent"
    if "information_schema" in mig.split("-- ══")[-1]:
        return "migration 017 reads information_schema — denied on Hostinger"
    return None
GATES.append(("G12 rollup captures MSRP + migration 017 present and idempotent", g12,
    lambda: g12(rollup.replace("msrp=VALUES(msrp)", "", 1))))


def g13(src=None):
    """The definition document is the artifact of record. Code that ships
       without it is code no one can check."""
    if not os.path.exists(DEFN): return "JMV_REVENUE_DEFINITION.md is missing"
    d = io.open(DEFN, encoding="utf-8").read()
    for k in ("top_finish IS NOT NULL", "MSRP", "0.66", "Samples"):
        if k not in d: return "definition does not state: " + k
    # Case-insensitive: the heading has been "Amended", "First amendment" and
    # "amended twice" across three revisions, and a literal match on one of
    # them fails the build for a wording change.
    if "product_type IN ('Vanity','Console')`" in d and "amend" not in d.lower():
        return "definition still carries the superseded rule with no amendment note"
    # The rule the code implements must be the rule the document states.
    if "ASSEMBLED_TYPES" not in ctrl:
        return "controller does not define ASSEMBLED_TYPES"
    at = re.findall(r"'([^']+)'",
                    re.search(r"const ASSEMBLED_TYPES\s*=\s*\[([\s\S]*?)\];", ctrl).group(1))
    for t in at:
        if t not in d:
            return "definition does not name assembled type '%s' that the code excludes" % t
    return None
GATES.append(("G13 definition of record present and current", g13, None))


def g15(src=None):
    """EXECUTE: solid stone pieces carry a top_finish but are NOT assemblies.

       Backsplashes, Tops and Floating Consoles share a finish NAME with the
       stone they are cut from. The first version of the combo rule keyed on
       top_finish alone and silently deleted 245 units of backsplash demand
       — no error, no empty chart, just a smaller number. G14 caught it.

       This is the other half of that rule under test: both the type list and
       top_finish must be present, or solid pieces vanish."""
    con = db()
    if con is None: return None
    priced, err = build_sql(src if src is not None else ctrl)
    if err: return err
    out = []
    for t in ("Backsplash", "Top", "Floating Console"):
        moved = con.execute(
            "SELECT COALESCE(SUM(m.demand_min),0) FROM jmv_daily_movement m "
            "JOIN jmv_dimensions d ON d.sku=m.sku WHERE m.is_valid=1 "
            "AND d.product_type=? AND m.movement_date BETWEEN ? AND ?",
            [t, *WIN]).fetchone()[0]
        got = con.execute(
            "SELECT COALESCE(SUM(g.units),0) FROM (%s) g JOIN jmv_dimensions d2 "
            "ON d2.sku=g.sku WHERE d2.product_type=?" % priced,
            [*WIN, t]).fetchone()[0]
        if moved > 0 and got == 0:
            out.append("%s: %d units moved, 0 counted" % (t, moved))
    return None if not out else "solid stone pieces dropped — " + "; ".join(out)
GATES.append(("G15 backsplashes / tops / floating consoles still count (executed)", g15,
    lambda: g15(ctrl.replace("AND d.product_type IN (${AT_SQL})", "", 1))))


def g14(src=None):
    """A combo-only model has no un-derived signal, so it reads as zero.

       Five SKUs sit in a group with no plain base of any type (Columbia,
       Mercer Island, Bellamy). Definition §6 accepts that they contribute
       nothing, on the evidence that none has ever registered demand — their
       tops exist separately, so counting them would recover clamp artefacts
       rather than sales.

       That acceptance is only valid while the demand really is zero. This
       gate fails the moment one of them sells, which is exactly when the
       decision needs revisiting. It is a tripwire, not a regression test:
       if it fires, the code is fine and the DEFINITION needs a ruling."""
    con = db()
    if con is None: return None
    BASE_TYPES = ("Cabinet","Console Base","Metal Base","Countertop Unit",
                  "Storage Cabinet","Drawer Unit","Floating Console")
    ph = ",".join("?" * len(BASE_TYPES))
    rows = con.execute(
        """SELECT m.sku, SUM(m.demand_min) AS d
             FROM jmv_daily_movement m
             JOIN jmv_dimensions dm ON dm.sku = m.sku
            WHERE m.is_valid = 1
              AND m.movement_date BETWEEN ? AND ?
              AND dm.top_finish IS NOT NULL AND dm.top_finish <> ''
              AND dm.product_type IN ('Vanity','Console','Countertop Unit',
                                      'Storage Cabinet','Drawer Unit')
              AND NOT EXISTS (
                    SELECT 1 FROM jmv_dimensions b
                     WHERE b.group_number IS dm.group_number
                       AND b.product_type IN (%s)
                       AND (b.top_finish IS NULL OR b.top_finish = ''))
            GROUP BY m.sku HAVING d > 0""" % ph, [*WIN, *BASE_TYPES]).fetchall()
    if not rows: return None
    detail = ", ".join("%s=%s" % (r[0], int(r[1])) for r in rows[:5])
    return ("combo-only SKU(s) now show demand: %s — definition §6 assumed "
            "zero. Revisit before shipping." % detail)
GATES.append(("G14 combo-only models still show zero demand (tripwire)", g14, None))


# ── run ──────────────────────────────────────────────────────────────
if DUMP and os.path.exists(DUMP) and not os.path.exists(DB):
    r = subprocess.run([sys.executable, os.environ.get("BVO_LOADER", "/dev/null"),
                        DUMP, DB], capture_output=True, text=True)
    if r.returncode != 0:
        print("  !! could not load the dump — executed gates will be skipped")
        print("     " + (r.stderr or "").strip().split("\n")[-1][:120])

if not os.path.exists(DB):
    print("  !! NOTE: no local DB — G2..G7 degrade to no-ops. Set BVO_DUMP")
    print("     and BVO_LOADER to run them for real.")

failed = 0
for name, fn, mut in GATES:
    err = fn()
    if err:
        print("  ✗ %s\n      %s" % (name, err)); failed += 1; continue
    print("  ✓ %s" % name)
    if mut:
        neg = mut()
        print("      negative: %s" % (neg if neg else
              "!! MUTANT PASSED — this gate proves nothing"))
        if not neg: failed += 1
    else:
        print("      negative: n/a — direct assertion")

print()
if failed:
    print("%d gate(s) failed — NOT committing." % failed); sys.exit(1)
print("All gates pass.")
PYEOF

BVO_DUMP="$DUMP" BVO_LOADER="$(pwd)/.gates.loader.py" python3 ./.gates.rev.py || {
  rm -f ./.gates.rev.py; exit 1; }
rm -f ./.gates.rev.py

echo
echo "──────────────────────────────────────────────────────────────"
echo " DIFF"
echo "──────────────────────────────────────────────────────────────"
git add "$CTRL" "$VIEW" "$ROLLUP" "$MIG" "$DEFN" .gitignore "$0"
git diff --cached --stat

git commit --dry-run -m "jmv financials: revenue = individual SKU x that day's MAP

Implements JMV_REVENUE_DEFINITION.md, approved 2026-09-10 and amended the
same day before build. That document is the artifact of record.

The old figure was built from combo_u — the Vanity SKU's own drawdown —
priced at combo MAP, with Cabinet and Top counted only for their excess
above it, pivoted to MAX per (group_number, movement_date). Three
independent defects:

  A combo SKU's quantity is min(base, top), a computed availability
  figure rather than stock. E444-V72-GW-3WZ logged 72 units across six
  observations while its base sat at 158, unmoved, every single day, and
  from 08-29 its quantity is identical to the top's. On 08-29 the Zeus
  White top fell 82->20 and every 72\" combo with base stock above 20 was
  clamped to 20: one top drawdown of 62 units manufactured 482 units of
  phantom demand across 51 SKUs.

  group_number is JM's SERIES code, the leading SKU token. Group 157 is
  309 SKUs across 7 sizes and 13 top finishes collapsed by MAX to one
  number per day, and zero of 71 groups hold both a Cabinet and a Top, so
  the dedup's premise was unreachable.

  On 08-29 Vanity showed 17,061 units against Cabinet's 120. Every real
  combo consumes a cabinet.

Now: per SKU, per day, depletion x that day's MAP price, summed. No
grouping, no cross-SKU subtraction, no inference about what was sold.

Combo rule reads JM's own column and needs BOTH halves: a SKU includes a
top, and is excluded, when it carries a top_finish AND its product_type
is one that ships assembled — Vanity, Console, Countertop Unit, Storage
Cabinet, Drawer Unit.

A product_type list alone was tried and rejected: it misses 76 assembled
Countertop Unit / Storage Cabinet / Drawer Unit SKUs, which ship in both
plain and with-top form.

top_finish alone was also tried, and got as far as the gate suite before
G14 caught it. A backsplash carries a top_finish because it is cut from
that stone, not because it contains a top — the rule silently deleted 245
units of backsplash demand, and would have deleted Tops and Floating
Consoles too on any narrower reading. Nothing on the page would have
shown it; the number would just have been smaller.

The rule also picks up the 13 Vanity-typed SKUs that are really cabinets,
with no allow-list, because they carry no top_finish.

Pricing is now per day rather than one snapshot applied backwards across
the window, with fallback MAP -> that day's MSRP x 0.66 -> current
products.compare_price x 0.66 -> excluded from BOTH revenue and units.
The old COALESCE(map_price, 0) booked unpriceable SKUs as units at \$0,
inflating Units Depleted against revenue with nothing on screen saying so.

Samples excluded. Scope 'all' now runs through the same predicates rather
than a second bolted-on query, which had been adding Console — a combo
type — back after the main query excluded it.

Measured on the six real observation days: \$8,957,392 old vs \$5,858,394
new, 35% of it phantom. Composition: Cabinet \$1,960,134 / Top
\$3,575,809 / Other \$322,451.

Also: migration 017 adds jmv_snapshots.msrp and the rollup captures it,
so the MSRP fallback becomes exact as history accrues instead of applying
one current value backwards.

Gates load the DB dump into SQLite and execute the controller's own SQL:
no combo contributes revenue; Tops still counted; the 91 assembled SKUs
excluded; solid stone pieces (backsplashes, tops, floating consoles)
still counted; the 13 mis-typed cabinets included by rule; samples
excluded; fallback order intact; unpriced rows dropped from both and
surfaced; three render paths carry every local; the view renders with no
retired labels.

G7 proves per-day pricing by perturbing DATA, not code — MAP prices are
near-static here, so a code-level swap to the latest snapshot produced an
identical total and the first version passed its own mutant. G14 is a
tripwire on the five combo-only models that read as zero.

Every gate negative-tested. Five were rewritten after their mutants
passed."

echo '[dry-run] would push'

echo
echo "──────────────────────────────────────────────────────────────"
echo " AFTER DEPLOY"
echo "──────────────────────────────────────────────────────────────"
cat <<'NOTE'
 1. Run migration 017 in phpMyAdmin (adds jmv_snapshots.msrp).
    Safe to re-run; it checks information_schema first.

 2. Existing snapshot rows keep msrp NULL and fall through to
    products.compare_price x 0.66. Tonight's rollup starts populating it.

 3. /admin/marketing/jmv/financials

    MAP Revenue drops roughly 35%. That is the correction, not a fault.
    Row 2 now reads: Units Depleted, Top 10, Cabinet Revenue, Top Revenue.
    "Combo vs Individual SKU" is now "Composition" — Cabinet / Top / Other.

 4. Sanity check: Cabinet Revenue + Top Revenue + Other should equal MAP
    Revenue exactly under "All types". If it does not, the cards and the
    KPI are on different bases.

 5. Steps 2 and 3 are NOT in this push. The Demand Reports leaderboards
    and demand_score / storefront popularity sorting still rank on
    combo-SKU movement.
NOTE
