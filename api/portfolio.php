<?php
require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/Portfolio.php';

require_login_api();

$pdo = get_pdo();
json_response(Portfolio::getAll($pdo));
