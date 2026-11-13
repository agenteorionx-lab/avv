<?php
// Ponte de envio de e-mail via motor nativo cPanel/HostGator
define('API_SECRET_TOKEN', 'AVV_SECURE_TOKEN_2026_x9k2');

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo nao permitido. Use POST.']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['token']) || $data['token'] !== API_SECRET_TOKEN) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Acesso nao autorizado.']);
    exit;
}

$to = filter_var($data['to'] ?? '', FILTER_VALIDATE_EMAIL);
if (!$to) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Destinatario invalido.']);
    exit;
}

$subject = $data['subject'] ?? 'AVV - Recuperação de Senha';
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$html = $data['html'] ?? '';

// Remetente cPanel oficial
$fromName = 'AVV - Associação Vilhenense de Voleibol';
$encodedFromName = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
$fromEmail = 'cpanel@avvvoleibol.com.br';

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'Content-type: text/html; charset=UTF-8';
$headers[] = 'From: ' . $encodedFromName . ' <' . $fromEmail . '>';
$headers[] = 'Reply-To: sistema@avvvoleibol.com.br';
$headers[] = 'X-Mailer: cPanel on avvvoleibol.com.br';

// O parametro -fcpanel@avvvoleibol.com.br forca o envelope com assinatura DKIM do servidor
$sent = mail($to, $encodedSubject, $html, implode("\r\n", $headers), "-f" . $fromEmail);

if ($sent) {
    echo json_encode(['ok' => true, 'mensagem' => 'E-mail despachado via sendmail cPanel']);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Falha ao disparar funcao mail no servidor']);
}

