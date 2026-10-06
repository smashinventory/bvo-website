'use strict';
/* Gates for item 26 — "Remember this device", the skip-the-code path,
 * the new-device notification and "Secure my account".
 *
 * deviceService is loaded with ../config/database stubbed, so the real
 * exported functions run and the SQL shape is asserted without a live
 * DB. deviceLabel is a pure module and is exercised directly.
 *
 * The two assertions that matter most, because this token signs people
 * in without an email:
 *   1. the RAW token is never stored
 *   2. the cookie is bound to ONE customer id, inside the WHERE
 */

const Module = require('module');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const deviceLabel = require(path.join(ROOT, 'src/utils/deviceLabel'));

console.log('--- deviceLabel: coarse, and a CLOSED vocabulary ---');
const UAS = [
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', 'iPhone (Web)'],
  ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari',          'iPad (Web)'],
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome',               'Android device (Web)'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome',        'Mac (Web)'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome',              'Windows PC (Web)'],
  ['Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome',               'Chromebook (Web)'],
  ['Mozilla/5.0 (X11; Linux x86_64) Firefox',                       'Linux computer (Web)'],
];
UAS.forEach(([ua, want]) => ok(`${want.padEnd(22)} from its UA`, deviceLabel(ua) === want,
                               deviceLabel(ua)));

/* Ordering traps: iPadOS says "Macintosh" in desktop mode and Android
   says "Linux". The specific rule has to win. */
ok('Android beats the Linux rule',
   deviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome') === 'Android device (Web)',
   deviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome'));
ok('iPhone beats the Mac rule',
   deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)') === 'iPhone (Web)',
   deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'));

console.log('    (a closed vocabulary — no passthrough)');
const weird = 'SomeNewBrowser/9 (Holodeck; build 42.7.1; serial ABC-123)';
ok('unknown UA becomes "Unknown device"', deviceLabel(weird) === 'Unknown device',
   deviceLabel(weird));
ok('the raw UA does NOT leak into the label',
   !deviceLabel(weird).includes('Holodeck') && !deviceLabel(weird).includes('ABC-123'),
   deviceLabel(weird));
ok('empty UA is handled', deviceLabel('') === 'Unknown device', deviceLabel(''));
ok('undefined UA is handled', deviceLabel() === 'Unknown device', String(deviceLabel()));
ok('no label exceeds the 40-char column',
   UAS.every(([, w]) => w.length <= 40) && 'Unknown device'.length <= 40, 'too long');
ok('no version numbers in any label',
   UAS.every(([, w]) => !/\d/.test(w)), 'a version number is a fingerprint');

console.log('--- deviceService: the token is never stored raw ---');
const queries = [];
const cookies = [];
const origLoad = Module._load;
Module._load = function (request) {
  if (request.indexOf('config/database') !== -1) {
    return { bvoPool: { query: async (sql, params) => {
      queries.push({ sql, params }); return [[]];
    } } };
  }
  return origLoad.apply(this, arguments);
};
const device = require(path.join(ROOT, 'src/services/deviceService'));

(async () => {
  const res = { cookie: (n, v, o) => cookies.push({ n, v, o }),
                clearCookie: (n, o) => cookies.push({ n, cleared: true, o }) };

  await device.remember(res, 42, { userAgent: UAS[3][0], ip: '1.2.3.4' });
  const ins = queries[0];
  const set = cookies[0];
  ok('a row was inserted', !!ins, 'nothing ran');
  ok('a cookie was set', !!set, 'no cookie');

  const raw = set.v;
  ok('the cookie value is 64 hex (256 bits)', /^[0-9a-f]{64}$/.test(raw), raw);

  /* THE assertion. If the raw token appears in the INSERT params, a
     leaked table is a set of live logins. */
  ok('the RAW token is NOT in the insert params',
     !ins.params.some(p => String(p) === raw),
     'a leaked customer_devices table would be a set of live sign-ins');
  ok('the stored value is sha256 of the token',
     ins.params.includes(crypto.createHash('sha256').update(raw).digest('hex')),
     'not the expected hash');

  console.log('    (cookie flags — this is a bearer credential)');
  ok('httpOnly', set.o.httpOnly === true, 'JS could read a login token');
  ok('sameSite lax', set.o.sameSite === 'lax',
     'strict would drop the cookie returning from Stripe');
  ok('path /', set.o.path === '/', String(set.o.path));
  ok('maxAge is 90 days', set.o.maxAge === 90 * 24 * 60 * 60 * 1000, String(set.o.maxAge));
  ok('secure follows NODE_ENV', 'secure' in set.o, 'not set at all');

  console.log('--- recognise(): bound to ONE customer ---');
  queries.length = 0;
  const req = { headers: { cookie: `bvo_device=${raw}; other=x` } };
  await device.recognise(req, 42);
  const sel = queries[0];
  ok('a lookup ran', !!sel, 'nothing queried');
  ok('customer_id is IN THE WHERE, not checked after',
     /WHERE[\s\S]*customer_id = \?/.test(sel.sql),
     'a cookie for another account could sign this email in');
  ok('it excludes revoked rows', /revoked_at IS NULL/.test(sel.sql), 'revocation is a no-op');
  ok('it excludes expired rows', /expires_at > NOW\(\)/.test(sel.sql), '90 days is not enforced');
  ok('it looks up by HASH, not raw', !sel.params.some(p => String(p) === raw), 'raw token queried');

  console.log('    (junk cookies never reach the database)');
  for (const [label, c] of [
    ['no cookie header',  {}],
    ['empty cookie',      { headers: { cookie: 'bvo_device=' } }],
    ['short token',       { headers: { cookie: 'bvo_device=abc' } }],
    ['non-hex token',     { headers: { cookie: 'bvo_device=' + 'z'.repeat(64) } }],
  ]) {
    queries.length = 0;
    const r = await device.recognise(c, 42);
    ok(`${label} -> null, no query`, r === null && queries.length === 0,
       `${r} / ${queries.length} queries`);
  }
  queries.length = 0;
  ok('no customer id -> null, no query',
     (await device.recognise(req, null)) === null && queries.length === 0, 'queried anyway');

  console.log('--- recognise() FAILS CLOSED ---');
  /* The opposite direction from brevo.isBlocked(), deliberately. There a
     false positive locks a customer OUT; here a false positive lets an
     attacker IN. So any error must answer null and the buyer simply gets
     a code.

     Asserted, not just commented: a mutation that returned a truthy
     object from the catch block walked straight through the version of
     this gate that only had the comment. */
  {
    Module._load = function (request) {
      if (request.indexOf('config/database') !== -1) {
        return { bvoPool: { query: async () => { throw new Error('DB down'); } } };
      }
      return origLoad.apply(this, arguments);
    };
    delete require.cache[require.resolve(path.join(ROOT, 'src/services/deviceService'))];
    const broken = require(path.join(ROOT, 'src/services/deviceService'));
    const r = await broken.recognise(req, 42);
    ok('a database error answers null, not a session',
       r === null, `returned ${JSON.stringify(r)} - an error became a free sign-in`);

    delete require.cache[require.resolve(path.join(ROOT, 'src/services/deviceService'))];
    Module._load = origLoad;
  }
  /* restore the recording stub for the remaining checks */
  Module._load = function (request) {
    if (request.indexOf('config/database') !== -1) {
      return { bvoPool: { query: async (sql, params) => {
        queries.push({ sql, params }); return [[]];
      } } };
    }
    return origLoad.apply(this, arguments);
  };
  delete require.cache[require.resolve(path.join(ROOT, 'src/services/deviceService'))];
  const device2 = require(path.join(ROOT, 'src/services/deviceService'));

  console.log('--- revokeAll / forget ---');
  queries.length = 0;
  await device2.revokeAll(42);
  ok('revokeAll writes revoked_at', /SET revoked_at = NOW\(\)/.test(queries[0].sql), 'missing');
  ok('it only touches live rows', /revoked_at IS NULL/.test(queries[0].sql), 'rewrites history');
  cookies.length = 0;
  device2.forget(res);
  ok('forget clears the cookie', cookies[0] && cookies[0].cleared === true, 'not cleared');

  Module._load = origLoad;
  statics();
})();

function statics() {
  console.log('--- the skip-the-code path ---');
  const ac = fs.readFileSync(path.join(ROOT, 'src/controllers/accountController.js'), 'utf8');
  const code = ac.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  ok('sendCode recognises a device', /device\.recognise\(req, known\.id\)/.test(code), 'missing');
  /* ORDER: the account must be found FIRST, so the cookie is checked
     against THAT id. Checking the cookie first and trusting whatever
     customer it names would let a stale cookie sign in any email typed. */
  /* BOTH must exist, THEN be ordered. indexOf returns -1 when a thing
     is absent, and -1 < anything is TRUE — so a bare comparison passes
     precisely BECAUSE the lookup was deleted. A mutation removing
     findByEmail walked straight through the unguarded version. */
  const iFind = code.indexOf('Customer.findByEmail(email)');
  const iRec  = code.indexOf('device.recognise(');
  ok('the account lookup is present', iFind !== -1,
     'the cookie alone would decide who you are');
  ok('the device cookie check is present', iRec !== -1, 'missing');
  ok('the account is looked up BEFORE the cookie is trusted',
     iFind !== -1 && iRec !== -1 && iFind < iRec,
     `find@${iFind} recognise@${iRec}`);
  ok('the fast path responds with skipped:true', /skipped: true/.test(code), 'missing');

  const iSkip = code.indexOf('device.recognise(');
  const iIssue = code.indexOf('authCode.issueCode(');
  ok('the skip is attempted BEFORE a code is issued',
     iSkip !== -1 && iIssue !== -1 && iSkip < iIssue, 'a code would be sent anyway');

  ok('a failed device check FALLS THROUGH to the code path',
     /device check failed, sending a code/.test(ac),
     'an error must never become a free sign-in');

  console.log('--- one session helper, not two regenerate() calls ---');
  /* The cart bug: regenerate() destroys the session and the cart lives
     there. A second sign-in path duplicating that logic would have
     reintroduced it. */
  ok('exactly ONE session.regenerate() call site',
     (code.match(/session\.regenerate\(/g) || []).length === 1,
     'a second call site will drift and lose the cart again');
  ok('establishSession exists', /async function establishSession/.test(code), 'missing');
  ok('both paths use it', (code.match(/await establishSession\(/g) || []).length === 2,
     'one path still regenerates inline');
  const carried = (ac.match(/const carried\s*=\s*\{([\s\S]*?)\n  \};/) || [])[1] || '';
  ok('the cart is carried across', /cart/.test(carried), 'sign-in would empty the cart');
  ok('customerId is NOT carried', !/customerId/.test(carried), 'fixation guard defeated');

  console.log('--- remember-me is OPT-IN ---');
  ok('verify honours remember_device', /req\.body\.remember_device/.test(code), 'ignored');
  for (const v of ['views/pages/checkout-identify.ejs', 'views/pages/account/login.ejs']) {
    const t = fs.readFileSync(path.join(ROOT, v), 'utf8');
    const m = t.match(/<input type="checkbox" id="[^"]*-remember"[^>]*>/);
    ok(`${path.basename(v)}: checkbox present`, !!m, 'missing');
    ok(`${path.basename(v)}: UNCHECKED by default`, m && !/\bchecked\b/.test(m[0]),
       '90 days of codeless sign-in must not be opted in FOR the buyer');
    ok(`${path.basename(v)}: posts the flag`, /remember_device:/.test(t), 'never sent');
  }

  console.log('--- the email functions are CALLED, not grepped ---');
  /* ⚠️ THE LESSON FROM cfce433. The previous version of this gate
     asserted the email's CONTENT by regexing the controller source, and
     never executed signInTimeLabel() or newDeviceEmail(). Both were
     broken: dateStyle/timeStyle cannot be combined with timeZoneName,
     so signInTimeLabel threw `TypeError: Invalid option : option` on
     EVERY call — on every Node build, not an environment quirk.

     The effect was invisible to a source grep and brutal in practice:
     the code verified, the row was consumed, the secure token was
     written, and THEN it threw — so the buyer was signed in and told
     "That code is not right."

     Source text is not behaviour. These now run. */
  {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/controllers/accountController.js'), 'utf8');

    const tm = src.match(/function signInTimeLabel\(d = new Date\(\)\) \{[\s\S]*?\n\}/);
    ok('signInTimeLabel is extractable', !!tm, 'not found');
    /* COMMENTS ARE NOT CODE. This function's own comment WARNS about
       dateStyle/timeStyle, so scanning raw text flags the warning as the
       thing it warns against. Fourth time this exact mistake has been
       made in these gates — see gate_customer_addresses_migration.py and
       its executable() helper for the SQL version. Declared HERE, before
       any assertion uses it: putting it lower hit a TDZ ReferenceError. */
    const tmCode = tm[0].replace(/\/\*[\s\S]*?\*\//g, '')
                        .replace(/^\s*\/\/.*$/gm, '');
    const signInTimeLabel = eval('(function(){' + tm[0] + '; return signInTimeLabel; })()');

    let label = null, threw = null;
    try { label = signInTimeLabel(new Date(Date.UTC(2026, 8, 28, 19, 13))); }
    catch (e) { threw = e; }
    ok('signInTimeLabel does NOT throw', !threw,
       threw && `${threw.constructor.name}: ${threw.message}`);
    ok('it returns a non-empty string',
       typeof label === 'string' && label.length > 0, String(label));
    ok('it names the month', /September/.test(label || ''), String(label));
    ok('it shows the timezone', /EDT|EST|UTC/.test(label || ''), String(label));
    /* ⚠️ THIS BEHAVIOURAL CHECK PASSES BY LUCK IF THE HOST'S OWN
       TIMEZONE IS EASTERN — which the sandbox's is. A mutation deleting
       the explicit timeZone option sailed through it. The structural
       assertion below is the one that actually holds on a UTC server,
       which is what Hostinger most likely is. */
    ok('it is in Eastern, not UTC', /3:13|03:13/.test(label || ''),
       `${label} — 19:13 UTC should read 3:13 PM Eastern`);
    ok('the timezone is stated EXPLICITLY, not inherited from the host',
       /timeZone:\s*'America\/New_York'/.test(tmCode),
       'on a UTC server every security email would show the wrong hour');
    ok('dateStyle/timeStyle are NOT used',
       !/dateStyle|timeStyle/.test(tmCode),
       'they cannot be combined with timeZoneName - this is the cfce433 bug');
    ok('there is a fallback if formatting ever fails',
       /catch\s*\{/.test(tmCode),
       'a timestamp is never worth an exception on the sign-in path');

    const nm = src.match(/function newDeviceEmail\(\{[^}]*\}\) \{[\s\S]*?\n\}/);
    ok('newDeviceEmail is extractable', !!nm, 'not found');
    const newDeviceEmail = eval('(function(){' + nm[0] + '; return newDeviceEmail; })()');

    let mail = null; threw = null;
    try {
      mail = newDeviceEmail({ email: 'a@b.com', deviceLabel: 'Mac (Web)',
                              when: label, secureUrl: 'https://x/account/secure?t=abc',
                              siteBase: 'https://example.test' });
    } catch (e) { threw = e; }
    ok('newDeviceEmail does NOT throw', !threw,
       threw && `${threw.constructor.name}: ${threw.message}`);
    ok('it produces a subject', !!(mail && mail.subject), 'none');
    ok('it produces html', !!(mail && mail.html && mail.html.length > 200), 'none');
    ok('the address is interpolated, not left as a token',
       mail && /a@b\.com/.test(mail.html) && !/\$\{email\}/.test(mail.html), 'not substituted');
    /* The anti-phishing line tells the customer which host our links start
       with. If it ever hardcodes a host again it can drift from the real
       one and teach people to distrust genuine BVO mail. */
    ok('the canonical host in the anti-phishing line comes from siteBase',
       mail && mail.html.includes('https://example.test')
            && !/bathroomvanitiesoutlet/.test(mail.html),
       'a hardcoded host here can drift from the real one');

    ok('the secure URL is interpolated',
       mail && mail.html.includes('https://x/account/secure?t=abc'), 'missing');
    ok('the device label is interpolated',
       mail && /Mac \(Web\)/.test(mail.html), 'missing');
    ok('the time is interpolated', mail && mail.html.includes(label), 'missing');
  }

  console.log('--- the notification cannot fail the sign-in ---');
  /* Structural, not incidental: the WHOLE block is wrapped, not just the
     brevo promise. issueSecureToken, newDeviceEmail and signInTimeLabel
     all run synchronously on the sign-in path. */
  {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/controllers/accountController.js'), 'utf8');
    const m = src.match(/try \{\n    if \(!customer\.created\) \{[\s\S]*?\} catch \(notifyErr\)/);
    ok('the notification block has its OWN try/catch', !!m,
       'a throw in it takes down the sign-in it reports on');
    ok('its catch says the sign-in is unaffected',
       /sign-in unaffected/.test(src), 'no signal in the log');
  }

  console.log('--- the new-device email ---');
  ok('sent only when NOT a new account', /if \(!customer\.created\)/.test(code),
     'a security warning as the first mail BVO ever sends');
  ok('it lives in code, not only the DB', /function newDeviceEmail/.test(ac),
     'a missing row would silence a security warning');
  ok('the DB template is still tried first',
     /sendTemplate\('auth_new_device'/.test(code), 'not editable');
  ok('it carries an anti-phishing box', /How do you know this email is really from us/.test(ac),
     'the strongest element of the captured design');
  ok('the account address is in the BODY', /Your account, <strong>\$\{email\}/.test(ac),
     'the reader cannot tell WHICH account');
  ok('reassurance comes BEFORE the warning',
     ac.indexOf('If this was you, no action is needed') < ac.indexOf('If it was not, secure'),
     'most recipients are the legitimate user');
  ok('no IP or city in the email', !/\$\{ip\}|first_seen_ip/.test(
       (ac.match(/function newDeviceEmail[\s\S]*?\n}/) || [''])[0]),
     'coarse by design - enough to recognise yourself, not to dox');

  console.log('--- secure my account ---');
  ok('the endpoint exists', /exports\.secureAccount/.test(code), 'missing');
  ok('it revokes devices', /device\.revokeAll\(/.test(code), 'devices survive');
  ok('it revokes outstanding codes', /authCode\.revokeAllCodes\(/.test(code), 'codes survive');
  ok('it destroys the session', /req\.session\.destroy\(/.test(code), 'attacker keeps their session');
  ok('it clears the cookie', /device\.forget\(res\)/.test(code), 'cookie survives');

  const rt = fs.readFileSync(path.join(ROOT, 'src/routes/account.js'), 'utf8');
  ok('the route is registered', /router\.get\('\/secure'/.test(rt), 'missing');
  ok('it has NO auth middleware',
     /router\.get\('\/secure',\s+controller\.secureAccount\)/.test(rt),
     'the clicker may be locked out - the token IS the authorisation');

  const svc = fs.readFileSync(path.join(ROOT, 'src/services/authCodeService.js'), 'utf8');
  ok('the secure token is 256 bits', /randomBytes\(32\)/.test(svc), 'too weak for a revoker');
  ok('it is looked up by hash alone, not by email',
     /WHERE code_hash = \? AND purpose = 'secure_account'/.test(svc),
     'the link carries only the token - an email-salted hash cannot be found');
  ok('the email comes OUT of the row',
     /SELECT id, email FROM customer_auth_codes/.test(svc),
     'a clicker could otherwise aim the revocation at another account');
  ok('single use — consumed before acting', /consumed_at = NOW\(\)/.test(svc), 'replayable');
  ok('24-hour expiry', /SECURE_TOKEN_TTL_HOURS = 24/.test(svc), 'wrong TTL');
  ok('it does NOT go through the rate-limited issueCode',
     !/issueSecureToken[\s\S]{0,400}issueCode\(/.test(svc),
     'the security email would sometimes arrive without its escape hatch');

  console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
  process.exit(fail ? 1 : 0);
}
