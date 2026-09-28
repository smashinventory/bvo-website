'use strict';
/* Gates for the transactional blocklist: isBlocked / fetchBlockedContacts /
   unblockContact, the sign-in check, the admin panel and its route.

   brevoService is loaded FOR REAL here, with two modules stubbed at the
   loader: ../config/database (which hard-exits without DB_PASS) and axios
   (so no network call leaves this gate). That lets the caching and
   fail-open behaviour be exercised rather than grepped — those are the
   parts most likely to be wrong and least likely to be noticed. */

const Module = require('module');
const path   = require('path');
const fs     = require('fs');

const ROOT = path.join(__dirname, '..');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

/* ── stub loader ─────────────────────────────────────────────── */
let axiosStub;
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'axios') return axiosStub;
  if (request.indexOf('config/database') !== -1) return { bvoPool: { query: async () => [[]] } };
  return origLoad.apply(this, arguments);
};

function loadBrevo(stub) {
  axiosStub = stub;
  delete require.cache[require.resolve(path.join(ROOT, 'src/services/brevoService.js'))];
  return require(path.join(ROOT, 'src/services/brevoService.js'));
}

const mkStub = (over = {}) => Object.assign({
  get:    async () => ({ data: { contacts: [] } }),
  post:   async () => ({ status: 201, data: {} }),
  delete: async () => ({ status: 204 }),
}, over);

console.log('--- fetchBlockedContacts ---');
{
  process.env.BREVO_API_KEY = 'xkeysib-test';
  let calls = [];
  const b = loadBrevo(mkStub({
    get: async (url, cfg) => {
      calls.push(cfg.params.offset);
      /* Two full pages then a short one — proves paging continues and
         then stops. */
      const n = calls.length <= 2 ? 100 : 7;
      return { data: { contacts: Array.from({ length: n },
        (_, i) => ({ email: `u${cfg.params.offset + i}@x.com` })) } };
    },
  }));
  (async () => {
    const r = await b.fetchBlockedContacts();
    ok('pages until a short page', r.ok && r.contacts.length === 207,
       'got ' + (r.contacts || []).length);
    ok('offsets advance by page size', calls.join(',') === '0,100,200', calls.join(','));
    ok('not marked partial when it ended naturally', r.partial === false, String(r.partial));
    await stage2();
  })();
}

async function stage2() {
  console.log('--- fetchBlockedContacts: caps ---');
  {
    const b = loadBrevo(mkStub({
      get: async (url, cfg) => ({ data: { contacts: Array.from({ length: 100 },
        (_, i) => ({ email: `u${cfg.params.offset + i}@x.com` })) } }),
    }));
    const r = await b.fetchBlockedContacts();
    ok('stops at the page cap', r.ok && r.contacts.length === 2000,
       'got ' + (r.contacts || []).length);
    ok('marks the result partial at the cap', r.partial === true, String(r.partial));
  }

  console.log('--- isBlocked ---');
  {
    const b = loadBrevo(mkStub({
      get: async () => ({ data: { contacts: [{ email: 'Blocked@Example.COM' }] } }),
    }));
    ok('finds a blocked address', await b.isBlocked('blocked@example.com') === true, 'false');
    ok('case-insensitive on the stored side',
       await b.isBlocked('BLOCKED@EXAMPLE.COM') === true, 'false');
    ok('clean address is not blocked',
       await b.isBlocked('someone@example.com') === false, 'true');
    ok('empty address is not blocked', await b.isBlocked('') === false, 'true');
  }

  console.log('--- isBlocked: caching ---');
  {
    let hits = 0;
    const b = loadBrevo(mkStub({
      get: async () => { hits++; return { data: { contacts: [{ email: 'a@x.com' }] } }; },
    }));
    await b.isBlocked('a@x.com');
    await b.isBlocked('b@x.com');
    await b.isBlocked('c@x.com');
    ok('three checks cost ONE fetch', hits === 1, hits + ' fetches');
    b.clearBlocklistCache();
    await b.isBlocked('a@x.com');
    ok('clearBlocklistCache forces a refetch', hits === 2, hits + ' fetches');
  }

  console.log('--- isBlocked: FAILS OPEN ---');
  {
    const b = loadBrevo(mkStub({ get: async () => { throw new Error('ECONNREFUSED'); } }));
    ok('network failure -> not blocked',
       await b.isBlocked('anyone@example.com') === false, 'true');
  }
  {
    const b = loadBrevo(mkStub({
      get: async () => { const e = new Error('401'); e.response = { status: 401, data: {} }; throw e; },
    }));
    ok('401 -> not blocked', await b.isBlocked('anyone@example.com') === false, 'true');
  }
  {
    const saved = process.env.BREVO_API_KEY;
    delete process.env.BREVO_API_KEY;
    const b = loadBrevo(mkStub());
    ok('no API key -> not blocked', await b.isBlocked('anyone@example.com') === false, 'true');
    process.env.BREVO_API_KEY = saved;
  }

  console.log('--- unblockContact ---');
  {
    let seen = null;
    const b = loadBrevo(mkStub({ delete: async (url) => { seen = url; return { status: 204 }; } }));
    const r = await b.unblockContact('a+tag@example.com');
    ok('returns ok', r.ok === true, JSON.stringify(r));
    /* A '+' is legal in an address and would arrive decoded as a space
       if the path segment were not encoded. */
    ok('URL-encodes the address', seen.indexOf('a%2Btag%40example.com') !== -1, seen);
    ok('hits the blockedContacts endpoint',
       seen.indexOf('/v3/smtp/blockedContacts/') !== -1, seen);
  }
  {
    const b = loadBrevo(mkStub({
      delete: async () => { const e = new Error('nf'); e.response = { status: 404, data: { message: 'not found' } }; throw e; },
    }));
    const r = await b.unblockContact('ghost@example.com');
    ok('404 surfaces as status 404, not a throw', r.ok === false && r.status === 404,
       JSON.stringify(r));
  }
  {
    let gets = 0;
    const b = loadBrevo(mkStub({
      get: async () => { gets++; return { data: { contacts: [{ email: 'a@x.com' }] } }; },
      delete: async () => ({ status: 204 }),
    }));
    await b.isBlocked('a@x.com');
    await b.unblockContact('a@x.com');
    await b.isBlocked('a@x.com');
    ok('a successful unblock invalidates the cache', gets === 2, gets + ' fetches');
  }

  Module._load = origLoad;
  stage3();
}

function stage3() {
  console.log('--- sign-in check ---');
  const ac = fs.readFileSync(path.join(ROOT, 'src/controllers/accountController.js'), 'utf8');
  try { new (require('vm').Script)(ac); ok('accountController parses', true); }
  catch (e) { ok('accountController parses', false, e.message); }

  /* Strip comments before computing statement order, or prose mentioning
     issueCode inside the explanatory block would decide the answer. */
  const acCode = ac.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const iBlocked = acCode.indexOf('brevo.isBlocked(');
  const iIssue   = acCode.indexOf('authCode.issueCode(');
  ok('isBlocked is called', iBlocked !== -1, 'not found');
  ok('isBlocked runs BEFORE issueCode (no wasted rate-limit slot)',
     iBlocked !== -1 && iIssue !== -1 && iBlocked < iIssue,
     'blocked@' + iBlocked + ' issue@' + iIssue);
  ok('blocked path returns 403', /status\(403\)[\s\S]{0,120}CODE_ERRORS\.blocked/.test(acCode),
     'no 403 with the blocked message');
  ok('a blocked-message string exists', /blocked:\s*'/.test(ac), 'missing');
  ok('the blocked message names a way back',
     /CODE_ERRORS[\s\S]*?blocked:[^\n]*(call us|Call us)/i.test(ac),
     'no recovery route offered to the customer');

  console.log('--- route + controller ---');
  const rt = fs.readFileSync(path.join(ROOT, 'src/routes/admin.js'), 'utf8');
  ok('unblock route registered',
     /router\.post\(\s*'\/diagnostics\/email\/unblock'/.test(rt), 'missing');
  ok('unblock is POST, never GET',
     !/router\.get\([^\n]*diagnostics\/email\/unblock/.test(rt), 'GET route present');

  const dg = fs.readFileSync(path.join(ROOT, 'src/controllers/emailDiagnosticsController.js'), 'utf8');
  try { new (require('vm').Script)(dg); ok('diagnostics controller parses', true); }
  catch (e) { ok('diagnostics controller parses', false, e.message); }
  ok('exports.unblock exists', /exports\.unblock\s*=/.test(dg), 'missing');
  ok('unblock validates the address', /test\(email\)/.test(dg), 'no validation');
  ok('page passes blocked to the view', /blocked,/.test(dg), 'missing');
  ok('page clears the cache so the admin sees fresh data',
     /clearBlocklistCache\(\)/.test(dg), 'missing');

  console.log('--- view ---');
  const v = fs.readFileSync(path.join(ROOT, 'views/pages/admin/diagnostics-email.ejs'), 'utf8');
  ok('section 5 present', /5 · Blocked/.test(v), 'missing');
  ok('handles no-key state',      /if \(!blocked\)/.test(v), 'missing');
  ok('handles fetch-failed state', /blocked\.ok/.test(v), 'missing');
  ok('handles empty state',       /!blocked\.contacts\.length/.test(v), 'missing');
  ok('handles truncated state',   /blocked\.partial/.test(v), 'missing');
  ok('unblock form carries CSRF',
     /action="\/admin\/diagnostics\/email\/unblock"[\s\S]{0,200}name="_csrf"/.test(v),
     'no CSRF token in the unblock form');
  ok('unblock form posts the address',
     /action="\/admin\/diagnostics\/email\/unblock"[\s\S]{0,300}name="email"/.test(v),
     'no email field');
  ok('unblock result is rendered', /unblockResult/.test(v), 'missing');

  console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
  process.exit(fail ? 1 : 0);
}
