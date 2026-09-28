#!/usr/bin/env python3
"""Gate for migrations/2026-09-28_customer_addresses_RUNME.sql.

Same approach as gate_consent_migration.py: structural checks on the
paste path, then every DDL statement RUN against a scratch SQLite
database seeded with the REAL table definition lifted out of
001_initial_schema.sql.

Seeding from the real initial schema matters. This migration's whole
premise is that the table already exists with a specific shape; a
fixture inventing that shape could not catch a collision with a column
that is already there.
"""

import os, re, sqlite3, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQL  = os.path.join(ROOT, 'migrations', '2026-09-28_customer_addresses_RUNME.sql')
INIT = os.path.join(ROOT, 'database', 'migrations', '001_initial_schema.sql')

fail = 0
def ok(name, cond, detail=''):
    global fail
    print(('  ok   ' if cond else '  FAIL ') + name + ('' if cond else '   <- ' + str(detail)))
    if not cond: fail += 1

src   = open(SQL).read()
lines = src.split('\n')
code  = [l for l in lines if not l.strip().startswith('--')]

print('--- the paste path ---')
longest = max(len(l) for l in lines)
ok('no line over 80 chars', longest <= 80, f'longest is {longest}')
ok('no COMMENT clauses in executable SQL',
   not any(re.search(r'\bCOMMENT\b', l, re.I) for l in code), 'found one')
odd = [i + 1 for i, l in enumerate(lines)
       if not l.strip().startswith('--') and l.count("'") % 2 == 1]
ok('every executable line has balanced quotes', not odd, f'line {odd[0]}' if odd else '')

print('--- it is an ALTER, not a CREATE ---')
# EXECUTABLE lines only. The phrase "CREATE TABLE" appears in this
# file's own warning text, and scanning raw `src` flagged the warning
# as the thing it warns against. Same class of bug as scanning comments
# for quote parity - fixed there first, missed here.
exec_sql = '\n'.join(code)
ok('NO CREATE TABLE statement',
   not re.search(r'CREATE TABLE', exec_sql, re.I),
   'the table already exists - this is the email_templates mistake')
ok('the near-miss is recorded in the file',
   'email_templates' in src and 'GREP THE INITIAL SCHEMA' in src,
   'the warning is not written down')

print('--- re-runnability ---')
adds = re.findall(r'ADD COLUMN([^;]*)', src, re.I)
ok('ADD COLUMN statements found', len(adds) >= 12, f'found {len(adds)}')
unguarded = [a for a in adds if not re.search(r'IF NOT EXISTS', a, re.I)]
ok('every ADD COLUMN is IF NOT EXISTS', not unguarded, f'{len(unguarded)} unguarded')
ok('the unique index is IF NOT EXISTS',
   re.search(r'CREATE UNIQUE INDEX IF NOT EXISTS', src, re.I) is not None, 'unguarded')

print('--- nothing destructive ---')
# Again: executable lines only. `ON DUPLICATE KEY UPDATE` is documented
# in a comment as the intended write path, which is not an UPDATE
# statement in this file.
for bad in ['DROP TABLE', 'DROP COLUMN', 'TRUNCATE', 'DELETE FROM', 'UPDATE']:
    ok(f'no {bad} statement',
       not re.search(r'\b' + bad.replace(' ', r'\s+') + r'\b', exec_sql, re.I),
       'found one')

print('--- declared types are real MariaDB types ---')
KNOWN = {'INT','INTEGER','BIGINT','TINYINT','SMALLINT','VARCHAR','CHAR','TEXT',
         'DATETIME','DATE','TIMESTAMP','DECIMAL','FLOAT','DOUBLE','JSON','ENUM'}
declared = re.findall(r'ADD COLUMN IF NOT EXISTS \w+\s+([A-Za-z]+)', src, re.I)
bad = [t for t in declared if t.upper() not in KNOWN]
ok('every type is known', not bad, f'unknown: {bad}')
ok('a type for every added column', len(declared) == len(adds),
   f'{len(declared)} types vs {len(adds)} columns')

print('--- run it against the REAL initial-schema table ---')
init = open(INIT).read()
m = re.search(r'CREATE TABLE IF NOT EXISTS customer_addresses \((.*?)\n\) ENGINE',
              init, re.S)
ok('found customer_addresses in 001_initial_schema.sql', m is not None, 'not found')
if not m:
    print('\n*** cannot continue ***'); sys.exit(1)

body = m.group(1)
# Strip MySQL-only clauses SQLite will not parse; keep every column.
body = re.sub(r',\s*\n\s*CONSTRAINT[^\n]*', '', body)
body = re.sub(r',\s*\n\s*KEY[^\n]*', '', body)
body = re.sub(r',\s*\n\s*PRIMARY KEY \(id\)', '', body)
body = body.replace('INT UNSIGNED  NOT NULL AUTO_INCREMENT', 'INTEGER PRIMARY KEY')
body = re.sub(r'INT UNSIGNED', 'INTEGER', body)
body = re.sub(r'TINYINT\(1\)', 'INTEGER', body)

db = sqlite3.connect(':memory:')
db.execute(f'CREATE TABLE customer_addresses ({body})')
existing = {r[1] for r in db.execute('PRAGMA table_info(customer_addresses)')}
ok('seeded with the real column set', 'is_default' in existing and 'address1' in existing,
   str(sorted(existing)))

ran = 0
stmts = [s.strip() for s in
         '\n'.join(l for l in lines if not l.strip().startswith('--')).split(';')
         if s.strip()]
for stmt in stmts:
    if not re.match(r'(ALTER TABLE|CREATE UNIQUE INDEX)', stmt, re.I):
        continue
    s = re.sub(r'\s+IF NOT EXISTS', '', stmt, flags=re.I)
    s = re.sub(r"ENUM\([^)]*\)", 'TEXT', s, flags=re.I)
    s = re.sub(r'INT UNSIGNED', 'INTEGER', s, flags=re.I)
    s = ' '.join(s.split())
    try:
        db.execute(s); ran += 1
    except Exception as e:
        ok(s[:64], False, e)
ok('every statement applied', ran >= 13, f'only {ran} ran')

print('--- resulting schema ---')
cols = {r[1] for r in db.execute('PRAGMA table_info(customer_addresses)')}
for c in ['kind','address_key','place_id','formatted_address','phone_ext',
          'address_type','lat','lng','validation_verdict','usps_dpv',
          'last_used_at','times_used']:
    ok(f'added {c}', c in cols, 'not created')
for c in ['id','customer_id','is_default','address1','city','state','zip','country']:
    ok(f'kept  {c}', c in cols, 'the original column was lost')

idx = {r[1] for r in db.execute('PRAGMA index_list(customer_addresses)')}
ok('unique key created', 'uniq_addr_customer_kind_key' in idx, str(idx))

print('--- the upsert actually dedups ---')
# The whole point of the unique key: a second checkout to the same
# address must UPDATE, not insert a second row. Without it the velocity
# count counts ORDERS, not distinct ADDRESSES.
for _ in range(3):
    db.execute("""INSERT INTO customer_addresses
        (customer_id, kind, address_key, address1, city, state, zip, times_used)
        VALUES (1,'shipping','abc123','1 Main St','Marietta','GA','30060',1)
        ON CONFLICT(customer_id, kind, address_key)
        DO UPDATE SET times_used = times_used + 1""")
n = db.execute('SELECT COUNT(*) FROM customer_addresses').fetchone()[0]
t = db.execute('SELECT times_used FROM customer_addresses').fetchone()[0]
ok('three checkouts to one address = ONE row', n == 1, f'{n} rows')
ok('times_used incremented to 3', t == 3, f'times_used={t}')

db.execute("""INSERT INTO customer_addresses
    (customer_id, kind, address_key, address1, city, state, zip, times_used)
    VALUES (1,'shipping','def456','2 Oak Ave','Alpharetta','GA','30004',1)""")
db.execute("""INSERT INTO customer_addresses
    (customer_id, kind, address_key, address1, city, state, zip, times_used)
    VALUES (1,'billing','abc123','1 Main St','Marietta','GA','30060',1)""")
n = db.execute("SELECT COUNT(*) FROM customer_addresses WHERE kind='shipping'").fetchone()[0]
ok('a DIFFERENT address is a new row', n == 2, f'{n} shipping rows')
tot = db.execute('SELECT COUNT(*) FROM customer_addresses').fetchone()[0]
ok('same key, different kind, coexists', tot == 3, f'{tot} rows')

print('--- the velocity query runs ---')
db.execute("UPDATE customer_addresses SET last_used_at = datetime('now')")
rows = db.execute("""
  SELECT customer_id, COUNT(*) AS distinct_ship_tos
    FROM customer_addresses
   WHERE kind = 'shipping' AND last_used_at > datetime('now','-90 day')
   GROUP BY customer_id HAVING distinct_ship_tos >= 2""").fetchall()
ok('velocity query returns the customer', rows == [(1, 2)], str(rows))

print('--- the FK stays CASCADE, and orders stays unconstrained ---')
ok('initial schema still has ON DELETE CASCADE here',
   'ON DELETE CASCADE' in m.group(0), 'the FK changed')
ok('the migration does not touch the FK',
   not re.search(r'FOREIGN KEY|DROP CONSTRAINT', src, re.I), 'it does')

print(f'\n*** {fail} GATE(S) FAILED ***' if fail else '\nALL GATES PASS')
sys.exit(1 if fail else 0)
