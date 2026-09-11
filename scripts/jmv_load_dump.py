#!/usr/bin/env python3
"""Load the BVO MySQL dump into SQLite so the JMV SQL can be executed for real
rather than eyeballed.

Only the tables getFinancials touches. MySQL->SQLite differences that matter
here are handled by DATE_FORMAT / registered functions on the connection.
"""
import re, io, sys, sqlite3, os

DUMP = sys.argv[1]
OUT  = sys.argv[2]

# product_components carries the exact combo -> top edge (see
# JMV_CATALOGUE_STRUCTURE.md §0) and product_attribute_values carries depth,
# faucet spread and 45 other keys that are NOT on `products`. Both are
# required by scripts/jmv_scrub.py.
TABLES = ['jmv_dimensions', 'jmv_daily_movement', 'jmv_snapshots',
          'jmv_snapshot_validity', 'products',
          'product_components', 'product_attribute_values',
          # categories — the storefront queries join it to scope by c.slug,
          # so the bundle-builder gates cannot run without it.
          'categories',
          # inventory — qty_on_hand gates whether a top is offered at all.
          'inventory']

def columns(dump, t):
    grab, cols = False, []
    with io.open(dump, encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("CREATE TABLE `%s`" % t):
                grab = True; continue
            if grab:
                m = re.match(r"\s*`([A-Za-z_0-9]+)`", line)
                if m: cols.append(m.group(1))
                if line.startswith(")"): break
    return cols

def statements(dump, t):
    buf, grab = [], False
    with io.open(dump, encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("INSERT INTO `%s`" % t):
                grab = True; buf.append(line)
                if line.rstrip().endswith(";"):
                    yield "".join(buf); buf, grab = [], False
            elif grab:
                buf.append(line)
                if line.rstrip().endswith(";"):
                    yield "".join(buf); buf, grab = [], False

TUP = re.compile(r"\((?:[^()']|'(?:[^'\\]|\\.)*')*\)")

def rows(stmt):
    body = stmt[stmt.index("VALUES") + 6:]
    for m in TUP.finditer(body):
        s = m.group(0)[1:-1]
        out, cur, q, i = [], '', False, 0
        while i < len(s):
            c = s[i]
            if q:
                if c == "\\": cur += s[i:i+2]; i += 2; continue
                if c == "'": q = False
                cur += c
            else:
                if c == "'": q = True; cur += c
                elif c == ",": out.append(cur); cur = ''
                else: cur += c
            i += 1
        out.append(cur)
        vals = []
        for x in out:
            x = x.strip()
            if x == "NULL": vals.append(None)
            elif x.startswith("'"):
                vals.append(x[1:-1].replace("\\'", "'").replace('\\"', '"')
                                   .replace("\\\\", "\\"))
            else:
                try: vals.append(float(x) if '.' in x else int(x))
                except ValueError: vals.append(x)
        yield vals

if os.path.exists(OUT): os.remove(OUT)
con = sqlite3.connect(OUT)
for t in TABLES:
    cols = columns(DUMP, t)
    if not cols:
        print("  !! no CREATE TABLE for", t); continue
    # jmv_snapshots.msrp arrives with migration 017; the dump predates it, so
    # add the column empty. That is exactly the live state on day one and
    # exercises the products.compare_price fallback.
    if t == 'jmv_snapshots' and 'msrp' not in cols:
        cols.insert(cols.index('map_price') + 1, 'msrp')
    con.execute("CREATE TABLE %s (%s)" % (t, ",".join('"%s"' % c for c in cols)))
    ph = ",".join("?" * len(cols))
    n = 0
    for st in statements(DUMP, t):
        batch = []
        for r in rows(st):
            if t == 'jmv_snapshots' and len(r) == len(cols) - 1:
                r = r[:cols.index('msrp')] + [None] + r[cols.index('msrp'):]
            if len(r) != len(cols): continue
            batch.append(r)
        con.executemany("INSERT INTO %s VALUES (%s)" % (t, ph), batch)
        n += len(batch)
    print("  %-24s %6d rows  (%d cols)" % (t, n, len(cols)))
con.execute("CREATE INDEX ix_m ON jmv_daily_movement(sku, movement_date)")
con.execute("CREATE INDEX ix_s ON jmv_snapshots(sku, snapshot_date)")
con.execute("CREATE INDEX ix_d ON jmv_dimensions(sku)")
con.execute("CREATE INDEX ix_p ON products(sku)")
con.execute("CREATE INDEX ix_pc ON product_components(parent_sku, component_role)")
con.execute("CREATE INDEX ix_pav ON product_attribute_values(product_id, attr_key)")
con.commit(); con.close()
print("wrote", OUT)
