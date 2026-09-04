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

// ---------------------------------------------------------------- arguments
$opt = getopt('', ['map:', 'journal:', 'limit::', 'max-minutes::', 'dry-run',
                   'confirm-upload', 'report', 'only::']);

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
function cappedSource(string $url, string $source): string {
    if ($source === 'drive') {
        // The map stores drive.google.com/uc?id=<id>; lh3 serves the bytes and
        // honours =s<N>, which caps the LONG edge and never upscales.
        if (preg_match('/[?&]id=([A-Za-z0-9_-]+)/', $url, $m)) {
            return 'https://lh3.googleusercontent.com/d/' . $m[1] . '=s' . CAP;
        }
        return $url;
    }
    // Shopify: ?width=N caps the width. A file already narrower comes back
    // untouched rather than upscaled.
    return $url . (str_contains($url, '?') ? '&' : '?') . 'width=' . CAP;
}

// ------------------------------------------------------------------ upload
function cloudinaryUpload(string $cloud, string $key, string $secret,
                          string $publicId, string $src, string $alt,
                          array $tags): array {
    $ts = time();

    // Signed params: everything except file, api_key, resource_type and
    // cloud_name, sorted by key, joined k=v with &, secret appended, sha1.
    $signed = [
        'context'        => 'alt=' . str_replace(['|', '='], ['-', '-'], $alt),
        'overwrite'      => 'false',   // a public_id is frozen once written
        'public_id'      => $publicId,
        'tags'           => implode(',', $tags),
        'timestamp'      => (string)$ts,
        'transformation' => 'c_limit,w_' . CAP . ',h_' . CAP,
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

    $src  = cappedSource($r['source_url'], $r['source']);
    $tags = ['er-vanities', strtolower($r['collection']), $r['rflpos_sku'], $r['shot_type']];
    $res  = cloudinaryUpload($cloud, $key, $secret, $r['public_id'], $src, $r['alt_text'], $tags);
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
