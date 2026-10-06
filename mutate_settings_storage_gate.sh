#!/usr/bin/env bash
# Negative tests for gate_settings_storage.js. Each mutation restores a real
# way the fat-file problem (or the duplicate-key problem) comes back.
set -u
cd "$(dirname "$0")"
BK=$(mktemp -d)
cp src/services/themeSettings.js src/controllers/adminController.js "$BK/"
restore() {
  cp "$BK/themeSettings.js"   src/services/themeSettings.js
  cp "$BK/adminController.js" src/controllers/adminController.js
}
trap restore EXIT
bad=0
try() {
  local label="$1"; shift
  "$@" >/dev/null 2>&1
  if node gates/gate_settings_storage.js >/dev/null 2>&1; then
    echo "  BAD   gate still GREEN after: $label"; bad=$((bad+1))
  else
    echo "  good  gate went RED  after: $label"
  fi
  restore
}

# 1. the file write goes back to storing the full merged object
m1() { perl -0pi -e 's/JSON\.stringify\(thinForStorage\(settings\), null, 2\)/JSON.stringify(settings, null, 2)/' src/services/themeSettings.js; }
# 2. the DB copy goes back to fat — the fix would last until the next deploy wipe
m2() { perl -0pi -e "s/JSON\.stringify\(thinForStorage\(settings\)\)\]/JSON.stringify(settings)]/" src/services/themeSettings.js; }
# 3. adminController writes the file itself again (the duplicate writer)
m3() { perl -0pi -e "s/  themeSettings\.writeSettingsFile\(settings\);/  fs.writeFileSync(path.join(__dirname,'..\/..\/data\/theme_settings.json'), JSON.stringify(settings,null,2),'utf8');/" src/controllers/adminController.js; }
# 4. thinning drops a key that has NO default — real data lost
m4() { perl -0pi -e 's/if \(dft === undefined \|\| String\(cur\) !== String\(dft\)\) out\[key\] = cur;/if (dft !== undefined \&\& String(cur) !== String(dft)) out[key] = cur;/' src/services/themeSettings.js; }
# 5. arrays diffed per-item instead of atomically — deepMerge cannot read it back
m5() { perl -0pi -e 's/if \(JSON\.stringify\(cur\) !== JSON\.stringify\(dft\)\) out\[key\] = cur;/if (JSON.stringify(cur) !== JSON.stringify(dft)) out[key] = cur.slice(0,1);/' src/services/themeSettings.js; }
# 6. the cache gets thinned too — readers start seeing missing keys
m6() { perl -0pi -e 's/^  _cache = settings;$/  _cache = thinForStorage(settings);/m' src/services/themeSettings.js; }
# 7. THE ORIGINAL BUG: a second seo: block reappears, discarding the first
m7() { python3 - <<'PYX'
import io
p='src/services/themeSettings.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace("  global: {", "  seo: {\n    filter_landing_min_products: 10,\n  },\n\n  global: {",1)
io.open(p,'w',encoding='utf-8').write(s)
PYX
}

echo
echo "Negative tests for gate_settings_storage"
echo
try "the settings file goes back to storing the full merged object"   m1
try "the DB copy goes back to fat (restored stale on the next deploy)" m2
try "adminController writes the file itself again (two writers)"       m3
try "thinning drops a key that has no default (real data lost)"        m4
try "arrays diffed per-item instead of written whole"                  m5
try "the in-memory cache gets thinned too"                             m6
try "a second seo: block reappears, silently discarding the first"     m7

echo
if [ "$bad" -gt 0 ]; then echo "NEGATIVE TESTS FAILED: $bad undetected"; exit 1; fi
echo "All 7 mutations detected. The gate can fail."
