'use strict';
/* Every homepage section gets the SAME Theme Editor controls.
 *
 * ⚠️ WHY THIS GATE EXISTS. Section controls were built one at a time, for
 * whichever section was being discussed — so the hero ended up with 22
 * fields and several sections had none at all, and the owner had to come
 * back and ask again for every single one. That is a process failure, and
 * a gate is the only thing that stops it recurring: the next person to
 * add a section finds out here, not from the owner.
 *
 * The rule asserted: for EVERY key in homepage_section_order, the shared
 * layout settings exist in the defaults AND a Theme Editor panel emits
 * the shared control group.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const TS  = fs.readFileSync(path.join(ROOT, 'src/services/themeSettings.js'), 'utf8');
const IDX = fs.readFileSync(path.join(ROOT, 'views/pages/index.ejs'), 'utf8');
const THM = fs.readFileSync(path.join(ROOT, 'views/pages/admin/theme.ejs'), 'utf8');

const order = (TS.match(/homepage_section_order:\s*\[([\s\S]*?)\]/) || ['', ''])[1]
  .match(/'([a-z_0-9]+)'/g).map(q => q.replace(/'/g, ''));
ok('the section order parsed', order.length > 10, `${order.length} keys`);

/* Sections rendered by the duplicatable loop have no literal panel; the
   loop emits the group for them and for every _2/_3 copy. */
const DUPL = (THM.match(/_DUPL_BASES\s*=\s*new Set\(\[([\s\S]*?)\]\)/) || ['', ''])[1]
  .match(/'([a-z_0-9]+)'/g).map(q => q.replace(/'/g, ''));

const SHARED = ['text_align', 'max_width', 'padding_top', 'padding_bottom'];

console.log('--- every section has the shared settings in its defaults ---');
order.forEach(key => {
  const blk = (TS.match(new RegExp('\\n  ' + key + ':\\s*\\{([\\s\\S]*?)\\n  \\},')) || ['', ''])[1];
  ok(`${key} has a defaults block`, !!blk, 'no defaults - the section has no settings at all');
  if (!blk) return;
  const missing = SHARED.filter(k => !new RegExp('\\b' + k + ':').test(blk));
  ok(`${key} has all ${SHARED.length} shared settings`, missing.length === 0,
     `missing: ${missing.join(', ')}`);
  /* A duplicate key in an object literal is resolved by POSITION, so
     listing one twice means reordering the file can silently flip a
     default. Four sections had exactly this after the shared block was
     added, because they already defined text_align. */
  const dup = SHARED.concat(['bg_color', 'text_color'])
    .filter(k => (blk.match(new RegExp('\\b' + k + ':', 'g')) || []).length > 1);
  ok(`${key} has no duplicate setting keys`, dup.length === 0, `duplicated: ${dup.join(', ')}`);
});

console.log('--- every section has a Theme Editor panel with the group ---');
function panelBody(key) {
  const open = '<div class="te4-panel" id="panel-' + key + '">';
  const i = THM.indexOf(open);
  if (i === -1) return null;
  let depth = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = i;
  let m;
  while ((m = re.exec(THM))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return THM.slice(i, m.index);
  }
  return null;
}
order.forEach(key => {
  const body = panelBody(key);
  if (body === null) {
    /* No literal panel is only acceptable for a duplicatable base, which
       the loop covers. Anything else is a section with no editor at all. */
    ok(`${key} is covered by the duplicatable loop`, DUPL.indexOf(key) > -1,
       'no panel and not duplicatable - this section cannot be edited');
    return;
  }
  ok(`${key} panel emits teSectionLayout`, /teSectionLayout\(/.test(body),
     'alignment, width and padding are missing from this panel');
  /* ⚠️ TWO INPUTS WITH THE SAME NAME POST TWICE and the parser keeps
     whichever it saw last - the file's own comment warns about this, and
     adding the shared group created exactly that in 8 panels before it
     was caught. */
  const showOn = (body.match(/teVisibleOn\(/g) || []).length
               + (body.match(/teFeaturedBody\(/g) || []).length
               + (body.match(new RegExp('name="' + key + '\\.show_on"', 'g')) || []).length;
  ok(`${key} has exactly ONE show_on input`, showOn === 1, `${showOn} emitters`);
});

console.log('--- the duplicatable loop emits the group too ---');
const loop = (THM.match(/<div class="te4-panel" id="panel-<%= pk %>">[\s\S]*?teSectionLayout\(pk/) || [''])[0];
ok('the loop panel calls teSectionLayout(pk, d)', !!loop,
   'the six duplicatable sections and every copy would have no layout controls');

console.log('--- the helpers exist and validate ---');
ok('teSectionLayout is defined', /function teSectionLayout\(/.test(THM), 'missing');
ok('teButton is defined',        /function teButton\(/.test(THM), 'missing');
ok('_sectionFrame is defined',   /function _sectionFrame\(/.test(IDX), 'missing');
ok('_sectionInner is defined',   /function _sectionInner\(/.test(IDX), 'missing');
ok('_btnClass is defined',       /function _btnClass\(/.test(IDX), 'missing');

const code = (IDX.match(/var _SEC_ALIGN[\s\S]*?\nfunction _btnClass\(v\) \{[\s\S]*?\n\}/) || [''])[0]
           + '\n' + (IDX.match(/function _cssColor\(v\)[\s\S]*?\n\}/) || [''])[0];
/* ⚠️ eval UNDER 'use strict' SCOPES ITS DECLARATIONS TO ITSELF, so the
   functions are returned explicitly rather than expected to leak into
   this scope - the first version of this gate crashed on exactly that.
   The helpers are evaluated rather than reimplemented so the gate tests
   the code that ships, not a copy of it. */
/* eslint-disable no-eval */
const H = eval(code + '\n;({ _sectionFrame: _sectionFrame, _sectionInner: _sectionInner, _btnClass: _btnClass })');
const _sectionFrame = H._sectionFrame;
const _sectionInner = H._sectionInner;
const _btnClass     = H._btnClass;
ok('the real helpers were evaluated from index.ejs',
   typeof _sectionFrame === 'function' && typeof _btnClass === 'function',
   'the gate would be testing nothing');

/* THE SAFETY PROPERTY that made it possible to switch this on for every
   section at once: a section nobody has touched must render unchanged. */
ok('blank settings produce NO style at all',
   _sectionFrame({}) === '' && _sectionInner({}) === ''
   && _sectionFrame({ text_align: '', max_width: '', padding_top: '' }) === '',
   'untouched sections would change appearance');
ok('a set alignment is applied',
   _sectionFrame({ text_align: 'center' }) === 'text-align:center;', _sectionFrame({ text_align: 'center' }));
ok('a bare number is treated as px',
   _sectionInner({ max_width: '900' }).indexOf('max-width:900px') === 0, _sectionInner({ max_width: '900' }));

/* The style attribute is written with the raw tag, so unvalidated input
   here is attribute injection. */
[['text_align', 'right;x:1'],
 ['padding_top', '10px;background:url(javascript:1)'],
 ['max_width', '100px" onload="alert(1)'],
 ['padding_bottom', 'expression(1)'],
 ['text_color', '</style><script>alert(1)</script>']].forEach(([k, v]) => {
  const o = {}; o[k] = v;
  ok(`injection via ${k} is rejected`, (_sectionFrame(o) + _sectionInner(o)) === '',
     _sectionFrame(o) + _sectionInner(o));
});

console.log('--- the button default matches the hero ---');
/* The samples banner shipped amber directly below two navy hero buttons.
   An unrecognised style must fall back to the hero's primary, not to
   whatever a section hardcoded. */
const heroBtn = (IDX.match(/hero\.cta1_url[\s\S]{0,120}?class="btn (btn-[a-z]+)"/) || [])[1];
ok('the hero primary button was found', !!heroBtn, 'cannot check the default against anything');
ok(`_btnClass defaults to the hero primary (${heroBtn})`,
   _btnClass(undefined) === 'btn ' + heroBtn, _btnClass(undefined));
ok('an unknown style falls back, it does not pass through',
   _btnClass('evil" x') === 'btn ' + heroBtn, _btnClass('evil" x'));
ok('the samples banner no longer hardcodes a button colour',
   !/class="btn btn-amber"[^>]*>\s*<%= sb_\.cta_text/.test(IDX)
   && /_btnClass\(sb_\.btn_style\)/.test(IDX),
   'the banner still hardcodes its button');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
