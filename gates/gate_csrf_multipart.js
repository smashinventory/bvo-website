'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_csrf_multipart.js
 *
 * THE RULE: EVERY ROUTE THAT PARSES A FILE UPLOAD MUST VERIFY CSRF AFTER
 * THE PARSE, AND NEVER BEFORE IT.
 *
 * THE DEFECT (live, found 2026-10-22 when the first real applicant hit it):
 *   /trade/apply returned {"ok":false,"error":"Invalid CSRF token"} to
 *   every submission. The global guard read `req.body._csrf`, but for
 *   multipart/form-data req.body is EMPTY at that point — express.urlencoded
 *   and express.json ignore multipart, and multer runs later, inside the
 *   route. The token was not wrong. It was UNREADABLE. No resubmission,
 *   new session or cleared cookie could ever have fixed it.
 *
 *   Proven by repro, not inferred: identical middleware order, urlencoded
 *   POST sees ['_csrf','name'], multipart POST sees [].
 *
 * WHY NOBODY NOTICED FOR MONTHS:
 *   b2b9256 added a fetch() interceptor that sends X-CSRF-Token as a
 *   HEADER, and headers are readable immediately. Practically every upload
 *   in the admin goes through fetch, so they all worked. Only three
 *   surfaces post a real <form enctype="multipart/form-data">:
 *     /trade/apply, /admin/products/import, /admin/products/import-jm
 *   All three were dead, and the two admin ones are why #344 "verify the
 *   JM import" never got a clean answer.
 *
 * WHAT THIS GUARDS:
 *   1. ORDERING. requireCsrf AFTER the multer middleware on every upload
 *      route. Before it is identical to having no check at all.
 *   2. COVERAGE. A new upload route with no requireCsrf is a route with NO
 *      CSRF PROTECTION — silently. That is worse than the 403 being fixed
 *      here, so it fails the build.
 *   3. THE RESPONSE SHAPE. A browser form must get an HTML page, not raw
 *      JSON. The old code treated "multipart" as "wants JSON", so a human
 *      applicant saw {"ok":false,...} as a bare page and lost everything
 *      they had typed and attached.
 *   4. ONE TOKEN DEFINITION. Generation and validation must not drift.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

const tok  = require(path.join(ROOT, 'src/utils/csrfToken.js'));
const mw   = require(path.join(ROOT, 'src/middleware/csrf.js'));

console.log('\n1. Every upload route verifies CSRF, AFTER the parse');

/* Route files, read as whole statements: a route definition can span
   several lines (trade.js wraps multer in an error-handling closure), so
   splitting on newlines would miss the requireCsrf that follows. */
const ROUTE_FILES = ['src/routes/trade.js', 'src/routes/admin.js'];

/* Names that mean "this middleware parses a multipart body". Hardcoded
   rather than discovered — a discovered list would shrink silently when
   someone renames a middleware, and the gate would stop testing it.
   Rule 18. */
const MULTER_MW = /(\buploadMiddleware\b|\bproductImportMiddleware\b|\bproductImportJMMiddleware\b|\bdocumentUploadMiddleware\b|\bproductAddDocumentMiddleware\b|\.(single|fields|array)\s*\()/;

function routeStatements(src) {
  /* Strip comments so a router.post( quoted in a warning comment is not
     mistaken for a real route — this project quotes old code constantly. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out = [];
  const re = /router\.(post|put|patch|delete)\s*\(/g;
  let m;
  while ((m = re.exec(code))) {
    /* Walk to the matching close paren so multi-line routes come back whole. */
    let i = re.lastIndex, depth = 1;
    while (i < code.length && depth > 0) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
      i++;
    }
    out.push(code.slice(m.index, i));
  }
  return out;
}

let uploadRoutes = 0;
for (const rel of ROUTE_FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const stmt of routeStatements(src)) {
    if (!MULTER_MW.test(stmt)) continue;
    uploadRoutes++;
    const name = (stmt.match(/router\.\w+\s*\(\s*['"]([^'"]+)/) || [])[1] || '?';

    const iMulter = stmt.search(MULTER_MW);
    const iCsrf   = stmt.indexOf('requireCsrf');

    check(iCsrf !== -1,
      `${rel} ${name}: mounts requireCsrf`,
      'This route parses an upload but never verifies CSRF. The global guard DEFERRED it (the body was unreadable), so nothing checked it at all — the route is unprotected, silently. Add requireCsrf immediately after the multer middleware.');

    if (iCsrf !== -1) {
      check(iCsrf > iMulter,
        `${rel} ${name}: requireCsrf comes AFTER the multer middleware`,
        'Before the parse, req.body is still empty and the token is unreadable — identical to the defect this gate exists for. Order is the whole property.');
    }
  }
}
check(uploadRoutes >= 3,
  `found and checked at least 3 upload routes (found ${uploadRoutes})`,
  'The three known plain-form upload routes are /trade/apply, /admin/products/import and /admin/products/import-jm. Finding fewer means the detection regex stopped matching — the gate would be passing by not looking.');

console.log('\n2. The deferral is real, and a header still short-circuits it');

const req = (over) => Object.assign({
  method: 'POST', path: '/trade/apply', headers: {}, body: {}, sessionID: 's1',
}, over);

check(tok.isMultipart(req({ headers: { 'content-type': 'multipart/form-data; boundary=x' } })),
  'isMultipart recognises a real multipart content-type');
check(!tok.isMultipart(req({ headers: { 'content-type': 'application/x-www-form-urlencoded' } })),
  'and does not misfire on urlencoded');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'gate-test-secret';
const good = tok.makeToken('s1');
check(tok.verify(req({ body: { _csrf: good } })) === true,
  'verify accepts a correct token from the body');
check(tok.verify(req({ headers: { 'x-csrf-token': good } })) === true,
  'verify accepts a correct token from the header (fetch uploads)');
check(tok.verify(req({ body: { _csrf: 'nope' } })) === false,
  'verify rejects a wrong token');
check(tok.verify(req({})) === false,
  'verify rejects a missing token');
check(tok.verify(req({ body: { _csrf: [good, good] } })) === true,
  'verify handles the array form (nested forms post _csrf twice)');
/* ⚠️ A SHORT TOKEN MUST NOT THROW. crypto.timingSafeEqual raises on a
   length mismatch, which would 500 instead of 403 — turning a rejected
   request into an error page and, worse, into a stack trace. */
let threw = false;
try { tok.verify(req({ body: { _csrf: 'x' } })); } catch { threw = true; }
check(!threw, 'a malformed short token is rejected, not thrown on',
  'timingSafeEqual throws on unequal lengths. Without the length guard this is a 500, not a 403.');

console.log('\n3. A browser form gets a PAGE; only a real API call gets JSON');

check(tok.wantsJson(req({ headers: { 'content-type': 'multipart/form-data' } })) === false,
  'multipart alone does NOT mean the client wants JSON',
  'This was the second defect: a human submitting the trade application was shown {"ok":false,"error":"Invalid CSRF token"} as a bare page, losing every field and file. A form post wants a page.');
check(tok.wantsJson(req({ headers: { 'x-requested-with': 'XMLHttpRequest' } })) === true,
  'an XHR does want JSON');
check(tok.wantsJson(req({ headers: { accept: 'application/json' } })) === true,
  'and so does an explicit Accept: application/json');

console.log('\n4. One definition of the token — generation cannot drift from validation');

const SERVER = fs.readFileSync(path.join(ROOT, 'src/server.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

check(/require\(['"]\.\/utils\/csrfToken['"]\)/.test(SERVER),
  'server.js takes the token generator from the shared module');
check(!/createHmac\(\s*['"]sha256['"]\s*,\s*process\.env\.SESSION_SECRET/.test(SERVER),
  'server.js no longer defines its own HMAC',
  'Two implementations of one token is how the generator and the validator drift apart — which is exactly the class of failure that made /trade/apply reject every submission.');
check(/middleware\/csrf['"]\)\.globalGuard/.test(SERVER),
  'server.js mounts the shared globalGuard');
check(!/req\.body\s*&&\s*req\.body\._csrf/.test(SERVER),
  'the inline body-only token read is gone from server.js',
  'That single expression is the original defect: unreadable for multipart.');

console.log('\n5. The runtime guard against a silently unprotected route exists');

check(typeof mw.requireCsrf === 'function' && typeof mw.globalGuard === 'function',
  'both halves are exported');
check(/UNVERIFIED MULTIPART REQUEST COMPLETED/
  .test(fs.readFileSync(path.join(ROOT, 'src/middleware/csrf.js'), 'utf8')),
  'a deferred-but-unverified response shouts in the log',
  'Build-time coverage can be bypassed by a route defined somewhere this gate does not read. The runtime warning is the backstop.');

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_csrf_multipart: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
