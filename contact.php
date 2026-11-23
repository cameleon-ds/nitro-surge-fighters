<?php
/* Nitro Surge Fighters — contact form endpoint (OVH web hosting, PHP mail()).
   Receives the footer form via fetch() and emails it to the team. */
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');

const TO_EMAIL   = 'nsf.helloteam@gmail.com';
const FROM_EMAIL = 'no-reply@nitrosurgefighters.com';   // must be on the site's domain for OVH to send it
const FROM_NAME  = 'Nitro Surge Fighters';

const TOKEN_SECRET = '18e1d66c843ea75443156791927db499aca943bd11fe1ae7';   // signs the anti-spam tokens (keep it private)

function reply(int $code, array $data): void { http_response_code($code); echo json_encode($data); exit; }
function make_token(): string { $t = (string)time(); return $t . '.' . hash_hmac('sha256', $t, TOKEN_SECRET); }
function token_ok(string $tok): bool {
  $p = explode('.', $tok); if (count($p) !== 2 || !ctype_digit($p[0])) return false;
  if (!hash_equals(hash_hmac('sha256', $p[0], TOKEN_SECRET), $p[1])) return false;
  $age = time() - (int)$p[0]; return $age >= 3 && $age <= 7200;      // the page was open between 3 s and 2 h
}

// GET ?token=1 : the page asks for a fresh signed token
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['token'])) { header('Cache-Control: no-store'); reply(200, ['token' => make_token()]); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['ok' => false, 'error' => 'method']);

$name    = trim((string)($_POST['name'] ?? ''));
$email   = trim((string)($_POST['email'] ?? ''));
$message = trim((string)($_POST['message'] ?? ''));
$trap    = trim((string)($_POST['website'] ?? ''));      // hidden field: humans leave it empty
$started = (int)($_POST['started'] ?? 0);               // ms timestamp when the page loaded

// spam bots: filled the hidden field, or submitted in under 3 seconds → pretend it worked
if ($trap !== '' || ($started > 0 && (microtime(true) * 1000 - $started) < 3000)) reply(200, ['ok' => true]);

// HOLD + SURGE + Y Y B B challenge: the combo must be done and the signed token valid
if (($_POST['combo'] ?? '') !== 'YYBB' || !token_ok((string)($_POST['token'] ?? ''))) reply(403, ['ok' => false, 'error' => 'combo']);

if ($name === '' || mb_strlen($name) > 100) reply(422, ['ok' => false, 'error' => 'name']);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 160) reply(422, ['ok' => false, 'error' => 'email']);
if ($message === '' || mb_strlen($message) > 3000) reply(422, ['ok' => false, 'error' => 'message']);

// no header injection
$name  = preg_replace('/[\r\n]+/', ' ', $name);
$email = preg_replace('/[\r\n]+/', '', $email);

// simple rate limit: one message per 30 s per visitor IP
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$stamp = sys_get_temp_dir() . '/nsf_contact_' . md5($ip);
if (is_file($stamp) && time() - (int)@file_get_contents($stamp) < 30) reply(429, ['ok' => false, 'error' => 'wait']);
@file_put_contents($stamp, (string)time());

$subject = 'Nitro Surge Fighters — message from ' . $name;
$body = "Name: $name\nEmail: $email\nSent from: https://nitrosurgefighters.com/\nIP: $ip\n\n" . $message . "\n";
$headers = [
  'From: ' . mb_encode_mimeheader(FROM_NAME, 'UTF-8') . ' <' . FROM_EMAIL . '>',
  'Reply-To: ' . mb_encode_mimeheader($name, 'UTF-8') . ' <' . $email . '>',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: 8bit',
];
$sent = @mail(TO_EMAIL, mb_encode_mimeheader($subject, 'UTF-8'), $body, implode("\r\n", $headers), '-f' . FROM_EMAIL);

$sent ? reply(200, ['ok' => true]) : reply(500, ['ok' => false, 'error' => 'send']);
