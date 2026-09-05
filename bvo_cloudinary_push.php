<?php
/**
 * ER Vanities → BVO Cloudinary push.
 *
 * Reads ERV_cloudinary_map.csv and uploads each `upload=yes` row into the BVO
 * Cloudinary account under the frozen public_id the map assigns.
 *
 * NOTHING TRANSITS THIS SERVER. Cloudinary fetches the bytes itself from a
 * source URL we hand it, and both source CDNs cap on request:
 *
 *     Google Drive   lh3.googleusercontent.com/d/<id>=s2048   caps the LONG edge
 *     Shopify CDN    <url>?width=2048                          caps the width
 *
 * That matters because this account is on the free plan, whose ceilings are
 * 25 megapixels and 10 MB per image. The London masters are 6600x4400 (29 MP,
 * up to 31 MB) and three Bristol files are over 25 MP — all of them would be
 * REFUSED at full size. Capped at the CDN they land around 2048x1366 / 350 KB.
 *
 * Neither CDN upscales, so the Windsor renders at 1152x928 arrive untouched.
 * A `c_limit` incoming transformation is sent as well, which catches the one
 * case the CDN params miss: a portrait Shopify file, where ?width=2048 caps the
 * width and leaves the height taller (2048x3470). Well inside the limits either
 * way, so if the plan declines the incoming transformation nothing breaks.
 *
 *   php bvo_cloudinary_push.php --map=... --dry-run                 what would go
 *   php bvo_cloudinary_push.php --map=... --limit=10 --confirm-upload   pilot
 *   php bvo_cloudinary_push.php --map=... --confirm-upload           the rest
 *   php bvo_cloudinary_push.php --map=... --report                   read journal, stop
 *
 * Resumable: every result is journalled, and a row already marked ok is skipped
 * on the next run. The host kills cron jobs at 30 minutes, so --max-minutes
 * stops cleanly before that and the next run picks up where this one stopped.
 */
declare(strict_types=1);
set_time_limit(0);
ini_set('memory_limit', '256M');

const CAP          = 2048;
const API_BASE     = 'https://api.cloudinary.com/v1_1/';
const HTTP_TIMEOUT = 120;

/** Admin API deletes at most this many public_ids per request. */
const DESTROY_BATCH = 100;

// ---------------------------------------------------------------- arguments
$opt = getopt('', ['map:', 'journal:', 'limit::', 'max-minutes::', 'dry-run',
                   'confirm-upload', 'report', 'only::', 'redo-png', 'confirm-delete']);

$mapPath = $opt['map']     ?? '';
$jrnPath = $opt['journal'] ?? (dirname($mapPath) . '/bvo_cloudinary_journal.csv');
$limit   = isset($opt['limit'])        ? (int)$opt['limit']        : 0;
$maxMin  = isset($opt['max-minutes'])  ? (int)$opt['max-minutes']  : 25;
$dryRun  = array_key_exists('dry-run', $opt);
$confirm = array_key_exists('confirm-upload', $opt);
$report  = array_key_exists('report', $opt);
$only    = $opt['only'] ?? '';          // filter on collection, e.g. --only=Oxford

$started = time();
function logline(string $m): void { echo date('Y-m-d H:i:s') . '  ' . $m . PHP_EOL; }

if ($mapPath === '' || !is_readable($mapPath)) {
    logline("FATAL: --map is required and must be readable (got: '$mapPath')");
    exit(2);
}

// ------------------------------------------------------------- credentials
// Set by the wrapper. Never on a command line: arguments show up in process
// listings and in error text.
$cloud  = getenv('CLOUDINARY_CLOUD_NAME') ?: '';
$key    = getenv('CLOUDINARY_API_KEY')    ?: '';
$secret = getenv('CLOUDINARY_API_SECRET') ?: '';

// ------------------------------------------------------------------ journal
/** @return array<string,array<string,string>> keyed by public_id */
function readJournal(string $p): array {
    if (!is_readable($p)) return [];
    $out = []; $fh = fopen($p, 'r');
    $hdr = fgetcsv($fh);
    if ($hdr === false) { fclose($fh); return []; }
    while (($row = fgetcsv($fh)) !== false) {
        if (count($row) < count($hdr)) $row = array_pad($row, count($hdr), '');
        $r = array_combine($hdr, array_slice($row, 0, count($hdr)));
        $out[$r['public_id']] = $r;
    }
    fclose($fh);
    return $out;
}

function appendJournal(string $p, array $row): void {
    $new = !file_exists($p);
    $fh  = fopen($p, 'a');
    if ($new) fputcsv($fh, ['public_id','status','secure_url','width','height','bytes','format','note','at']);
    fputcsv($fh, [$row['public_id'], $row['status'], $row['secure_url'] ?? '',
                  $row['width'] ?? '', $row['height'] ?? '', $row['bytes'] ?? '',
                  $row['format'] ?? '', $row['note'] ?? '', date('c')]);
    fclose($fh);
}

// -------------------------------------------------------------- source URL
/**
 * Rewrite a map source URL so the CDN hands Cloudinary an already-capped file.
 * Both forms below were verified against live files before this was written.
 */
/** Widths to fall back through when Cloudinary refuses the SOURCE as too large.
 *  Ordered, first that fits wins. See the retry in the upload loop for why. */
const FALLBACK_WIDTHS = [1600, 1200, 900];

function cappedSource(string $url, string $source, int $width = CAP): string {
    if ($source === 'drive') {
        // The map stores drive.google.com/uc?id=<id>; lh3 serves the bytes and
        // honours =s<N>, which caps the LONG edge and never upscales.
        if (preg_match('/[?&]id=([A-Za-z0-9_-]+)/', $url, $m)) {
            return 'https://lh3.googleusercontent.com/d/' . $m[1] . '=s' . $width;
        }
        return $url;
    }
    // Shopify: ?width=N caps the width. A file already narrower comes back
    // untouched rather than upscaled.
    //
    // It does NOT change format. ?width=2048&format=jpg was tested against a
    // live file and returns image/png at 13,090 KB, exactly as ?width=2048
    // alone does — the parameter is ignored. That matters because the 10 MB
    // ceiling applies to what Cloudinary FETCHES, before f_jpg can run, so the
    // only lever left on an oversized PNG is a narrower request.
    return $url . (str_contains($url, '?') ? '&' : '?') . 'width=' . $width;
}

// ------------------------------------------------------------------ upload
function cloudinaryUpload(string $cloud, string $key, string $secret,
                          string $publicId, string $src, string $alt,
                          array $tags): array {
    $ts = time();

    // Signed params: everything except file, api_key, resource_type and
    // cloud_name, sorted by key, joined k=v with &, secret appended, sha1.
    //
    // f_jpg IS NOT OPTIONAL. c_limit preserves the source format, so without it
    // a PNG stays a PNG and stays enormous: the first run stored a 1920x1080
    // Kensington render at 9,417 KB and a 1152x928 Bristol render at 1,227 KB,
    // against 39 KB for an Oxford JPEG of twice the pixel count. One 13.4 MB PNG
    // was refused outright by the 10 MB ceiling. Extrapolated across 316 images
    // that is ~300 MB — roughly 300 credits against a 25-credit plan.
    //
    // b_white flattens alpha. Most of these renders are opaque, but
    // Kensington_Solo_Closed_f_*.png carries transparency, and a JPEG cannot.
    // White is where these product renders belong, so flattening is correct
    // rather than merely safe.
    $signed = [
        'context'        => 'alt=' . str_replace(['|', '='], ['-', '-'], $alt),
        'overwrite'      => 'false',   // a public_id is frozen once written
        'public_id'      => $publicId,
        'tags'           => implode(',', $tags),
        'timestamp'      => (string)$ts,
        'transformation' => 'c_limit,w_' . CAP . ',h_' . CAP . ',f_jpg,q_auto:good,b_white',
        'unique_filename'=> 'false',
    ];
    ksort($signed);
    $toSign = [];
    foreach ($signed as $k => $v) $toSign[] = "$k=$v";
    $signature = sha1(implode('&', $toSign) . $secret);

    $post = $signed + ['file' => $src, 'api_key' => $key, 'signature' => $signature];

    $ch = curl_init(API_BASE . $cloud . '/image/upload');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($post),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => HTTP_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 20,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr = curl_error($ch);
    curl_close($ch);

    if ($body === false) return ['ok' => false, 'note' => 'curl: ' . $cerr];
    $j = json_decode($body, true);
    if (!is_array($j))   return ['ok' => false, 'note' => "http $code: non-JSON"];
    if (isset($j['error'])) return ['ok' => false, 'note' => "http $code: " . ($j['error']['message'] ?? 'error')];
    if ($code < 200 || $code >= 300) return ['ok' => false, 'note' => "http $code"];

    return ['ok' => true, 'data' => $j];
}

// -------------------------------------------------------------------- main
$fh  = fopen($mapPath, 'r');
$hdr = fgetcsv($fh);
if ($hdr === false) { logline('FATAL: map is empty'); exit(2); }
$hdr[0] = preg_replace('/^\xEF\xBB\xBF/', '', $hdr[0]);   // strip BOM

$rows = [];
while (($r = fgetcsv($fh)) !== false) {
    if (count($r) < count($hdr)) $r = array_pad($r, count($hdr), '');
    $rows[] = array_combine($hdr, array_slice($r, 0, count($hdr)));
}
fclose($fh);

$journal = readJournal($jrnPath);

if ($report) {
    $c = ['ok' => 0, 'failed' => 0];
    foreach ($journal as $j) { $c[$j['status']] = ($c[$j['status']] ?? 0) + 1; }
    $uploads = array_filter($rows, fn($r) => ($r['upload'] ?? '') === 'yes');
    logline('journal: ' . json_encode($c) . '  of ' . count($uploads) . ' uploads in the map');
    foreach ($journal as $j) if ($j['status'] !== 'ok') logline('  FAILED ' . $j['public_id'] . ' — ' . $j['note']);
    exit(0);
}

/* ── --redo-png ───────────────────────────────────────────────────────────
   Surgical repair for the first full run, which stored every PNG source AS a
   PNG because c_limit preserves the source format. 101 of 316 uploads came
   from PNG; the smallest was 1,157 KB and six exceeded the 10 MB ceiling and
   failed outright. The 215 JPEG-sourced assets are fine and are left alone —
   their public_ids stay exactly as they are.

   Deletes only the PNG-sourced ids, drops them from the journal, and leaves an
   ordinary --confirm-upload to put them back with f_jpg applied. */
if (array_key_exists('redo-png', $opt)) {
    $png = [];
    foreach ($rows as $r) {
        if (($r['upload'] ?? '') !== 'yes') continue;
        if (($r['source'] ?? '') !== 'shopify') continue;
        if (!preg_match('/\.png$/i', $r['source_file'] ?? '')) continue;
        $png[] = $r['public_id'];
    }
    $png = array_values(array_unique($png));
    logline(sprintf('%d PNG-sourced assets in the map (of %d uploads)',
        count($png), count(array_filter($rows, fn($r) => ($r['upload'] ?? '') === 'yes'))));

    $inJournal = array_values(array_filter($png, fn($p) => isset($journal[$p])));
    logline(sprintf('%d of them are in the journal and would be deleted + requeued', count($inJournal)));

    if (!array_key_exists('confirm-delete', $opt)) {
        logline('DRY RUN — nothing deleted. Add --confirm-delete to act.');
        foreach (array_slice($png, 0, 8) as $p) logline('  would delete  ' . $p);
        if (count($png) > 8) logline('  … and ' . (count($png) - 8) . ' more');
        exit(0);
    }
    if ($cloud === '' || $key === '' || $secret === '') {
        logline('FATAL: credentials are not set.'); exit(2);
    }

    $deleted = 0; $missing = 0; $failed = 0;
    foreach (array_chunk($png, DESTROY_BATCH) as $chunk) {
        $qs = 'public_ids[]=' . implode('&public_ids[]=', array_map('urlencode', $chunk));
        $ch = curl_init(API_BASE . $cloud . '/resources/image/upload?' . $qs);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'DELETE',
            CURLOPT_USERPWD        => $key . ':' . $secret,
            CURLOPT_HTTPAUTH       => CURLAUTH_BASIC,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => HTTP_TIMEOUT,
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $j = json_decode((string)$body, true);
        if ($code < 200 || $code >= 300 || !is_array($j)) {
            logline("  batch FAILED http $code: " . substr((string)$body, 0, 200));
            $failed += count($chunk);
            continue;
        }
        foreach (($j['deleted'] ?? []) as $id => $state) {
            if ($state === 'deleted')       { $deleted++; }
            elseif ($state === 'not_found') { $missing++; }
            else                            { $failed++; logline("  $id -> $state"); }
        }
        logline(sprintf('  batch of %d: %d deleted so far, %d not found', count($chunk), $deleted, $missing));
    }

    // Drop them from the journal so the next run re-uploads exactly these.
    // A failed delete must NOT be requeued: overwrite=false means the upload
    // would be refused and the asset would stay a PNG while the log said ok.
    if ($failed === 0) {
        $kept = 0; $dropped = 0;
        $tmp = $jrnPath . '.tmp';
        $fh2 = fopen($tmp, 'w');
        fputcsv($fh2, ['public_id','status','secure_url','width','height','bytes','format','note','at']);
        $drop = array_flip($png);
        foreach ($journal as $pid => $j2) {
            if (isset($drop[$pid])) { $dropped++; continue; }
            fputcsv($fh2, [$j2['public_id'], $j2['status'], $j2['secure_url'] ?? '',
                           $j2['width'] ?? '', $j2['height'] ?? '', $j2['bytes'] ?? '',
                           $j2['format'] ?? '', $j2['note'] ?? '', $j2['at'] ?? '']);
            $kept++;
        }
        fclose($fh2);
        rename($tmp, $jrnPath);
        logline("journal rewritten: $kept kept, $dropped requeued");
    } else {
        logline("journal NOT touched — $failed deletes failed, so requeuing would");
        logline("silently no-op against overwrite=false. Fix those first.");
    }

    logline("done: $deleted deleted, $missing already gone, $failed failed");
    logline('next: ./bvosync_cloudinary.sh --confirm-upload');
    exit($failed > 0 ? 1 : 0);
}

$todo = [];
foreach ($rows as $r) {
    if (($r['upload'] ?? '') !== 'yes') continue;                 // reference row
    if ($only !== '' && strcasecmp($r['collection'], $only) !== 0) continue;
    if (isset($journal[$r['public_id']]) && $journal[$r['public_id']]['status'] === 'ok') continue;
    $todo[] = $r;
}

logline(sprintf('map %d rows | %d to upload%s%s',
    count($rows), count($todo),
    $only !== '' ? " | only=$only" : '',
    $limit ? " | limit=$limit" : ''));

if (!$confirm) {
    logline('DRY RUN — nothing will be uploaded. Add --confirm-upload to write.');
    foreach (array_slice($todo, 0, $limit ?: 10) as $r) {
        logline('  would upload  ' . $r['public_id']);
        logline('           from ' . cappedSource($r['source_url'], $r['source']));
    }
    if (count($todo) > ($limit ?: 10)) logline('  … and ' . (count($todo) - ($limit ?: 10)) . ' more');
    exit(0);
}

if ($cloud === '' || $key === '' || $secret === '') {
    logline('FATAL: CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET are not set.');
    logline('       Set them in the wrapper on the server, not on the command line.');
    exit(2);
}

$done = 0; $ok = 0; $bad = 0;
foreach ($todo as $r) {
    if ($limit && $done >= $limit) { logline("limit $limit reached"); break; }
    if ((time() - $started) > $maxMin * 60) {
        logline("stopping at {$maxMin}m — the journal will resume this on the next run");
        break;
    }

    $tags = ['er-vanities', strtolower($r['collection']), $r['rflpos_sku'], $r['shot_type']];

    /* The 10 MB ceiling is enforced on the file Cloudinary FETCHES, not on what
       it stores, so f_jpg cannot rescue an oversized source — the request is
       refused before any transformation runs. Six Atlanta_Ls_Closed_f_*.png
       renders are 13.1-13.7 MB at ?width=2048, and Shopify ignores &format=jpg
       (verified: still image/png, same bytes). A narrower request is the only
       lever, and 1600 brings that same file to 8,165 KB.

       Only the widths are stepped down, and only on this specific error. The 95
       PNGs that fetch fine at 2048 are never touched, so nothing is degraded to
       fix six files. */
    $width = CAP; $src = cappedSource($r['source_url'], $r['source'], $width);
    $res   = cloudinaryUpload($cloud, $key, $secret, $r['public_id'], $src, $r['alt_text'], $tags);

    if (!$res['ok'] && str_contains($res['note'], 'File size too large')) {
        foreach (FALLBACK_WIDTHS as $w) {
            logline(sprintf('  retry %s at width=%d (source too large at %d)',
                basename($r['public_id']), $w, $width));
            $width = $w;
            $src   = cappedSource($r['source_url'], $r['source'], $w);
            $res   = cloudinaryUpload($cloud, $key, $secret, $r['public_id'], $src, $r['alt_text'], $tags);
            if ($res['ok'] || !str_contains($res['note'], 'File size too large')) break;
        }
    }
    $done++;

    if ($res['ok']) {
        $d = $res['data'];
        appendJournal($jrnPath, [
            'public_id' => $r['public_id'], 'status' => 'ok',
            'secure_url' => $d['secure_url'] ?? '', 'width' => $d['width'] ?? '',
            'height' => $d['height'] ?? '', 'bytes' => $d['bytes'] ?? '',
            'format' => $d['format'] ?? '', 'note' => '',
        ]);
        $ok++;
        logline(sprintf('  ok   %s  %sx%s  %s KB',
            $r['public_id'], $d['width'] ?? '?', $d['height'] ?? '?',
            isset($d['bytes']) ? (string)round($d['bytes'] / 1024) : '?'));
    } else {
        appendJournal($jrnPath, ['public_id' => $r['public_id'], 'status' => 'failed',
                                 'note' => $res['note']]);
        $bad++;
        logline('  FAIL ' . $r['public_id'] . ' — ' . $res['note']);
    }
    usleep(250000);   // gentle on the Upload API
}

logline("done: $ok uploaded, $bad failed, " . max(0, count($todo) - $done) . ' still queued');
exit($bad > 0 ? 1 : 0);
