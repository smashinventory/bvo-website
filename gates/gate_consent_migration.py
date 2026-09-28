#!/usr/bin/env python3
"""Gate for db/2026-09-27_identity_and_consent.sql.

No MySQL/MariaDB is available in the sandbox (no root, no install), so
this does two things that catch real faults rather than imitating a
MariaDB parser:

  1. Structural checks on the paste path. Three migrations on
     2026-09-27 died between the chat window and the phpMyAdmin
     textarea: long lines carrying COMMENT string literals were chopped
     mid-literal. Line length, COMMENT clauses and quote parity are
     checked because those are the faults that actually occurred.

  2. Every DDL statement is extracted and RUN against a scratch SQLite
     database seeded with stand-in orders and customers tables. SQLite
     is not MariaDB, but ALTER TABLE ADD COLUMN and CREATE INDEX overlap
     enough that a typo, a bad type or a missing keyword fails here too
     - which is the class of error a hand-written migration has.

     The IF NOT EXISTS / IF EXISTS clauses are MariaDB 11.8.9 syntax
     (confirmed against the server by the address-intel migration that
     ran on the same day). SQLite does not accept them on ALTER TABLE,
     so they are stripped for the parse and asserted separately - never
     the column name, the type, or the presence of the statement.

What this does NOT prove: that MariaDB accepts the IF NOT EXISTS form
(asserted from the sibling migration that ran on this server), or that
these are the right columns. Those are read, not run.
"""

import os, re, sqlite3, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# migrations/ root with a _RUNME suffix is this repo's convention for
# date-named SQL run by hand in phpMyAdmin. database/migrations/ is the
# automated sequence (npm run migrate) and reads only its own directory,
# so nothing here is ever executed automatically - which matters,
# because section 3 drops a column.
SQL  = os.path.join(ROOT, 'migrations', '2026-09-27_identity_and_consent_RUNME.sql')

fail = 0
def ok(name, cond, detail=''):
    global fail
    print(('  ok   ' if cond else '  FAIL ') + name + ('' if cond else '   <- ' + str(detail)))
    if not cond: fail += 1

src   = open(SQL).read()
lines = src.split('\n')
code  = [l for l in lines if not l.strip().startswith('--')]

print('--- the paste path (how the last three died) ---')

longest = max(len(l) for l in lines)
ok('no line over 80 chars', longest <= 80, f'longest is {longest}')

ok('no COMMENT clauses in executable SQL',
   not any(re.search(r'\bCOMMENT\b', l, re.I) for l in code), 'found one')

odd = [(i + 1) for i, l in enumerate(lines)
       if not l.strip().startswith('--') and l.count("'") % 2 == 1]
ok('every executable line has balanced quotes', not odd,
   f'line {odd[0]}' if odd else '')

print('--- re-runnability ---')

alters = re.findall(r'ALTER TABLE \w+\s*\n?\s*(ADD COLUMN|DROP COLUMN)([^;]*)',
                    src, re.I)
adds  = [a for a in alters if a[0].upper() == 'ADD COLUMN']
drops = [a for a in alters if a[0].upper() == 'DROP COLUMN']

ok('ADD COLUMN statements found', len(adds) >= 9, f'found {len(adds)}')
unguarded_add = [a for a in adds if not re.search(r'IF NOT EXISTS', a[1], re.I)]
ok('every ADD COLUMN is IF NOT EXISTS', not unguarded_add,
   f'{len(unguarded_add)} unguarded: {[a[1][:40] for a in unguarded_add]}')

unguarded_drop = [d for d in drops if not re.search(r'IF EXISTS', d[1], re.I)]
ok('every DROP COLUMN is IF EXISTS', not unguarded_drop, 'unguarded drop')

ok('CREATE INDEX is IF NOT EXISTS',
   not re.search(r'CREATE INDEX(?! IF NOT EXISTS)', src, re.I), 'unguarded index')

ok('no PREPARE/EXECUTE scaffolding left over',
   'PREPARE stmt' not in src,
   'the information_schema guards were replaced by IF NOT EXISTS')

print('--- destructiveness ---')
dropped = re.findall(r'DROP COLUMN IF EXISTS (\w+)', src, re.I)
ok('exactly one destructive statement', len(dropped) == 1, f'{len(dropped)}: {dropped}')
ok('the only drop is password_hash', dropped == ['password_hash'], str(dropped))
ok('no DROP TABLE anywhere', not re.search(r'DROP TABLE', src, re.I), 'found one')
ok('no UPDATE or DELETE anywhere',
   not re.search(r'^\s*(UPDATE|DELETE)\b', src, re.I | re.M), 'found one')

print('--- DDL parsed for real (SQLite) ---')

db = sqlite3.connect(':memory:')
db.executescript("""
  CREATE TABLE orders (id INTEGER PRIMARY KEY, order_number TEXT, email TEXT);
  CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT,
                          first_name TEXT, last_name TEXT, phone TEXT,
                          password_hash TEXT, accepts_marketing INTEGER DEFAULT 0,
                          last_login_at TEXT, created_at TEXT);
""")

# Statements only; strip -- comment lines first so they cannot be spliced
# into a statement by the split on ';'.
body = '\n'.join(l for l in lines if not l.strip().startswith('--'))
stmts = [s.strip() for s in body.split(';') if s.strip()]
ran = 0
for stmt in stmts:
    if not re.match(r'(ALTER TABLE|CREATE INDEX)', stmt, re.I):
        continue          # SHOW COLUMNS is MariaDB-only; not a schema change
    # Dialect-only normalisation. Column names, types and the statement
    # itself are never touched.
    s = re.sub(r'\s+IF NOT EXISTS', '', stmt, flags=re.I)
    s = re.sub(r'\s+IF EXISTS', '', s, flags=re.I)
    s = re.sub(r'TINYINT\(1\)', 'INTEGER', s, flags=re.I)
    s = ' '.join(s.split())
    try:
        db.execute(s)
        ran += 1
        print(f'  ok   {s[:70]}')
    except Exception as e:
        ok(s[:60], False, e)

ok('every schema statement parsed', ran >= 10, f'only {ran} ran')

# SQLITE CANNOT CATCH A BAD TYPE NAME. It is dynamically typed: an
# unknown type simply gets NUMERIC affinity, so `VARCHR(20)` parses
# cleanly there and is rejected by MariaDB. A mutation test proved this
# gate blind to exactly that, so the types are checked against an
# allowlist instead of trusted to the parse.
KNOWN = {'INT', 'INTEGER', 'BIGINT', 'TINYINT', 'SMALLINT',
         'VARCHAR', 'CHAR', 'TEXT', 'DATETIME', 'DATE', 'TIMESTAMP',
         'DECIMAL', 'FLOAT', 'DOUBLE', 'JSON'}
declared = re.findall(r'ADD COLUMN IF NOT EXISTS \w+\s+([A-Za-z]+)', src, re.I)
bad = [t for t in declared if t.upper() not in KNOWN]
ok('every declared column type is a real MariaDB type', not bad, f'unknown: {bad}')
ok('found a type for every added column',
   len(declared) == len(adds), f'{len(declared)} types vs {len(adds)} columns')

print('--- resulting schema ---')
cols = {r[1] for r in db.execute('PRAGMA table_info(customers)')}
for c in ['marketing_consent_at', 'marketing_consent_source', 'marketing_consent_ip',
          'delivery_sms_consent', 'delivery_sms_consent_at',
          'delivery_sms_consent_source', 'delivery_sms_consent_ip',
          'consent_copy_version']:
    ok(f'customers.{c}', c in cols, 'not created')

ok('customers.password_hash is GONE', 'password_hash' not in cols, 'still present')
ok('customers.accepts_marketing survives', 'accepts_marketing' in cols,
   'the live flag was dropped')

ocols = {r[1] for r in db.execute('PRAGMA table_info(orders)')}
ok('orders.customer_id', 'customer_id' in ocols, 'not created')

idx = {r[1] for r in db.execute("PRAGMA index_list(orders)")}
ok('idx_orders_customer_id created', 'idx_orders_customer_id' in idx, str(idx))

print('--- the two consent channels stay separate ---')
ok('delivery SMS consent is its own column',
   'delivery_sms_consent' in cols and 'accepts_marketing' in cols, 'collapsed')
ok('delivery_sms_consent is NOT NULL DEFAULT 0',
   re.search(r'delivery_sms_consent TINYINT\(1\) NOT NULL DEFAULT 0', src) is not None,
   'a NULL-defaulting consent flag is not a consent record')
ok('marketing consent has when + source + ip',
   all(f'marketing_consent_{s}' in cols for s in ('at', 'source', 'ip')),
   'incomplete evidence')
ok('delivery consent has when + source + ip',
   all(f'delivery_sms_consent_{s}' in cols for s in ('at', 'source', 'ip')),
   'incomplete evidence')

print('--- verify block ---')
ok('file ends with a verification query',
   'SHOW COLUMNS FROM customers' in src and 'SHOW COLUMNS FROM orders' in src,
   'no way to confirm it ran')
ok('verification checks password_hash is gone',
   "'password_hash'" in src.split('VERIFY')[-1], 'not asserted')

print('\n*** %d GATE(S) FAILED ***' % fail if fail else '\nALL GATES PASS')
sys.exit(1 if fail else 0)
