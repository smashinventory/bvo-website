'use strict';
/* Gate: screen-size bands are DATA, and the owner can reach every one.
 * 2026-09-29
 *
 * ── WHAT THIS PROTECTS ────────────────────────────────────────────────
 *
 * Owner: "the theme editor does not allow me to have any changeability of
 * the views based on size of screen. There are 3 options, but only the
 * desktop and mobile work. We have a px box that is not functional." And:
 * "help me take control as opposed to you hardcoding."
 *
 * Both symptoms had the same root: every responsive decision was a
 * hand-written media query in a CSS file, so there was nothing to
 * control. A third `show_on` option would have selected nothing, and the
 * Tablet preview button showed the mobile layout because 860px was the
 * only line the site knew.
 *
 * The failure mode to guard is not "a number is wrong". It is a control
 * that EXISTS AND DOES NOTHING — which is what shipped, twice, and is
 * invisible unless you check the whole chain:
 *
 *      settings default -> save path -> resolver -> emitted CSS -> page
 *
 * A gate on any one link would have passed the entire time.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const executable = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const bp = require('../src/utils/breakpoints');

/* ═══ 1. THE BANDS ARE EXHAUSTIVE AND DISJOINT ═════════════════════ */
console.log('--- the bands themselves ---');
{
  const r = bp.resolve({});
  ok('defaults resolve', r.mobileMax === 600 && r.tabletMax === 1024,
     `got ${r.mobileMax}/${r.tabletMax}`);

  /* Every width lands in exactly one band. This is the property that makes
     cascade order irrelevant — see gate_listing_grid_breakpoints.js for
     what overlapping bands have cost this codebase. */
  const seen = {};
  let gaps = 0;
  for (let w = 320; w <= 2000; w++) {
    const b = r.bandFor(w);
    if (!b) gaps += 1;
    seen[b] = true;
  }
  ok('every width 320-2000 belongs to a band', gaps === 0, `${gaps} widths matched none`);
  ok('all three bands are reachable',
     seen.mobile && seen.tablet && seen.desktop, JSON.stringify(seen));

  /* The media queries must not overlap either — they are what the browser
     actually reads, and a ±1 error here is silent. */
  const m = /max-width:(\d+)px/.exec(r.mq.mobile);
  const t = /min-width:(\d+)px\) and \(max-width:(\d+)px/.exec(r.mq.tablet);
  const d = /min-width:(\d+)px/.exec(r.mq.desktop);
  ok('mobile and tablet do not overlap', +t[1] === +m[1] + 1,
     `mobile ends ${m[1]}, tablet starts ${t[1]}`);
  ok('tablet and desktop do not overlap', +d[1] === +t[2] + 1,
     `tablet ends ${t[2]}, desktop starts ${d[1]}`);
}

console.log('\n--- the owner\'s numbers actually move the bands ---');
{
  const r = bp.resolve({ breakpoints: { mobile_max: 700, tablet_max: 900 } });
  ok('a custom mobile_max is honoured', r.mobileMax === 700, `got ${r.mobileMax}`);
  ok('a custom tablet_max is honoured', r.tabletMax === 900, `got ${r.tabletMax}`);
  ok('768px moves band with them', r.bandFor(768) === 'tablet', r.bandFor(768));
  ok('and 950 becomes desktop', r.bandFor(950) === 'desktop', r.bandFor(950));
}

console.log('\n--- nonsense is clamped, not obeyed ---');
{
  const r = bp.resolve({ breakpoints: { mobile_max: 5000, tablet_max: 10 } });
  ok('bands cannot cross over', r.tabletMax > r.mobileMax,
     `${r.mobileMax} / ${r.tabletMax} — a site with no desktop layout`);
  ok('and stay inside the rails',
     r.mobileMax >= bp.MIN_MOBILE && r.tabletMax <= bp.MAX_TABLET,
     `${r.mobileMax}/${r.tabletMax}`);
  const empty = bp.resolve({ breakpoints: { mobile_max: '', tablet_max: null } });
  ok('blank fields fall back to the defaults',
     empty.mobileMax === bp.DEFAULTS.mobile_max, `got ${empty.mobileMax}`);
}

/* ═══ 2. show_on — ALL THREE STATES REACH THE PAGE ═════════════════ */
console.log('\n--- "Visible on" has a real third state ---');
{
  ok('tablet maps to a class', bp.visibilityClass('tablet') === 'sec--tablet-only',
     bp.visibilityClass('tablet'));
  ok('all maps to no class', bp.visibilityClass('all') === '', 'would hide everything');

  const css = bp.visibilityCss(bp.resolve({}));
  /* A section set to one band must be hidden on the OTHER TWO. Tablet is
     the case the old two-rule version could not express — it needs hiding
     both below and above, which is why a third option could not simply be
     added to the dropdown. */
  for (const cls of ['sec--mobile-only', 'sec--tablet-only', 'sec--desktop-only']) {
    const hides = (css.match(new RegExp(cls, 'g')) || []).length;
    ok(`${cls} is hidden in exactly 2 bands`, hides === 2, `appears ${hides} times`);
  }
  ok('the CSS uses the resolved queries, not hardcoded numbers',
     !/86[01]px/.test(css), 'the old hardcoded 860/861 is back');
}

console.log('\n--- the editor offers it, the page emits it ---');
{
  const editor = read('views/pages/admin/theme.ejs');
  const idx    = read('views/pages/index.ejs');
  const layout = read('views/layouts/main.ejs');

  const tabletOpts = (editor.match(/value="tablet"/g) || []).length;
  ok('every Visible-on select offers Tablet', tabletOpts >= 7,
     `only ${tabletOpts} — a panel was missed and that section can never be tablet-only`);
  ok('index.ejs maps show_on through the shared helper',
     /breakpoints\.visibilityClass\(_showOn\)/.test(idx),
     'a second mapping will drift from the CSS');
  ok('the layout emits the visibility CSS',
     /breakpoints\.visibilityCss\(/.test(layout), 'the classes would do nothing');
  /* The reason it is inline: site4.css is admin-only and the bundle is
     stale. If someone "tidies" this into a stylesheet it stops working
     and nothing errors. */
  /* Matched loosely on purpose. The first version required
     `<style nonce...><%- breakpoints.visibilityCss`, but the tag carries
     `nonce="<%= cspNonce %>"` and the '>' of that EJS tag ended the
     character class — so the assertion failed on correct code. Assert the
     two facts, not one brittle string. */
  ok('…inline, not moved into a stylesheet',
     /<style[\s\S]{0,80}breakpoints\.visibilityCss/.test(layout) &&
     !/visibilityCss/.test(read('public/css/site-bundle.css')),
     'site4.css is linked by the ADMIN layout only — a stylesheet will not reach shoppers');
}

/* ═══ 3. THE NAV IS CONTROLLABLE ON EVERY BAND ═════════════════════ */
console.log('\n--- header: every band, every knob ---');
{
  const hdr = read('views/partials/header.ejs');
  const hdrX = executable(hdr);

  ok('the old desktop-only rule is gone',
     !/@media \(min-width:861px\)\{\.nav-logo/.test(hdrX),
     'the logo fields would still do nothing on a phone');
  ok('three bands are emitted',
     (hdrX.match(/_bp\.mq\.(mobile|tablet|desktop)/g) || []).length >= 3, 'not all bands');

  for (const knob of ['pad', 'gap']) {
    ok(`${knob} is settable per band`,
       new RegExp(`_navCfg\\['${knob}_'\\s*\\+\\s*b\\]`).test(hdrX), `${knob} is fixed`);
  }
  ok('logo size is settable per band',
     /_navCfg\['logo_width_'\s*\+ b\]/.test(hdrX), 'mobile logo not controllable');
  ok('bar height is settable per band',
     /_navCfg\['height_'\s*\+\s*b\]/.test(hdrX), 'height fixed');
  ok('a 0 survives (it is a real value, only "" is absent)',
     /String\(v\)\.trim\(\) === ''/.test(hdrX),
     'zero padding would be read as unset and silently replaced');
  /* BOTH clamps, asserted separately. The first version was
     /_clampLogo|_clampBox/ — removing every _clampLogo call still left
     _clampBox in the file, so the gate passed with the logo unclamped. */
  ok('logo sizes are clamped',
     (hdrX.match(/_clampLogo\(/g) || []).length >= 4,
     'a typed 9999 would blow the header apart');
  ok('padding and gap are clamped',
     (hdrX.match(/_clampBox\(/g) || []).length >= 4, 'a negative padding would be accepted');
  ok('header does not require() — EJS has no require',
     !/require\(/.test(hdrX), 'this throws at render on every page of the site');
  ok('it reads breakpoints from res.locals',
     /typeof breakpoints !== 'undefined'/.test(hdrX), 'not wired');

  const server = executable(read('src/server.js'));
  ok('server.js exposes breakpoints to templates',
     /res\.locals\.breakpoints = require\('\.\/utils\/breakpoints'\)/.test(server),
     'the local would be undefined and every template guard would fall back');
}

/* ═══ 4. THE SETTINGS EXIST AND SAVE ═══════════════════════════════ */
console.log('\n--- all three layers (CLAUDE.md: two of three is decoration) ---');
{
  const ts = executable(read('src/services/themeSettings.js'));
  ok('breakpoints have defaults', /breakpoints:\s*\{[\s\S]{0,120}mobile_max/.test(ts), 'absent');
  for (const f of ['pad_mobile', 'gap_mobile', 'logo_width_mobile',
                   'pad_tablet', 'gap_tablet', 'logo_width_tablet',
                   'height_desktop']) {
    ok(`nav.${f} has a default`, new RegExp(`${f}:`).test(ts), 'field would read undefined');
  }
  /* Mobile/tablet logo default to 90 — what every small screen renders
     TODAY — rather than inheriting the live 120px desktop value. Shipping
     an inherit here would have grown the owner's phone header unasked. */
  ok('mobile logo defaults to the status quo, not to inherit',
     /logo_width_mobile:\s*90/.test(ts),
     'the phone header would change size on deploy without anyone asking');

  const editor = read('views/pages/admin/theme.ejs');
  for (const f of ['breakpoints.mobile_max', 'breakpoints.tablet_max',
                   'nav.pad_mobile', 'nav.gap_mobile', 'nav.height_mobile',
                   'nav.logo_width_mobile', 'nav.logo_width_tablet',
                   'nav.pad_tablet', 'nav.gap_tablet']) {
    ok(`the editor has an input for ${f}`, editor.includes(`'${f}'`), 'no way to set it');
  }
  /* Layer three. themeSettings.save() walks dotted keys generically, so
     nav.* and breakpoints.* persist without a field list — but if that
     ever becomes an allowlist these fields must be in it. */
  const admin = executable(read('src/controllers/adminController.js'));
  ok('the save path is generic (no allowlist to fall out of)',
     /themeSettings\.save\(flat\)/.test(admin),
     'if save() gained an allowlist, every new field above silently stops saving');
}

/* ═══ 5. THE PREVIEW SHOWS WHAT IT CLAIMS ══════════════════════════ */
console.log('\n--- preview width control ---');
{
  const editor = read('views/pages/admin/theme.ejs');
  ok('the frame is sized, not just clamped',
     /iframeWrap\.style\.width\s*=\s*want \+ 'px'/.test(editor),
     'max-width alone does nothing when the requested width exceeds the pane — ' +
     'which is exactly why the Tablet button and the px box looked dead');
  ok('and scaled down when the pane is too small',
     /scale\(/.test(editor) && /avail \/ want/.test(editor), 'wide previews still do nothing');
  ok('the clamp is explicitly removed',
     /maxWidth\s*=\s*'none'/.test(editor), 'a leftover max-width re-breaks it');
  ok('the typed box uses the same code path',
     !/iframeWrap\.style\.maxWidth\s*=\s*n \+ 'px'/.test(editor),
     'the duplicate copy is what stopped typed values from ever scaling');
  /* \b so renaming the id to te4ScaleNoteX does not still match. */
  ok('the owner is told the scale', /\bte4ScaleNote\b/.test(editor),
     'a scaled preview looks like a rendering bug');
  ok('presets derive from the bands, not old hardcoded numbers',
     /_bpm \+ 1/.test(editor) && !/519 — bg layout rules end/.test(editor),
     'the preset list goes stale the moment the owner moves a band');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
