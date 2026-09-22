<?php
/**
 * ER Vanities use manuals -> Cloudinary (resource_type: raw).
 *
 * Different shape from bvo_cloudinary_push.php, and the difference matters:
 * the image pusher hands Cloudinary a URL and Cloudinary fetches the bytes, so
 * nothing transits this server. A PDF sitting on disk has no URL, so this one
 * POSTs the file itself. That is the ONLY reason the manuals have to be on the
 * server at all.
 *
 * Everything else is deliberately the same as the image pusher, because those
 * behaviours were each paid for once already:
 *
 *   - credentials from the environment, never an argument (arguments show up
 *     in error text and process listings)
 *   - overwrite=false, so a public_id is frozen once written
 *   - a journal, so a run killed at the 30-minute cron limit resumes instead
 *     of restarting
 *   - --dry-run and --report do not need --confirm-upload; nothing uploads
 *     without it
 *
 * Usage:
 *   php bvo_manuals_push.php --map=... --journal=... --dir=... --dry-run
 *   php bvo_manuals_push.php --map=... --journal=... --dir=... --confirm-upload
 *   php bvo_manuals_push.php --journal=... --report
 */

declare(strict_types=1);

const API_BASE     = 'https://api.cloudinary.com/v1_1/';
const HTTP_TIMEOUT = 180;          // a 3.4 MB POST, not a fetch instruction
const MAX_BYTES    = 10485760;     // Cloudinary free-plan per-file ceiling

// ---------------------------------------------------------------------------

function args(): array {
    $a = [];
    foreach (array_slice($_SERVER['argv'], 1) as $s) {
        if (preg_match('/^--([a-z-]+)(?:=(.*))?$/', $s, $m)) {
            $a[$m[1]] = $m[2] ?? true;
        }
    }
    return $a;
}

function logline(string $s): void {
    echo '[' . date('H:i:s') . '] ' . $s . "\n";
}

function readCsv(string $path): array {
    $fh = fopen($path, 'r');
    if (!$fh) { fwrite(STDERR, "cannot read $path\n"); exit(66); }
    $head = fgetcsv($fh);
    if (!$head) { fclose($fh); return []; }
    $head[0] = preg_replace('/^\xEF\xBB\xBF/', '', $head[0]);
    $out = [];
    while (($r = fgetcsv($fh)) !== false) {
        if (count($r) === 1 && trim((string)$r[0]) === '') continue;
        $out[] = array_combine($head, array_pad(array_slice($r, 0, count($head)), count($head), ''));
    }
    fclose($fh);
    return $out;
}

/** Journal: public_id -> status. Written after every row so a kill is safe. */
function loadJournal(string $path): array {
    if (!is_readable($path)) return [];
    $j = [];
    foreach (readCsv($path) as $r) $j[$r['public_id']] = $r['status'];
    return $j;
}

function saveJournal(string $path, array $j): void {
    $tmp = $path . '.tmp';
    $fh  = fopen($tmp, 'w');
    fputcsv($fh, ['public_id', 'status']);
    foreach ($j as $k => $v) fputcsv($fh, [$k, $v]);
    fclose($fh);
    rename($tmp, $path);          // atomic; a kill mid-write cannot truncate it
}

/**
 * Signed raw upload. Signature rule is the same as the image pusher: sort the
 * signed params by key, join k=v with &, append the secret, sha1. `file`,
 * `api_key`, `resource_type` and `cloud_name` are excluded from the signature.
 */
function upload(string $cloud, string $key, string $secret,
                string $publicId, string $path, array $tags): array {
    $ts = time();
    $signed = [
        'overwrite'       => 'false',
        'public_id'       => $publicId,
        'tags'            => implode(',', $tags),
        'timestamp'       => (string)$ts,
        'unique_filename' => 'false',
        'use_filename'    => 'false',
    ];
    ksort($signed);
    $pairs = [];
    foreach ($signed as $k => $v) $pairs[] = "$k=$v";
    $sig = sha1(implode('&', $pairs) . $secret);

    $post = $signed + [
        'api_key'   => $key,
        'signature' => $sig,
        'file'      => new CURLFile($path, 'application/pdf', basename($path)),
    ];

    $ch = curl_init(API_BASE . $cloud . '/raw/upload');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $post,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => HTTP_TIMEOUT,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($body === false)  return ['ok' => false, 'note' => 'curl: ' . $err];
    $j = json_decode((string)$body, true);
    if ($code >= 200 && $code < 300 && isset($j['secure_url'])) {
        return ['ok' => true, 'note' => $j['secure_url']];
    }
    return ['ok' => false, 'note' => 'HTTP ' . $code . ' ' . ($j['error']['message'] ?? substr((string)$body, 0, 200))];
}

// ---------------------------------------------------------------------------

$a       = args();
$journal = $a['journal'] ?? '';
if ($journal === '') { fwrite(STDERR, "--journal is required\n"); exit(64); }

$j = loadJournal($journal);

if (isset($a['report'])) {
    $c = array_count_values($j);
    echo json_encode($c ?: ['queued' => 0]), "\n";
    exit(0);
}

$map = $a['map'] ?? '';
$dir = rtrim((string)($a['dir'] ?? ''), '/');
if ($map === '' || $dir === '') { fwrite(STDERR, "--map and --dir are required\n"); exit(64); }

$rows    = readCsv($map);
$confirm = isset($a['confirm-upload']);
$maxMin  = (int)($a['max-minutes'] ?? 25);
$started = time();

$cloud  = getenv('CLOUDINARY_CLOUD_NAME') ?: '';
$key    = getenv('CLOUDINARY_API_KEY')    ?: '';
$secret = getenv('CLOUDINARY_API_SECRET') ?: '';
if ($confirm && ($cloud === '' || $key === '' || $secret === '')) {
    fwrite(STDERR, "CLOUDINARY_* not in environment\n");
    exit(78);
}

$ok = $skip = $fail = 0;

foreach ($rows as $r) {
    if ((time() - $started) > $maxMin * 60) {
        logline("stopping at {$maxMin}m; journal will resume the rest");
        break;
    }

    $pid  = $r['public_id'];
    $path = $dir . '/' . $r['source_file'];

    if (($j[$pid] ?? '') === 'ok') { $skip++; continue; }

    if (!is_readable($path)) {
        logline("MISSING $path");
        $j[$pid] = 'missing';
        $fail++;
        saveJournal($journal, $j);
        continue;
    }
    $bytes = filesize($path);
    if ($bytes > MAX_BYTES) {
        // No transformation can rescue this: the ceiling applies to the file
        // Cloudinary receives. Same class of mistake as the oversized PNGs.
        logline(sprintf("TOO LARGE %s (%.1f MB > 10 MB)", basename($path), $bytes / 1048576));
        $j[$pid] = 'too_large';
        $fail++;
        saveJournal($journal, $j);
        continue;
    }

    if (!$confirm) {
        logline(sprintf("would upload %-58s %6.2f MB", $pid, $bytes / 1048576));
        $ok++;
        continue;
    }

    $tags = ['er-vanities', 'manual', strtolower(explode('-', $r['model'])[0])];
    $res  = upload($cloud, $key, $secret, $pid, $path, $tags);
    if ($res['ok']) {
        logline("ok   $pid");
        $j[$pid] = 'ok';
        $ok++;
    } else {
        logline("FAIL $pid — {$res['note']}");
        $j[$pid] = 'failed';
        $fail++;
    }
    saveJournal($journal, $j);
}

logline(sprintf('%s: ok=%d skipped=%d failed=%d',
    $confirm ? 'uploaded' : 'dry-run', $ok, $skip, $fail));
exit($fail > 0 ? 1 : 0);
