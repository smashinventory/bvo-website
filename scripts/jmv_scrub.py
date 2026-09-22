#!/usr/bin/env python3
"""JMV catalogue scrub — build the exact combo -> top / combo -> base edge map.

WHY THIS EXISTS
---------------
The combo demand estimator originally INFERRED which top a combo used, by
joining on (top_finish, top_material, size_nominal, sinks). That key is not
unique — 41 of 127 keys match more than one top family — so three business
rules were bolted on to disambiguate it (RC collections, Linear composite,
top families). All of that is unnecessary: `product_components` already holds
the exact combo -> top edge for 4,198 of 4,199 JM combos, straight from the
vendor feed. Nothing in the app reads it.

This script resolves that table into the movement keyspace and reports every
exception, so the estimator can be rebuilt on facts instead of inference.

Run:  python3 scripts/jmv_scrub.py <sqlite-db>
      (build the db with scripts/jmv_load_dump.py from the nightly dump)

See JMV_CATALOGUE_STRUCTURE.md for what every finding means.
"""
import sys, sqlite3, collections, json

DB = sys.argv[1] if len(sys.argv) > 1 else "/tmp/bvo_cw.sqlite"
CUTOFF = sys.argv[2] if len(sys.argv) > 2 else "2026-08-01"

con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
out = {}

def rule(msg): print("\n" + msg + "\n" + "-" * len(msg))

# ─────────────────────────────────────────────────────────────────────
# 1. Resolve component_sku -> jmv_dimensions.sku
#
# The feed writes component SKUs in an abbreviated form. Three transforms
# cover all 194, and each one is a SHAPE difference, not a guess:
#   exact            050-S48-FP-TJR  is already a dimensions key
#   + '-SNK'         050-S30-EJP     -> 050-S30-EJP-SNK   (sink suffix dropped)
#   + '-BS-'         051-S36-WZ      -> 051-S36-BS-WZ     (backsplash token dropped)
#   S46 -> S46R      090-S46-CAR     -> 090-S46R-CAR-SNK  (radius token dropped)
# Anything that needs a fourth transform is reported, never guessed.
# ─────────────────────────────────────────────────────────────────────
dims = {r[0] for r in con.execute("SELECT sku FROM jmv_dimensions")}

def resolve(sku):
    if sku in dims:                              return sku, "exact"
    if sku + "-SNK" in dims:                     return sku + "-SNK", "+SNK"
    parts = sku.split("-")
    if len(parts) >= 3:                          # 051-S36-WZ -> 051-S36-BS-WZ
        bs = "-".join(parts[:2] + ["BS"] + parts[2:])
        if bs in dims:                           return bs, "+BS"
    r = sku.replace("-S46-", "-S46R-")           # 090-S46-CAR -> 090-S46R-CAR
    if r in dims:                                return r, "S46->S46R"
    if r + "-SNK" in dims:                       return r + "-SNK", "S46->S46R +SNK"
    return None, "UNRESOLVED"

comp = con.execute("""SELECT DISTINCT component_sku FROM product_components
                       WHERE component_role='top'""").fetchall()
resolved, how, unresolved = {}, collections.Counter(), []
for (cs,) in comp:
    r, kind = resolve(cs)
    how[kind] += 1
    if r: resolved[cs] = r
    else: unresolved.append(cs)

rule("1. component_sku -> jmv_dimensions")
print("  distinct top components : %d" % len(comp))
for k, v in how.most_common(): print("    %-16s %3d" % (k, v))
print("  UNRESOLVED              : %d %s" % (len(unresolved), unresolved or ""))
out["resolver"] = {"total": len(comp), "by_rule": dict(how), "unresolved": unresolved}
assert not unresolved, "resolver incomplete — fix before trusting anything downstream"

# ─────────────────────────────────────────────────────────────────────
# 2. Edge table: combo -> top (exact), combo -> base (still inferred).
#
# There is no 'cabinet' role in product_components, so the base is still
# resolved on collection + base_finish + size_nominal. sinks is DELIBERATELY
# excluded: a cabinet carries sinks=0 and its combo sinks=1, so including it
# matches zero of 4,199.
# ─────────────────────────────────────────────────────────────────────
con.execute("DROP TABLE IF EXISTS jmv_edges")
con.execute("""CREATE TABLE jmv_edges(
     combo_sku TEXT PRIMARY KEY, top_sku TEXT, base_key TEXT,
     collection TEXT, base_finish TEXT, size_nominal REAL,
     combo_u REAL, top_u REAL, base_u REAL, clamped INT)""")

combos = con.execute("""SELECT d.sku, d.collection, d.base_finish, d.size_nominal
                          FROM jmv_dimensions d
                         WHERE d.product_type='Vanity'
                           AND d.top_finish IS NOT NULL AND d.top_finish<>''""").fetchall()
edges_raw = collections.defaultdict(list)
for r in con.execute("""SELECT parent_sku, component_sku FROM product_components
                         WHERE component_role='top'"""):
    edges_raw[r[0]].append(r[1])

def units(sku_list):
    if not sku_list: return 0.0
    q = ",".join("?" * len(sku_list))
    v = con.execute("""SELECT COALESCE(SUM(demand_min),0) FROM jmv_daily_movement
                        WHERE is_valid=1 AND movement_date>=? AND sku IN (%s)""" % q,
                    [CUTOFF, *sku_list]).fetchone()[0]
    return float(v or 0)

base_units = {}
for r in con.execute("""SELECT b.collection, b.base_finish, b.size_nominal,
                               COALESCE(SUM(m.demand_min),0) u
                          FROM jmv_dimensions b
                          JOIN jmv_daily_movement m ON m.sku=b.sku
                         WHERE m.is_valid=1 AND m.movement_date>=?
                           AND b.product_type='Cabinet'
                         GROUP BY 1,2,3""", [CUTOFF]):
    base_units[(r[0], r[1], r[2])] = float(r[3])

no_top, no_base, multi_top, rows = [], [], [], []
for cb in combos:
    sku = cb["sku"]
    tops = [resolved[t] for t in edges_raw.get(sku, []) if t in resolved]
    if not tops: no_top.append(sku)
    if len(tops) > 1: multi_top.append(sku)
    bkey = (cb["collection"], cb["base_finish"], cb["size_nominal"])
    if bkey not in base_units: no_base.append(sku)
    rows.append((sku, tops[0] if tops else None, "|".join(str(x) for x in bkey),
                 cb["collection"], cb["base_finish"], cb["size_nominal"],
                 units([sku]), units(tops), base_units.get(bkey, 0.0), 0))
con.executemany("INSERT INTO jmv_edges VALUES (?,?,?,?,?,?,?,?,?,?)", rows)
con.commit()

rule("2. edge coverage")
print("  combos in jmv_dimensions : %d" % len(combos))
print("  with an exact top edge   : %d" % (len(combos) - len(no_top)))
print("  NO top edge              : %d  %s" % (len(no_top), no_top[:5]))
print("  more than one top        : %d  %s" % (len(multi_top), multi_top[:5]))
print("  base unresolved          : %d" % len(no_base))
out["edges"] = {"combos": len(combos), "with_top": len(combos) - len(no_top),
                "no_top": no_top, "multi_top": multi_top, "no_base": len(no_base)}

# ─────────────────────────────────────────────────────────────────────
# 3. Clamp detection.
#
# A combo's quantity is min(base, top) — availability, not stock. When the TOP
# is the binding constraint, every combo sharing that top shows the SAME
# drawdown, equal to the top's own. Those numbers are one fact repeated, not
# N sales, and must not be used as mix weights.
#
# Flag clamped when: combo_u > 0, combo_u == top_u, and at least one OTHER
# combo on the same top shows the identical figure. The sibling test is what
# separates a real clamp from a combo that merely happens to match.
# ─────────────────────────────────────────────────────────────────────
by_top = collections.defaultdict(list)
for r in con.execute("SELECT combo_sku, top_sku, combo_u, top_u FROM jmv_edges WHERE top_sku IS NOT NULL"):
    by_top[r[1]].append(r)

clamped = []
for top, group in by_top.items():
    for r in group:
        if r[2] <= 0 or r[2] != r[3]: continue
        if sum(1 for o in group if o[2] == r[2]) > 1:
            clamped.append(r[0])
con.executemany("UPDATE jmv_edges SET clamped=1 WHERE combo_sku=?", [(s,) for s in clamped])
con.commit()

moved = con.execute("SELECT COUNT(*) FROM jmv_edges WHERE combo_u>0").fetchone()[0]
rule("3. clamped vs usable")
print("  combos with movement     : %d" % moved)
print("  clamped (unusable as mix): %d  (%.0f%% of movers)" % (len(clamped), 100*len(clamped)/moved if moved else 0))
print("  usable mix signal        : %d" % (moved - len(clamped)))
out["clamp"] = {"movers": moved, "clamped": len(clamped), "usable": moved - len(clamped)}

print("\n  worst offenders — one top's number repeated across combos:")
for top, n in collections.Counter(
        r[1] for r in con.execute("SELECT combo_sku,top_sku FROM jmv_edges WHERE clamped=1")).most_common(8):
    print("    %-24s %3d combos" % (top, n))

# ─────────────────────────────────────────────────────────────────────
# 4. Top drawdown attributed over REAL edges, not inferred ones.
# ─────────────────────────────────────────────────────────────────────
rule("4. top drawdown vs the combos that actually use it")
print("  %-26s %7s %7s %6s" % ("top", "top_u", "combo_u", "combos"))
for r in con.execute("""SELECT top_sku, MAX(top_u) tu, SUM(combo_u) cu, COUNT(*) n
                          FROM jmv_edges WHERE top_sku IS NOT NULL
                         GROUP BY top_sku ORDER BY tu DESC LIMIT 12"""):
    print("  %-26s %7.0f %7.0f %6d" % (r[0], r[1], r[2], r[3]))

# ─────────────────────────────────────────────────────────────────────
# 5. Is combo drawdown usable as a MIX WEIGHT between siblings on one base?
#
# The proposal: rather than splitting a base's demand across its tops in
# proportion to each top's TOTAL drawdown, use the siblings' own combo
# drawdown, which is specific to that base.
#
# The hazard: combo qty = min(base, top), so a combo moves when EITHER half
# moves. Siblings share a base, so the base component is common to them and
# cancels — but only if neither sibling's top is itself binding. Where a top
# binds, that sibling reports its top's availability instead of its own mix.
#
# A base group is CLEAN when every sibling's top drew down materially more
# than the combo did (top not binding). Otherwise the comparison is polluted.
# ─────────────────────────────────────────────────────────────────────
rule("5. can sibling combo drawdown be used as a mix weight?")
groups = collections.defaultdict(list)
for r in con.execute("""SELECT base_key, combo_sku, top_sku, combo_u, top_u, base_u
                          FROM jmv_edges WHERE top_sku IS NOT NULL"""):
    groups[r[0]].append(r)

clean = polluted = single = idle = 0
HEADROOM = 1.5          # a top must have moved 1.5x the combo to be non-binding
for bk, g in groups.items():
    movers = [r for r in g if r[3] > 0]
    if not movers: idle += 1; continue
    if len(movers) == 1: single += 1; continue
    if all(r[4] >= r[3] * HEADROOM for r in movers): clean += 1
    else: polluted += 1
tot = clean + polluted + single + idle
print("  base groups                 : %d" % tot)
print("    clean  (mix usable)       : %d  (%.0f%%)" % (clean, 100*clean/tot))
print("    polluted (a top binds)    : %d  (%.0f%%)" % (polluted, 100*polluted/tot))
print("    only one sibling moved    : %d" % single)
print("    no movement               : %d" % idle)
out["mix"] = {"groups": tot, "clean": clean, "polluted": polluted,
              "single": single, "idle": idle}

print("\n  conservation check — combo drawdown summed vs the top's own:")
r = con.execute("""SELECT SUM(combo_u), SUM(DISTINCT 0) FROM jmv_edges""").fetchone()
tops_total = con.execute("""SELECT SUM(tu) FROM (SELECT MAX(top_u) tu FROM jmv_edges
                             WHERE top_sku IS NOT NULL GROUP BY top_sku)""").fetchone()[0] or 0
combo_total = con.execute("SELECT COALESCE(SUM(combo_u),0) FROM jmv_edges").fetchone()[0]
print("    combo drawdown total : %.0f" % combo_total)
print("    top   drawdown total : %.0f" % tops_total)
print("    inflation            : %.1fx" % (combo_total/tops_total if tops_total else 0))
out["inflation"] = {"combo_total": combo_total, "top_total": tops_total}

json.dump(out, open("jmv_scrub_report.json", "w"), indent=2)
print("\nwrote jmv_scrub_report.json  ·  table jmv_edges populated in", DB)
