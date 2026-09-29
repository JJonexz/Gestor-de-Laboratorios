<?php
// ============================================================
// api.php — Backend MySQL para Gestor de Laboratorios
// Base de datos: escuela (MariaDB/MySQL)
//
// Tablas propias del gestor (creadas automáticamente):
//   gestor_labs (*), gestor_reservas, gestor_solicitudes,
//   gestor_espera, gestor_pautas
//
// (* gestor_labs se mantiene para el campo 'ocupado' y max_grupos
//    que no existen en la tabla salones original)
//
// Profesores: tabla `personal` de la BDD escuela (sin gestor_profesores)
// Autenticación: tabla `personal` (dni + pass)
// Roles: tabla `usuarios2` (usuario = DNI, tipo = 'Administrador' | 'Director').
//        Quien no figura ahí es docente.
// ============================================================

ini_set('display_errors', 0);
error_reporting(E_ALL);
set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'file' => basename($e->getFile()), 'line' => $e->getLine()], JSON_UNESCAPED_UNICODE);
    exit;
});
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    throw new ErrorException($errstr, $errno, 0, $errfile, $errline);
});

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
// Ningún proxy, hosting ni navegador debe guardar respuestas de la API: si la
// recarga recibe un `all` cacheado, los cambios parecen "volver a su lugar".
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── Configuración MySQL ──────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'escuela');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_PORT', 3306);

// ── Conectar a MySQL ─────────────────────────────────────────
function getDB() {
    static $pdo = null;
    if ($pdo) return $pdo;

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT
         . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // autocommit=1 explícito: hay servidores MySQL hosteados que lo apagan
        // (init_connect='SET autocommit=0'). Así un UPDATE sin transacción
        // quedaba sin confirmar y se deshacía al terminar el request, aunque la
        // respuesta ya mostrara los valores nuevos.
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, autocommit = 1",
    ]);

    return $pdo;
}

// ── Schema mínimo: solo tablas que NO existen en la BDD escuela ──
function initSchema($pdo) {
    // gestor_labs: se mantiene para 'ocupado' y 'max_grupos' (no están en salones)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS gestor_labs (
            id        VARCHAR(10) NOT NULL,
            ocupado   TINYINT NOT NULL DEFAULT 0,
            max_grupos TINYINT NOT NULL DEFAULT 2,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS gestor_reservas (
            id           INT NOT NULL AUTO_INCREMENT,
            semanaOffset INT NOT NULL DEFAULT 0,
            dia          TINYINT NOT NULL,
            modulo       TINYINT NOT NULL,
            lab          VARCHAR(10) NOT NULL,
            curso        VARCHAR(20) NOT NULL,
            orient       VARCHAR(50) NOT NULL DEFAULT 'bas',
            profeId      VARCHAR(50) NOT NULL,
            secuencia    VARCHAR(500) NOT NULL DEFAULT '',
            cicloClases  TINYINT NOT NULL DEFAULT 1,
            renovaciones TINYINT NOT NULL DEFAULT 0,
            anual        TINYINT NOT NULL DEFAULT 0,
            grupoId      INT DEFAULT NULL,
            cupofId      INT DEFAULT NULL,
            PRIMARY KEY (id),
            INDEX idx_slot (lab, dia, modulo, semanaOffset),
            INDEX idx_profe (profeId),
            INDEX idx_semana (semanaOffset)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS gestor_solicitudes (
            id                INT NOT NULL AUTO_INCREMENT,
            semanaOffset      INT NOT NULL DEFAULT 0,
            dia               TINYINT NOT NULL,
            modulo            TINYINT NOT NULL,
            lab               VARCHAR(10) NOT NULL,
            curso             VARCHAR(20) NOT NULL,
            orient            VARCHAR(50) NOT NULL DEFAULT 'bas',
            profeId           VARCHAR(50) NOT NULL,
            secuencia         VARCHAR(500) NOT NULL DEFAULT '',
            cicloClases       TINYINT NOT NULL DEFAULT 1,
            estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente',
            esRenovacion      TINYINT NOT NULL DEFAULT 0,
            reservaOriginalId INT DEFAULT NULL,
            renovacionNum     TINYINT NOT NULL DEFAULT 0,
            grupoId           INT DEFAULT NULL,
            cupofId           INT DEFAULT NULL,
            PRIMARY KEY (id),
            INDEX idx_estado (estado)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS gestor_espera (
            id           INT NOT NULL AUTO_INCREMENT,
            profeId      VARCHAR(50) NOT NULL,
            lab          VARCHAR(10) NOT NULL,
            dia          TINYINT NOT NULL,
            modulo       TINYINT NOT NULL,
            semanaOffset INT NOT NULL DEFAULT 0,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS gestor_pautas (
            id    INT NOT NULL AUTO_INCREMENT,
            texto TEXT NOT NULL,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS gestor_notificaciones (
            id        INT NOT NULL AUTO_INCREMENT,
            tipo      VARCHAR(50) NOT NULL DEFAULT 'info',
            titulo    VARCHAR(255) NOT NULL,
            cuerpo    VARCHAR(500) NOT NULL DEFAULT '',
            fecha     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            leida     TINYINT NOT NULL DEFAULT 0,
            profeId   VARCHAR(50) DEFAULT NULL,
            labId     VARCHAR(10) DEFAULT NULL,
            reservaId INT DEFAULT NULL,
            PRIMARY KEY (id),
            INDEX idx_profe (profeId),
            INDEX idx_leida (leida)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // Migración: asegurar que profeId sea VARCHAR en tablas ya existentes
    foreach (['gestor_reservas', 'gestor_solicitudes', 'gestor_espera'] as $t) {
        $col = $pdo->query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='$t' AND COLUMN_NAME='profeId' AND TABLE_SCHEMA=DATABASE()")->fetch();
        if ($col && stripos($col['COLUMN_TYPE'], 'INT') !== false) {
            $pdo->exec("ALTER TABLE $t MODIFY COLUMN profeId VARCHAR(50) NOT NULL");
        }
    }

    // Control de la sincronización semanal gestor -> horarios.
    // La clave única por semana es lo que garantiza que corra una sola vez,
    // aunque varias pestañas abran la app el mismo lunes.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS gestor_sync_horarios (
            id           INT NOT NULL AUTO_INCREMENT,
            semana       VARCHAR(10) NOT NULL,
            lunes        DATE NOT NULL,
            ejecutado_en DATETIME NOT NULL,
            insertados   INT NOT NULL DEFAULT 0,
            actualizados INT NOT NULL DEFAULT 0,
            eliminados   INT NOT NULL DEFAULT 0,
            origen       VARCHAR(16) NOT NULL DEFAULT 'auto',
            PRIMARY KEY (id),
            UNIQUE KEY uk_semana (semana)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // Migración: índice por semanaOffset. CREATE TABLE IF NOT EXISTS no lo agrega
    // a tablas que ya existían, y la ventana de semanas filtra por esa columna.
    $idx = $pdo->query("SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='gestor_reservas' AND INDEX_NAME='idx_semana'")->fetch();
    if (!$idx) {
        $pdo->exec("ALTER TABLE gestor_reservas ADD INDEX idx_semana (semanaOffset)");
    }

    // Sincronizar salones → gestor_labs (solo para ocupado/max_grupos)
    $hasSalones = $pdo->query("SHOW TABLES LIKE 'salones'")->fetch();
    if ($hasSalones) {
        // Insertar filas en gestor_labs para salones nuevos (solo si no existen)
        $pdo->exec("
            INSERT IGNORE INTO gestor_labs (id, ocupado, max_grupos)
            SELECT CAST(id_salones AS CHAR), 0, 2
            FROM salones
        ");
    }
}

// ── SQL para profesores desde `personal` ─────────────────────
// Devuelve un row compatible con el formato gestor_profesores:
// id (=dni), apellido, nombre, orientacion, materia, dni_personal
function sqlProfesores() {
    return "SELECT
        dni AS id,
        apellido,
        nombre,
        'bas' AS orientacion,
        'Docente' AS materia,
        dni AS dni_personal
    FROM personal
    WHERE dni > 0 AND TRIM(apellido) <> ''
    ORDER BY apellido, nombre";
}

// ── Helpers ──────────────────────────────────────────────────
function ok($data)  { echo json_encode(['ok'=>true,'data'=>$data], JSON_UNESCAPED_UNICODE); exit; }
function err($msg, $code=400) { http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg], JSON_UNESCAPED_UNICODE); exit; }
function body() { return json_decode(file_get_contents('php://input'), true) ?? []; }

function castRow($r) {
    $isLabRow = array_key_exists('ocupado', $r);
    foreach($r as $key => $v) {
        if (is_null($v)) { $r[$key] = null; continue; }
        if ($key === 'lab' || ($key === 'id' && (!is_numeric($v) || $isLabRow))) {
            $r[$key] = (string)$v; continue;
        }
        if (is_numeric($v) && strpos((string)$v, '.') === false && strlen((string)$v) < 10) {
            $r[$key] = (int)$v;
        } else {
            $r[$key] = $v;
        }
    }
    return $r;
}
function castRows($rows) { return array_map('castRow', $rows); }

// ── Ventana de semanas ───────────────────────────────────────
// gestor_reservas guarda `semanaOffset` relativo a la semana actual
// (0 = esta semana). Nunca devolvemos la tabla entera: sólo la ventana
// que el calendario necesita. El cliente puede ampliarla con ?desde=&hasta=.
function qWin($db, $sql, $desde, $hasta) {
    $st = $db->prepare($sql);
    $st->execute([$desde, $hasta]);
    return $st->fetchAll();
}

function ventanaSemanas() {
    $desde = isset($_GET['desde']) ? (int)$_GET['desde'] : -1;
    $hasta = isset($_GET['hasta']) ? (int)$_GET['hasta'] : 4;
    if ($hasta < $desde) $hasta = $desde;
    if ($hasta - $desde > 60) $hasta = $desde + 60;  // techo de seguridad
    return [$desde, $hasta];
}

// ── Rol del solicitante ──────────────────────────────────────
// No es autenticación real: api.php no maneja sesiones ni tokens, y el
// cliente puede falsificar el header. Sirve para que la UI no pueda saltear
// las reglas por accidente. Una autenticación de verdad es trabajo aparte.
function usuarioSolicitante($db) {
    $dni = $_SERVER['HTTP_X_GESTOR_USER'] ?? '';
    $dni = trim((string)$dni);
    if ($dni === '') return null;
    if ($dni === 'admin') return ['dni' => 0, 'esDirectivo' => true];  // admin estático del login
    if (!ctype_digit($dni)) return null;
    $st = $db->prepare('SELECT dni FROM personal WHERE dni=? LIMIT 1');
    $st->execute([(int)$dni]);
    $row = $st->fetch();
    if (!$row) return null;
    return ['dni' => (int)$row['dni'], 'esDirectivo' => tipoDirectivo($db, $row['dni']) !== null];
}

// Rol directivo desde `usuarios2`: devuelve 'Administrador' o 'Director', o
// null si el DNI no tiene rol (docente). Reemplaza al viejo `personal.tag`.
// Si la tabla todavía no existe, nadie es directivo (salvo el admin estático).
function tipoDirectivo($db, $dni) {
    static $hayTabla = null;
    if ($hayTabla === null) $hayTabla = (bool)$db->query("SHOW TABLES LIKE 'usuarios2'")->fetch();
    if (!$hayTabla) return null;
    // `usuarios2.usuario` guarda el DNI; `tipo` se escribe 'Administrador' o 'Director'
    $st = $db->prepare("SELECT tipo FROM usuarios2
                         WHERE usuario=? AND tipo IN ('Administrador','Director')
                         ORDER BY tipo='Director' DESC LIMIT 1");
    $st->execute([(string)(int)$dni]);
    $row = $st->fetch();
    return $row ? $row['tipo'] : null;
}

function esDirectivoReq($db) {
    $u = usuarioSolicitante($db);
    return $u !== null && $u['esDirectivo'];
}

// ── Mapeo gestor <-> tabla `horarios` ───────────────────
// El gestor numera los módulos 0-15 incluyendo recreos; `horarios.id_horas`
// usa 1-13 sin recreos. Espejo de moduloAHorarioAcademico() en helpers.js.
function moduloAIdHoras($m) {
    static $map = [0=>1, 1=>2, 3=>3, 4=>4, 5=>5, 6=>6, 7=>7, 9=>8, 10=>9, 11=>10, 12=>11, 14=>12, 15=>13];
    $m = (int)$m;
    return array_key_exists($m, $map) ? $map[$m] : null;   // null = recreo
}

// `horarios.dia` es VARCHAR(3): 'LUN'..'VIE' (igual que DIA_STR_A_NUM en calendario.js)
function diaAStrHorarios($d) {
    $dias = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'];
    $d = (int)$d;
    return ($d >= 0 && $d <= 4) ? $dias[$d] : null;
}

// Lunes de la semana `offset` (0 = semana en curso), según la fecha del servidor.
function lunesDeSemana($offset) {
    $d = new DateTime('today');
    $dow = (int)$d->format('N');               // 1=lunes ... 7=domingo
    $d->modify('-' . ($dow - 1) . ' days');
    $offset = (int)$offset;
    if ($offset !== 0) $d->modify(($offset > 0 ? '+' : '-') . abs($offset) . ' weeks');
    return $d;
}

// Compara la grilla del gestor de esa semana contra `horarios` y devuelve el
// plan de cambios. No escribe nada.
function planSyncHorarios($db, $semanaOffset) {
    $st = $db->prepare("
        SELECT dia, modulo, lab, cupofId
          FROM gestor_reservas
         WHERE semanaOffset = ? AND cupofId IS NOT NULL AND cupofId > 0
    ");
    $st->execute([(int)$semanaOffset]);

    $deseado = [];
    $omitidos = 0;
    foreach ($st->fetchAll() as $r) {
        $dia   = diaAStrHorarios($r['dia']);
        $hora  = moduloAIdHoras($r['modulo']);
        $salon = (int)$r['lab'];
        // Los recreos y los salones no numéricos no tienen lugar en `horarios`
        if ($dia === null || $hora === null || $salon <= 0) { $omitidos++; continue; }
        $k = $dia . '|' . $hora . '|' . (int)$r['cupofId'];
        if (!isset($deseado[$k])) {
            $deseado[$k] = ['dia'=>$dia, 'id_horas'=>$hora, 'id_salones'=>$salon, 'cupof'=>(int)$r['cupofId']];
        }
    }

    $actual = [];
    $duplicados = [];
    foreach ($db->query("SELECT id, dia, id_horas, id_salones, cupof FROM horarios")->fetchAll() as $r) {
        $k = $r['dia'] . '|' . (int)$r['id_horas'] . '|' . (int)$r['cupof'];
        if (isset($actual[$k])) { $duplicados[] = (int)$r['id']; continue; }
        $actual[$k] = $r;
    }

    $insertar = []; $actualizar = []; $eliminar = $duplicados;
    foreach ($deseado as $k => $d) {
        if (!isset($actual[$k])) { $insertar[] = $d; continue; }
        if ((int)$actual[$k]['id_salones'] !== $d['id_salones']) {
            $actualizar[] = [
                'id'         => (int)$actual[$k]['id'],
                'dia'        => $d['dia'],
                'id_horas'   => $d['id_horas'],
                'cupof'      => $d['cupof'],
                'salon_de'   => (int)$actual[$k]['id_salones'],
                'salon_a'    => $d['id_salones'],
            ];
        }
    }
    foreach ($actual as $k => $a) {
        if (!isset($deseado[$k])) $eliminar[] = (int)$a['id'];
    }

    return [
        'insertar'   => $insertar,
        'actualizar' => $actualizar,
        'eliminar'   => $eliminar,
        'omitidos'   => $omitidos,
        'en_gestor'  => count($deseado),
        'en_horarios'=> count($actual),
    ];
}

// Aplica un plan de planSyncHorarios() sobre `horarios` y lo registra en
// gestor_sync_horarios. Devuelve la cantidad de filas tocadas en `horarios`.
function aplicarPlanHorarios($db, $plan, $lunes, $origen) {
    $total = count($plan['insertar']) + count($plan['actualizar']) + count($plan['eliminar']);

    $db->beginTransaction();
    try {
        if ($plan['insertar']) {
            $ins = $db->prepare('INSERT INTO horarios (dia, id_horas, id_salones, cupof) VALUES (?,?,?,?)');
            foreach ($plan['insertar'] as $d) {
                $ins->execute([$d['dia'], $d['id_horas'], $d['id_salones'], $d['cupof']]);
            }
        }
        if ($plan['actualizar']) {
            $upd = $db->prepare('UPDATE horarios SET id_salones=? WHERE id=?');
            foreach ($plan['actualizar'] as $d) $upd->execute([$d['salon_a'], $d['id']]);
        }
        if ($plan['eliminar']) {
            $del = $db->prepare('DELETE FROM horarios WHERE id=?');
            foreach ($plan['eliminar'] as $hid) $del->execute([$hid]);
        }

        // El UNIQUE por semana evita que dos pestañas la registren dos veces.
        $log = $db->prepare('
            INSERT INTO gestor_sync_horarios (semana, lunes, ejecutado_en, insertados, actualizados, eliminados, origen)
            VALUES (?,?,NOW(),?,?,?,?)
            ON DUPLICATE KEY UPDATE
                ejecutado_en=NOW(),
                insertados=insertados+VALUES(insertados),
                actualizados=actualizados+VALUES(actualizados),
                eliminados=eliminados+VALUES(eliminados),
                origen=VALUES(origen)
        ');
        $log->execute([$lunes->format('o-\WW'), $lunes->format('Y-m-d'),
                       count($plan['insertar']), count($plan['actualizar']), count($plan['eliminar']), $origen]);
        $db->commit();
    } catch (Exception $e) { $db->rollBack(); throw $e; }

    return $total;
}

// Después de cualquier alta/baja/cambio en gestor_reservas: deja `horarios`
// igual a lo que el gestor tiene en la semana en curso. Sólo escribe si hay
// diferencias. Un fallo acá no debe tirar abajo el cambio de la reserva (que ya
// quedó guardado): se registra en el log y la próxima sincronización lo corrige.
function syncHorariosTrasCambio($db) {
    try {
        $plan = planSyncHorarios($db, 0);
        if (!$plan['insertar'] && !$plan['actualizar'] && !$plan['eliminar']) return;
        aplicarPlanHorarios($db, $plan, lunesDeSemana(0), 'cambio');
    } catch (Exception $e) {
        error_log('[sync-horarios] No se pudo actualizar `horarios` tras un cambio: ' . $e->getMessage());
    }
}

// ── Reglas de ciclo: 3 semanas seguidas + 1 de espera ────────
define('MAX_SEMANAS_SEGUIDAS', 3);

// Semanas ya tomadas por ese docente en ese slot exacto (lab+día+módulo).
// Las reservas anuales ('institucional') no cuentan para el cooldown.
function semanasTomadasSlot($db, $profeId, $lab, $dia, $modulo) {
    $st = $db->prepare("
        SELECT semanaOffset FROM gestor_reservas
         WHERE profeId=? AND lab=? AND dia=? AND modulo=? AND anual=0
        UNION
        SELECT semanaOffset FROM gestor_solicitudes
         WHERE profeId=? AND lab=? AND dia=? AND modulo=? AND estado='pendiente'
    ");
    $st->execute([$profeId, $lab, (int)$dia, (int)$modulo, $profeId, $lab, (int)$dia, (int)$modulo]);
    $set = [];
    foreach ($st->fetchAll() as $r) $set[(int)$r['semanaOffset']] = true;
    return $set;
}

// Largo de la racha consecutiva que termina justo antes de $semana.
function rachaPrevia($tomadas, $semana) {
    $n = 0; $w = (int)$semana - 1;
    while (isset($tomadas[$w])) { $n++; $w--; }
    return $n;
}

// Lanza 409 si $semana cae en la semana de espera. Marca $semana como tomada.
function validarCooldown(&$tomadas, $semana, $profeId, $etiquetaSlot) {
    if ($profeId === 'institucional') { return; }  // las anuales están exentas
    if (rachaPrevia($tomadas, $semana) >= MAX_SEMANAS_SEGUIDAS) {
        err('Ya usaste ' . MAX_SEMANAS_SEGUIDAS . ' semanas seguidas en ' . $etiquetaSlot .
            '. Corresponde 1 semana de espera antes de volver a reservarlo.', 409);
    }
    $tomadas[(int)$semana] = true;
}

// ── Router ───────────────────────────────────────────────────
$method   = $_SERVER['REQUEST_METHOD'];
$path     = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$path     = preg_replace('#^.*?api\.php/?#', '', $path);
// array_filter() a secas descarta los segmentos '0' (son falsy en PHP), y la
// ruta de borrado de series es api.php/reservas/0/serie: sin el '0' el router
// leia $id='serie' y borraba por id en vez de borrar la serie.
$segments = array_values(array_filter(explode('/', $path), function($seg) { return $seg !== ''; }));
$resource = $segments[0] ?? '';
$id       = $segments[1] ?? null;
$action   = $segments[2] ?? null;
// Ojo: $id puede ser la cadena '0' (falsy en PHP), asi que las guardas de
// ruta comparan con !== null y no por veracidad.

try { $db = getDB(); }
catch (Exception $e) { err('No se pudo conectar a la base de datos MySQL: ' . $e->getMessage(), 500); }

switch ($resource) {

    // ── AUTH / LOGIN ──────────────────────────────────────────
    case 'auth':
    case 'login':
        initSchema($db);
        if ($method !== 'POST') err('Method not allowed', 405);
        $b        = body();
        $username = strtolower(trim($b['username'] ?? ''));
        $password = $b['password'] ?? '';

        $row = null;

        // Por DNI numérico
        if (is_numeric($username)) {
            $s = $db->prepare("SELECT * FROM personal WHERE dni=? LIMIT 1");
            $s->execute([(int)$username]);
            $row = $s->fetch() ?: null;
        }

        // Por apellido.primerNombre
        if (!$row) {
            $s = $db->prepare(
                "SELECT * FROM personal
                 WHERE LOWER(CONCAT(
                     REPLACE(LOWER(TRIM(apellido)), ' ', ''),
                     '.',
                     LOWER(SUBSTRING_INDEX(TRIM(nombre), ' ', 1))
                 )) = ? LIMIT 1"
            );
            $s->execute([$username]);
            $row = $s->fetch() ?: null;
        }

        // Por apellido solo
        if (!$row) {
            $s = $db->prepare(
                "SELECT * FROM personal WHERE LOWER(REPLACE(TRIM(apellido),' ',''))=? LIMIT 1"
            );
            $s->execute([str_replace(' ', '', $username)]);
            $row = $s->fetch() ?: null;
        }

        if (!$row) err('Usuario no encontrado', 401);
        if ($row['pass'] !== $password) err('Contraseña incorrecta', 401);

        $display = ucwords(strtolower(trim($row['apellido'])));
        $tipo = tipoDirectivo($db, $row['dni']);   // 'Administrador' | 'Director' | null
        $computedRole = $tipo !== null ? 'admin' : 'prof';

        // profeId = dni del personal (el mismo id que usamos en PROFESORES)
        ok([
            'id'      => (int)$row['dni'],
            'display' => ($computedRole === 'admin' ? '' : 'Prof. ') . $display,
            'role'    => $computedRole,
            'tipo'    => $tipo ?? '',
            'profeId' => (int)$row['dni'],   // dni directo, sin gestor_profesores
        ]);

    // ── WHOAMI (diagnóstico de rol) ───────────────────────────
    // Qué rol le asigna el servidor al usuario del header X-Gestor-User.
    // Lo usa "Verificar rol" del menú de usuario, para diagnosticar sin consola.
    case 'whoami':
        if ($method !== 'GET') err('Method not allowed', 405);
        $hdr = trim((string)($_SERVER['HTTP_X_GESTOR_USER'] ?? ''));
        $info = [
            'usuario_header'   => $hdr,
            'en_personal'      => false,
            'tabla_usuarios2'  => (bool)$db->query("SHOW TABLES LIKE 'usuarios2'")->fetch(),
            'filas_usuarios2'  => [],     // `tipo` tal cual está guardado, para detectar errores de tipeo
            'tipo'             => null,
            'esDirectivo'      => false,
            'error_usuarios2'  => null,
        ];
        try { $info['esDirectivo'] = esDirectivoReq($db); }
        catch (Exception $e) { $info['error_usuarios2'] = $e->getMessage(); }
        if (ctype_digit($hdr)) {
            $st = $db->prepare('SELECT 1 FROM personal WHERE dni=? LIMIT 1');
            $st->execute([(int)$hdr]);
            $info['en_personal'] = (bool)$st->fetch();
            if ($info['tabla_usuarios2']) {
                try {
                    $st = $db->prepare('SELECT tipo FROM usuarios2 WHERE usuario=?');
                    $st->execute([(string)(int)$hdr]);
                    $info['filas_usuarios2'] = array_column($st->fetchAll(), 'tipo');
                    $info['tipo'] = tipoDirectivo($db, $hdr);
                } catch (Exception $e) {
                    // p.ej. la tabla existe pero las columnas no se llaman usuario / tipo
                    $info['error_usuarios2'] = $e->getMessage();
                }
            }
        }
        ok($info);

    // ── PERSONAL (búsqueda de docentes) ──────────────────────
    case 'personal':
        if ($method !== 'GET') err('Method not allowed', 405);
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) ok([]);
        $s = $db->prepare(
            "SELECT dni,apellido,nombre,email FROM personal
             WHERE apellido LIKE ? OR nombre LIKE ?
             ORDER BY apellido,nombre LIMIT 20"
        );
        $s->execute(["%$q%", "%$q%"]);
        ok(castRows($s->fetchAll()));

    // ── LABS ──────────────────────────────────────────────────
    // Lee de `salones` y combina con `gestor_labs` para ocupado/max_grupos
    case 'labs':
        if ($method === 'GET') {
            $rows = $db->query("
                SELECT
                    CAST(s.id_salones AS CHAR) AS id,
                    CONCAT(s.tipo, ' ', s.numero) AS nombre,
                    COALESCE(gl.ocupado, 0) AS ocupado,
                    s.capacidad,
                    CONCAT('Ubicación: ', s.ubicacion) AS notas,
                    s.numero,
                    s.piso,
                    s.tipo,
                    COALESCE(gl.max_grupos, 2) AS max_grupos
                FROM salones s
                LEFT JOIN gestor_labs gl ON gl.id = CAST(s.id_salones AS CHAR)
                ORDER BY s.numero, s.tipo
            ")->fetchAll();
            ok(castRows($rows));
        }
        // PUT: solo actualizar ocupado/max_grupos en gestor_labs
        if ($method === 'PUT' && $id !== null) {
            $b = body();
            $db->prepare("INSERT INTO gestor_labs (id, ocupado, max_grupos) VALUES (?,?,?)
                          ON DUPLICATE KEY UPDATE ocupado=VALUES(ocupado), max_grupos=VALUES(max_grupos)")
               ->execute([$id, (int)($b['ocupado']??0), (int)($b['max_grupos']??2)]);
            // Devolver fila combinada
            $row = $db->prepare("
                SELECT CAST(s.id_salones AS CHAR) AS id,
                    CONCAT(s.tipo,' ',s.numero) AS nombre,
                    COALESCE(gl.ocupado,0) AS ocupado,
                    s.capacidad,
                    CONCAT('Ubicación: ',s.ubicacion) AS notas,
                    s.numero,
                    s.piso,
                    s.tipo,
                    COALESCE(gl.max_grupos,2) AS max_grupos
                FROM salones s
                LEFT JOIN gestor_labs gl ON gl.id=CAST(s.id_salones AS CHAR)
                WHERE s.id_salones=?
            ");
            $row->execute([$id]);
            ok(castRow($row->fetch()));
        }
        // POST/DELETE de labs ya no tienen sentido (los labs vienen de salones)
        // Los dejamos como no soportados
        err('Labs se gestionan desde la tabla salones. Solo se admite GET y PUT (ocupado/max_grupos).', 405);

    // ── PROFESORES — desde `personal` ────────────────────────
    case 'profesores':
        if ($method === 'GET') {
            $repeat = isset($_GET['repeat']) ? max(1, (int)$_GET['repeat']) : 1;
            $data = castRows($db->query(sqlProfesores())->fetchAll());
            if ($repeat > 1) {
                $expanded = [];
                for ($i=0; $i<$repeat; $i++) $expanded = array_merge($expanded, $data);
                $data = $expanded;
            }
            ok($data);
        }
        // PUT: permitir cambiar orientacion/materia en gestor_profesores (campo extra)
        // Si se quiere editar un profe, lo guardamos en una tabla auxiliar mínima
        if ($method === 'PUT' && $id !== null) {
            $b = body();
            // Guardamos orientacion y materia en gestor_profesores_ext si existen
            // Pero por simplicidad, respondemos con el dato de personal actualizado
            // (apellido/nombre no se editan aquí — vienen de personal)
            ok(castRow($db->query("SELECT dni AS id, apellido, nombre, 'bas' AS orientacion, 'Docente' AS materia, dni AS dni_personal FROM personal WHERE dni=" . (int)$id . " LIMIT 1")->fetch()));
        }
        err('Not found', 404);

    // ── RESERVAS ──────────────────────────────────────────────
    case 'reservas':
        if ($method === 'GET') {
            $where='1=1'; $p=[];
            if (isset($_GET['semanaOffset'])) { $where.=' AND semanaOffset=?'; $p[]=(int)$_GET['semanaOffset']; }
            elseif (isset($_GET['desde']) || isset($_GET['hasta'])) {
                list($wd,$wh) = ventanaSemanas();
                $where.=' AND semanaOffset BETWEEN ? AND ?'; $p[]=$wd; $p[]=$wh;
            }
            if (isset($_GET['profeId'])) {
                $where.=' AND profeId=?';
                $p[]=($_GET['profeId'] === 'institucional') ? 'institucional' : $_GET['profeId'];
            }
            if (isset($_GET['orient']) && $_GET['orient'] !== '' && $_GET['orient'] !== 'all') {
                $where.=' AND orient=?'; $p[]=$_GET['orient'];
            }
            if (isset($_GET['lab']) && $_GET['lab'] !== '' && $_GET['lab'] !== 'todos') {
                $where.=' AND lab=?'; $p[]=$_GET['lab'];
            }

            // Modo paginado: el panel de Administración nunca trae la tabla entera.
            if (isset($_GET['limit'])) {
                $limit  = max(1, min(500, (int)$_GET['limit']));
                $offset = max(0, (int)($_GET['offset'] ?? 0));
                $cnt = $db->prepare("SELECT COUNT(*) AS c FROM gestor_reservas WHERE $where");
                $cnt->execute($p);
                $total = (int)$cnt->fetch()['c'];
                $st = $db->prepare("SELECT * FROM gestor_reservas WHERE $where ORDER BY semanaOffset,dia,modulo,lab LIMIT $limit OFFSET $offset");
                $st->execute($p);
                ok(['rows'=>castRows($st->fetchAll()), 'total'=>$total, 'limit'=>$limit, 'offset'=>$offset]);
            }

            $s=$db->prepare("SELECT * FROM gestor_reservas WHERE $where ORDER BY semanaOffset,dia,modulo");
            $s->execute($p); ok(castRows($s->fetchAll()));
        }
        // ── Alta en lote ─────────────────────────────────
        // Una reserva anual son decenas de filas; antes se mandaba un POST por
        // cada una (200+ requests en paralelo). Acá va todo en una transacción.
        if ($method === 'POST' && $id === 'batch') {
            $b = body();
            $items = (isset($b['reservas']) && is_array($b['reservas'])) ? $b['reservas'] : [];
            if (!$items) err('El lote no contiene reservas', 400);
            if (count($items) > 2000) err('El lote supera el máximo de 2000 reservas', 400);

            $hayAnual = false;
            foreach ($items as $it) { if ((int)($it['anual'] ?? 0) === 1) { $hayAnual = true; break; } }
            if ($hayAnual && !esDirectivoReq($db)) err('Sólo un directivo puede crear reservas para todo el año lectivo.', 403);

            $profesValidos = [];
            $slots = [];
            foreach ($items as $it) {
                $dia = (int)($it['dia'] ?? -1); $mod = (int)($it['modulo'] ?? -1);
                if ($mod < 0 || $mod > 15) err('Módulo inválido (0-15)', 400);
                if ($dia < 0 || $dia > 4)  err('Día inválido (0-4)', 400);
                $esInst = (($it['profeId'] ?? '') === 'institucional');
                if (!$esInst) {
                    $pid = (int)($it['profeId'] ?? 0);
                    if (!isset($profesValidos[$pid])) {
                        $chk = $db->prepare('SELECT dni FROM personal WHERE dni=? LIMIT 1');
                        $chk->execute([$pid]);
                        $profesValidos[$pid] = (bool)$chk->fetch();
                    }
                    if (!$profesValidos[$pid]) err('El docente no existe en personal', 400);
                }
                // Cooldown: acumulamos las semanas del propio lote para que
                // 3 semanas seguidas pasen, pero la 4ª no.
                if ((int)($it['anual'] ?? 0) !== 1) {
                    $pidKey = $esInst ? 'institucional' : (string)(int)$it['profeId'];
                    $k = $pidKey . '|' . $it['lab'] . '|' . $dia . '|' . $mod;
                    if (!isset($slots[$k])) $slots[$k] = semanasTomadasSlot($db, $pidKey, $it['lab'], $dia, $mod);
                    validarCooldown($slots[$k], (int)($it['semanaOffset'] ?? 0), $pidKey, 'ese laboratorio, día y módulo');
                }
            }

            $ins = $db->prepare('INSERT INTO gestor_reservas(semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,renovaciones,anual,grupoId,cupofId) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $nuevos = [];
            $db->beginTransaction();
            try {
                foreach ($items as $it) {
                    $ins->execute([
                        (int)($it['semanaOffset'] ?? 0), (int)$it['dia'], (int)$it['modulo'],
                        $it['lab'], $it['curso'], $it['orient'] ?? 'bas',
                        (($it['profeId'] ?? '') === 'institucional') ? 'institucional' : (int)$it['profeId'],
                        $it['secuencia'] ?? '', (int)($it['cicloClases'] ?? 1),
                        (int)($it['renovaciones'] ?? 0), (int)($it['anual'] ?? 0),
                        (isset($it['grupoId']) && $it['grupoId'] !== null) ? (int)$it['grupoId'] : null,
                        (isset($it['cupofId']) && $it['cupofId'] !== null) ? (int)$it['cupofId'] : null,
                    ]);
                    $nuevos[] = (int)$db->lastInsertId();
                }
                $db->commit();
            } catch (Exception $e) { $db->rollBack(); throw $e; }

            $ph = implode(',', array_fill(0, count($nuevos), '?'));
            $sel = $db->prepare("SELECT * FROM gestor_reservas WHERE id IN ($ph) ORDER BY semanaOffset,dia,modulo");
            $sel->execute($nuevos);
            $filas = castRows($sel->fetchAll());
            syncHorariosTrasCambio($db);
            ok($filas);
        }

        if ($method === 'POST') {
            $b=body();
            $grupoId = isset($b['grupoId']) && $b['grupoId'] !== null ? (int)$b['grupoId'] : null;
            $modulo = (int)$b['modulo'];
            $dia = (int)$b['dia'];
            if ($modulo < 0 || $modulo > 15) err('Módulo inválido (0-15)', 400);
            if ($dia < 0 || $dia > 4) err('Día inválido (0-4)', 400);

            // Sólo directivos pueden crear reservas anuales / institucionales
            if ((int)($b['anual'] ?? 0) === 1 && !esDirectivoReq($db)) {
                err('Sólo un directivo puede crear reservas para todo el año lectivo.', 403);
            }

            // Validar profesor en `personal` (si no es 'institucional')
            if (isset($b['profeId']) && $b['profeId'] !== 'institucional') {
                $chk = $db->prepare('SELECT dni FROM personal WHERE dni=? LIMIT 1');
                $chk->execute([(int)$b['profeId']]);
                if (!$chk->fetch()) err('El docente no existe en personal', 400);
            }

            $profeIdVal = ($b['profeId'] === 'institucional') ? 'institucional' : (int)$b['profeId'];
            $cupofId = isset($b['cupofId']) && $b['cupofId'] !== null ? (int)$b['cupofId'] : null;

            // Regla de 3 semanas seguidas + 1 de espera
            if ((int)($b['anual'] ?? 0) !== 1) {
                $tomadas = semanasTomadasSlot($db, (string)$profeIdVal, $b['lab'], $dia, $modulo);
                validarCooldown($tomadas, (int)($b['semanaOffset'] ?? 0), (string)$profeIdVal, 'ese laboratorio, día y módulo');
            }

            $db->prepare('INSERT INTO gestor_reservas(semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,renovaciones,anual,grupoId,cupofId) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
               ->execute([(int)($b['semanaOffset']??0),$dia,$modulo,
                           $b['lab'],$b['curso'],$b['orient']??'bas',$profeIdVal,
                           $b['secuencia']??'',(int)($b['cicloClases']??1),
                           (int)($b['renovaciones']??0),(int)($b['anual']??0),$grupoId,$cupofId]);
            $newId=(int)$db->lastInsertId();
            syncHorariosTrasCambio($db);
            $s=$db->prepare('SELECT * FROM gestor_reservas WHERE id=?'); $s->execute([$newId]); ok(castRow($s->fetch()));
        }

        // ── Edición de una serie completa ──────────────────
        // El cliente sólo tiene en memoria una ventana de semanas, así que no
        // puede armar el lote de una serie anual entera. Acá el UPDATE se
        // resuelve en SQL: alcanza a TODAS las semanas de la serie.
        if ($method === 'PUT' && $id === 'serie') {
            $b     = body();
            $match = isset($b['match']) && is_array($b['match']) ? $b['match'] : [];
            $set   = isset($b['set'])   && is_array($b['set'])   ? $b['set']   : [];
            if (!$match || !$set) err('Faltan los datos de la serie a editar', 400);
            foreach (['lab','dia','profeId','curso'] as $req) {
                if (!array_key_exists($req, $match)) err("Falta '$req' en la serie a editar", 400);
            }

            $where = 'lab=? AND dia=? AND profeId=? AND curso=?';
            $wp = [(string)$match['lab'], (int)$match['dia'], (string)$match['profeId'], (string)$match['curso']];
            if (array_key_exists('anual', $match) && $match['anual'] !== null) {
                $where .= ' AND anual=?'; $wp[] = (int)$match['anual'];
            }
            if (array_key_exists('desdeSemana', $match) && $match['desdeSemana'] !== null) {
                $where .= ' AND semanaOffset>=?'; $wp[] = (int)$match['desdeSemana'];
            }
            if (array_key_exists('modulo', $match) && $match['modulo'] !== null) {
                $where .= ' AND modulo=?'; $wp[] = (int)$match['modulo'];
            }

            // Sólo campos editables; nunca dia/modulo/semanaOffset por esta vía.
            $editables = ['curso','secuencia','orient','profeId','grupoId','lab'];
            $sets = []; $sp = [];
            foreach ($editables as $f) {
                if (!array_key_exists($f, $set)) continue;
                $v = $set[$f];
                if ($f === 'profeId') $v = ($v === 'institucional') ? 'institucional' : (string)(int)$v;
                elseif ($f === 'grupoId') $v = ($v === null || $v === '') ? null : (int)$v;
                else $v = (string)$v;
                $sets[] = "$f=?"; $sp[] = $v;
            }
            if (!$sets) err('No hay campos para actualizar', 400);

            // Al mover de laboratorio, saltear los horarios ya ocupados en destino.
            $extra = '';
            if (array_key_exists('lab', $set) && (string)$set['lab'] !== (string)$match['lab']) {
                $extra = ' AND NOT EXISTS (SELECT 1 FROM (SELECT semanaOffset,dia,modulo FROM gestor_reservas WHERE lab=?) d
                            WHERE d.semanaOffset=gestor_reservas.semanaOffset AND d.dia=gestor_reservas.dia AND d.modulo=gestor_reservas.modulo)';
                $wp[] = (string)$set['lab'];
            }

            $st = $db->prepare("UPDATE gestor_reservas SET " . implode(',', $sets) . " WHERE $where" . $extra);
            $st->execute(array_merge($sp, $wp));
            $actualizadas = $st->rowCount();
            syncHorariosTrasCambio($db);
            ok(['updated' => $actualizadas]);
        }

        // ── Edición en lote ──────────────────────────────
        // Editar una serie anual tocaba hasta 40 filas con 40 PUT en paralelo.
        if ($method === 'PUT' && $id === 'batch') {
            $b = body();
            $items = (isset($b['reservas']) && is_array($b['reservas'])) ? $b['reservas'] : [];
            if (!$items) err('El lote no contiene reservas', 400);
            if (count($items) > 2000) err('El lote supera el máximo de 2000 reservas', 400);

            // cupofId es lo que enlaza la reserva con `horarios`: si el cliente no
            // lo manda se conserva el que ya tenía, en vez de pisarlo con NULL.
            $upd = $db->prepare('UPDATE gestor_reservas SET semanaOffset=?,dia=?,modulo=?,lab=?,curso=?,orient=?,profeId=?,secuencia=?,cicloClases=?,renovaciones=?,anual=?,grupoId=?,cupofId=IF(?=1,?,cupofId) WHERE id=?');
            $ids = [];
            $db->beginTransaction();
            try {
                foreach ($items as $it) {
                    $rid = (int)($it['id'] ?? 0);
                    if (!$rid) err('Falta el id de una reserva del lote', 400);
                    $upd->execute([
                        (int)($it['semanaOffset'] ?? 0), (int)$it['dia'], (int)$it['modulo'],
                        $it['lab'], $it['curso'], $it['orient'] ?? 'bas',
                        (($it['profeId'] ?? '') === 'institucional') ? 'institucional' : (int)$it['profeId'],
                        $it['secuencia'] ?? '', (int)($it['cicloClases'] ?? 1),
                        (int)($it['renovaciones'] ?? 0), (int)($it['anual'] ?? 0),
                        (isset($it['grupoId']) && $it['grupoId'] !== null) ? (int)$it['grupoId'] : null,
                        array_key_exists('cupofId', $it) ? 1 : 0,
                        (isset($it['cupofId']) && $it['cupofId'] !== null) ? (int)$it['cupofId'] : null,
                        $rid,
                    ]);
                    $ids[] = $rid;
                }
                $db->commit();
            } catch (Exception $e) { $db->rollBack(); throw $e; }

            $ph = implode(',', array_fill(0, count($ids), '?'));
            $sel = $db->prepare("SELECT * FROM gestor_reservas WHERE id IN ($ph) ORDER BY semanaOffset,dia,modulo");
            $sel->execute($ids);
            $filas = castRows($sel->fetchAll());
            syncHorariosTrasCambio($db);
            ok($filas);
        }

        if ($method === 'PUT' && $id !== null) {
            $b=body();
            $grupoId = isset($b['grupoId']) && $b['grupoId'] !== null ? (int)$b['grupoId'] : null;
            $profeIdVal = ($b['profeId'] === 'institucional') ? 'institucional' : (int)$b['profeId'];
            $cupofId = isset($b['cupofId']) && $b['cupofId'] !== null ? (int)$b['cupofId'] : null;
            // Sin cupofId en el cuerpo se conserva el actual (ver PUT batch)
            $db->prepare('UPDATE gestor_reservas SET semanaOffset=?,dia=?,modulo=?,lab=?,curso=?,orient=?,profeId=?,secuencia=?,cicloClases=?,renovaciones=?,anual=?,grupoId=?,cupofId=IF(?=1,?,cupofId) WHERE id=?')
               ->execute([(int)($b['semanaOffset']??0),(int)$b['dia'],(int)$b['modulo'],
                           $b['lab'],$b['curso'],$b['orient']??'bas',$profeIdVal,
                           $b['secuencia']??'',(int)($b['cicloClases']??1),
                           (int)($b['renovaciones']??0),(int)($b['anual']??0),$grupoId,
                           array_key_exists('cupofId', $b) ? 1 : 0,$cupofId,(int)$id]);
            syncHorariosTrasCambio($db);
            $s=$db->prepare('SELECT * FROM gestor_reservas WHERE id=?'); $s->execute([(int)$id]); ok(castRow($s->fetch()));
        }
        if ($method === 'DELETE' && $id !== null) {
            if ($action === 'serie') {
                $b=body();
                // profeId es VARCHAR: las series anuales guardan 'institucional'.
                // Castearlo a int lo convertiía en 0 y el DELETE no borraba nada.
                $stSerie = $db->prepare('DELETE FROM gestor_reservas WHERE lab=? AND dia=? AND profeId=? AND curso=? AND anual=1');
                $stSerie->execute([$b['lab'],(int)$b['dia'],(string)$b['profeId'],$b['curso']]);
                $borradas = $stSerie->rowCount();
                syncHorariosTrasCambio($db);
                ok(['deleted_series'=>true, 'deleted'=>$borradas]);
            }
            $db->prepare('DELETE FROM gestor_reservas WHERE id=?')->execute([(int)$id]);
            syncHorariosTrasCambio($db);
            ok(['deleted'=>(int)$id]);
        }
        err('Not found',404);

    // ── SOLICITUDES ───────────────────────────────────────────
    case 'solicitudes':
        if ($method === 'GET') {
            $where='1=1'; $p=[];
            if (isset($_GET['estado']))  { $where.=' AND estado=?';  $p[]=$_GET['estado']; }
            if (isset($_GET['profeId'])) {
                $where.=' AND profeId=?';
                $p[]=($_GET['profeId'] === 'institucional') ? 'institucional' : $_GET['profeId'];
            }
            $s=$db->prepare("SELECT * FROM gestor_solicitudes WHERE $where ORDER BY id");
            $s->execute($p); ok(castRows($s->fetchAll()));
        }
        if ($method === 'POST') {
            $b=body();
            $grupoId = isset($b['grupoId']) && $b['grupoId'] !== null ? (int)$b['grupoId'] : null;
            $profeIdVal = ($b['profeId'] === 'institucional') ? 'institucional' : (int)$b['profeId'];

            // Regla de 3 semanas seguidas + 1 de espera.
            // Las renovaciones quedan exentas: son justamente la excepción
            // que el directivo aprueba a mano.
            if ((int)($b['esRenovacion'] ?? 0) !== 1) {
                $tomadasSol = semanasTomadasSlot($db, (string)$profeIdVal, $b['lab'], (int)$b['dia'], (int)$b['modulo']);
                validarCooldown($tomadasSol, (int)($b['semanaOffset'] ?? 0), (string)$profeIdVal, 'ese laboratorio, día y módulo');
            }

            $db->prepare('INSERT INTO gestor_solicitudes(semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,estado,esRenovacion,reservaOriginalId,renovacionNum,grupoId,cupofId) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
               ->execute([(int)($b['semanaOffset']??0),(int)$b['dia'],(int)$b['modulo'],
                           $b['lab'],$b['curso'],$b['orient']??'bas',$profeIdVal,
                           $b['secuencia']??'',(int)($b['cicloClases']??1),
                           $b['estado']??'pendiente',(int)($b['esRenovacion']??0),
                           isset($b['reservaOriginalId'])?(int)$b['reservaOriginalId']:null,
                           (int)($b['renovacionNum']??0),$grupoId,
                           isset($b['cupofId']) && $b['cupofId'] !== null ? (int)$b['cupofId'] : null]);
            $newId=(int)$db->lastInsertId();
            $s=$db->prepare('SELECT * FROM gestor_solicitudes WHERE id=?'); $s->execute([$newId]); ok(castRow($s->fetch()));
        }
        if ($method === 'PUT' && $id !== null) {
            $b=body(); $fields=[]; $vals=[];
            foreach(['semanaOffset','dia','modulo','lab','curso','orient','profeId',
                     'secuencia','cicloClases','estado','esRenovacion','reservaOriginalId','renovacionNum'] as $f) {
                if (array_key_exists($f,$b)) { $fields[]="$f=?"; $vals[]=$b[$f]; }
            }
            if ($fields) { $vals[]=(int)$id; $db->prepare('UPDATE gestor_solicitudes SET '.implode(',',$fields).' WHERE id=?')->execute($vals); }
            $s=$db->prepare('SELECT * FROM gestor_solicitudes WHERE id=?'); $s->execute([(int)$id]); ok(castRow($s->fetch()));
        }
        if ($method === 'DELETE' && $id !== null) {
            $db->prepare('DELETE FROM gestor_solicitudes WHERE id=?')->execute([(int)$id]); ok(['deleted'=>(int)$id]);
        }
        err('Not found',404);

    // ── ESPERA ────────────────────────────────────────────────
    case 'espera':
        if ($method === 'GET') ok(castRows($db->query('SELECT * FROM gestor_espera ORDER BY id')->fetchAll()));
        if ($method === 'POST') {
            $b=body();
            $db->prepare('INSERT INTO gestor_espera(profeId,lab,dia,modulo,semanaOffset) VALUES(?,?,?,?,?)')
               ->execute([$b['profeId'],$b['lab'],(int)$b['dia'],(int)$b['modulo'],(int)($b['semanaOffset']??0)]);
            $newId=(int)$db->lastInsertId();
            ok(['id'=>$newId,'profeId'=>$b['profeId'],'lab'=>$b['lab'],
                'dia'=>(int)$b['dia'],'modulo'=>(int)$b['modulo'],'semanaOffset'=>(int)($b['semanaOffset']??0)]);
        }
        if ($method === 'DELETE' && $id !== null) {
            $db->prepare('DELETE FROM gestor_espera WHERE id=?')->execute([(int)$id]); ok(['deleted'=>(int)$id]);
        }
        err('Not found',404);

    // ── PAUTAS ────────────────────────────────────────────────
    case 'pautas':
        if ($method === 'GET') {
            $rows=$db->query('SELECT * FROM gestor_pautas ORDER BY id')->fetchAll();
            ok(array_map(fn($r)=>['id'=>(int)$r['id'],'texto'=>$r['texto']],$rows));
        }
        if ($method === 'POST') {
            $b=body();
            $db->prepare('INSERT INTO gestor_pautas(texto) VALUES(?)')->execute([$b['texto']]);
            ok(['id'=>(int)$db->lastInsertId(),'texto'=>$b['texto']]);
        }
        if ($method === 'DELETE' && $id !== null) {
            $db->prepare('DELETE FROM gestor_pautas WHERE id=?')->execute([(int)$id]); ok(['deleted'=>(int)$id]);
        }
        err('Not found',404);

    // ── CURSOS ────────────────────────────────────────────────
    case 'grupos':
        if ($method !== 'GET') err('Method not allowed', 405);
        $hasGrupos = $db->query("SHOW TABLES LIKE 'grupos'")->fetch();
        if (!$hasGrupos) ok([]);
        ok(castRows($db->query('SELECT id, nombre, id_cursos FROM grupos ORDER BY id_cursos, nombre')->fetchAll()));

    case 'cursos':
        if ($method !== 'GET') err('Method not allowed', 405);
        $hasCs = $db->query("SHOW TABLES LIKE 'ciclosuperior'")->fetch();
        $hasO = $db->query("SHOW TABLES LIKE 'orientaciones'")->fetch();
        if ($hasCs && $hasO) {
            ok(castRows($db->query("SELECT c.id, c.division, c.ano, c.turno,
                                   COALESCE(o.nombre, 'bas') AS orientacion
                            FROM cursos c
                            LEFT JOIN ciclosuperior cs ON c.id = cs.id_cursos
                            LEFT JOIN orientaciones o ON cs.id_orientaciones = o.id
                            ORDER BY c.ano, c.division")->fetchAll()));
        }
        ok(castRows($db->query('SELECT id, division, ano, turno, "bas" AS orientacion FROM cursos ORDER BY ano, division')->fetchAll()));

    // ── MATERIAS ──────────────────────────────────────────────
    case 'materias':
        if ($method !== 'GET') err('Method not allowed', 405);
        ok(castRows($db->query('SELECT id, nombre, abreviatura FROM materias ORDER BY nombre')->fetchAll()));

    // ── HORARIOS ACADÉMICOS ───────────────────────────────────
    case 'horarios-academicos':
        if ($method !== 'GET') err('Method not allowed', 405);
        $dni_personal = isset($_GET['dni']) ? (int)$_GET['dni'] : null;
        if (!$dni_personal) ok([]);
        $s = $db->prepare("
            SELECT DISTINCT
                h.dia, h.id_horas, c.cupof,
                c.id_cursos, c.id_materias,
                m.nombre  AS materia_nombre,
                m.abreviatura AS materia_abrev,
                cu.ano         AS curso_ano,
                cu.division    AS curso_division,
                c.turno        AS cupof_turno
            FROM revista r
            JOIN cupof    c  ON r.cupof       = c.cupof
            JOIN horarios h  ON h.cupof        = c.cupof
            LEFT JOIN materias m  ON c.id_materias = m.id
            LEFT JOIN cursos   cu ON c.id_cursos   = cu.id
            WHERE r.dni_personal = ?
              AND (r.fh IS NULL OR YEAR(r.fh) = 0 OR r.fh >= CURDATE())
            ORDER BY h.dia, h.id_horas
        ");
        $s->execute([$dni_personal]);
        ok(castRows($s->fetchAll()));

    // ── CUPOFS POR PROFE ──────────────────────────────────────
    case 'cupofs-por-profe':
        if ($method !== 'GET') err('Method not allowed', 405);
        $dni_personal = isset($_GET['dni']) ? (int)$_GET['dni'] : null;
        if (!$dni_personal) ok([]);

        $s = $db->prepare("
            SELECT DISTINCT
                c.cupof, c.id_materias, c.id_cursos,
                c.turno AS cupof_turno, c.hsmodcar, c.id_grupos,
                m.nombre      AS materia_nombre,
                m.abreviatura AS materia_abrev,
                cu.ano        AS curso_ano,
                cu.division   AS curso_division,
                COALESCE(o.nombre, 'bas') AS orientacion,
                CONCAT(cu.ano, '°', cu.division,
                    IF(cu.turno IS NOT NULL AND cu.turno <> '',
                        CONCAT(' (', cu.turno, ')'), '')
                ) AS curso_label,
                g.nombre AS grupo_nombre
            FROM revista r
            JOIN cupof    c  ON r.cupof = c.cupof
            LEFT JOIN materias m  ON c.id_materias = m.id
            LEFT JOIN cursos   cu ON c.id_cursos   = cu.id
            LEFT JOIN ciclosuperior cs ON cu.id = cs.id_cursos
            LEFT JOIN orientaciones o ON cs.id_orientaciones = o.id
            LEFT JOIN grupos   g  ON c.id_grupos   = g.id AND c.id_grupos > 0
            WHERE r.dni_personal = ?
              AND (r.fh IS NULL OR YEAR(r.fh) = 0 OR r.fh >= CURDATE())
            ORDER BY cu.ano, cu.division, m.nombre
        ");
        $s->execute([$dni_personal]);
        $rows = $s->fetchAll();
        // Fallback sin filtro de fecha
        if (empty($rows)) {
            $s2 = $db->prepare("
                SELECT DISTINCT
                    c.cupof, c.id_materias, c.id_cursos,
                    c.turno AS cupof_turno, c.hsmodcar, c.id_grupos,
                    m.nombre      AS materia_nombre,
                    m.abreviatura AS materia_abrev,
                    cu.ano        AS curso_ano,
                    cu.division   AS curso_division,
                    COALESCE(o.nombre, 'bas') AS orientacion,
                    CONCAT(cu.ano, '°', cu.division,
                        IF(cu.turno IS NOT NULL AND cu.turno <> '',
                            CONCAT(' (', cu.turno, ')'), '')
                    ) AS curso_label,
                    g.nombre AS grupo_nombre
                FROM revista r
                JOIN cupof    c  ON r.cupof = c.cupof
                LEFT JOIN materias m  ON c.id_materias = m.id
                LEFT JOIN cursos   cu ON c.id_cursos   = cu.id
                LEFT JOIN ciclosuperior cs ON cu.id = cs.id_cursos
                LEFT JOIN orientaciones o ON cs.id_orientaciones = o.id
                LEFT JOIN grupos   g  ON c.id_grupos   = g.id AND c.id_grupos > 0
                WHERE r.dni_personal = ?
                ORDER BY cu.ano, cu.division, m.nombre
            ");
            $s2->execute([$dni_personal]);
            $rows = $s2->fetchAll();
        }
        ok(castRows($rows));

    // ── DEBUG ─────────────────────────────────────────────────
    case 'debug-revista':
        if ($method !== 'GET') err('Method not allowed', 405);
        $dni = isset($_GET['dni']) ? (int)$_GET['dni'] : null;
        if (!$dni) err('Falta ?dni=', 400);
        $r1 = castRows($db->query("SELECT id, cupof, fd, YEAR(fh) AS fh_year, dni_personal FROM revista WHERE dni_personal=$dni LIMIT 20")->fetchAll());
        $r2 = castRows($db->query("SELECT cupof, id_materias, id_cursos, turno, funcion FROM cupof WHERE cupof IN (SELECT cupof FROM revista WHERE dni_personal=$dni) LIMIT 20")->fetchAll());
        ok(['revista' => $r1, 'cupofs' => $r2, 'dni_buscado' => $dni]);

    // ── ALL (carga inicial batch) ─────────────────────────────
    case 'all':
        if ($method !== 'GET') err('Method not allowed', 405);
        list($winDesde, $winHasta) = ventanaSemanas();

        // Profesores desde `personal`
        $profs = castRows($db->query(sqlProfesores())->fetchAll());

        // Labs: salones + gestor_labs (ocupado/max_grupos)
        $sql_labs = "
            SELECT
                CAST(s.id_salones AS CHAR) AS id,
                CONCAT(s.tipo, ' ', s.numero) AS nombre,
                COALESCE(gl.ocupado, 0) AS ocupado,
                s.capacidad,
                CONCAT('Ubicación: ', s.ubicacion) AS notas,
                s.numero,
                s.piso,
                s.tipo,
                COALESCE(gl.max_grupos, 2) AS max_grupos
            FROM salones s
            LEFT JOIN gestor_labs gl ON gl.id = CAST(s.id_salones AS CHAR)
            ORDER BY s.numero, s.tipo
        ";

        $res = [
            'labs'        => castRows($db->query($sql_labs)->fetchAll()),
            'profesores'  => $profs,
            'reservas'    => castRows(qWin($db,
                'SELECT * FROM gestor_reservas WHERE semanaOffset BETWEEN ? AND ? ORDER BY semanaOffset,dia,modulo',
                $winDesde, $winHasta)),
            'ventana'     => ['desde' => $winDesde, 'hasta' => $winHasta],
            'solicitudes' => castRows($db->query('SELECT * FROM gestor_solicitudes ORDER BY id')->fetchAll()),
            'espera'      => castRows($db->query('SELECT * FROM gestor_espera ORDER BY id')->fetchAll()),
            'pautas'      => castRows($db->query('SELECT * FROM gestor_pautas ORDER BY id')->fetchAll()),
        ];

        // Tablas maestras opcionales
        if ($db->query("SHOW TABLES LIKE 'cursos'")->fetch()) {
            $hasCs = $db->query("SHOW TABLES LIKE 'ciclosuperior'")->fetch();
            $hasO = $db->query("SHOW TABLES LIKE 'orientaciones'")->fetch();
            if ($hasCs && $hasO) {
                $res['cursos'] = castRows($db->query("
                    SELECT c.id, c.division, c.ano, c.turno, 
                           COALESCE(o.nombre, 'bas') AS orientacion
                    FROM cursos c
                    LEFT JOIN ciclosuperior cs ON c.id = cs.id_cursos
                    LEFT JOIN orientaciones o ON cs.id_orientaciones = o.id
                    ORDER BY c.ano, c.division
                ")->fetchAll());
            } else {
                $res['cursos'] = castRows($db->query('SELECT id, division, ano, turno, "bas" AS orientacion FROM cursos ORDER BY ano, division')->fetchAll());
            }
        }
        if ($db->query("SHOW TABLES LIKE 'materias'")->fetch())
            $res['materias'] = castRows($db->query('SELECT id, nombre, abreviatura FROM materias ORDER BY nombre')->fetchAll());
        if ($db->query("SHOW TABLES LIKE 'grupos'")->fetch())
            $res['grupos'] = castRows($db->query('SELECT id, nombre, id_cursos FROM grupos ORDER BY id_cursos, nombre')->fetchAll());

        // El gestor ya no lee la tabla `horarios` para mostrar la grilla: la
        // fuente de verdad son las reservas del gestor, y `horarios` se
        // escribe desde ellas en la sincronizaci\u00f3n semanal (sync-horarios).
        // Mostrar ambas duplicaba cada clase en el calendario.

        ok($res);

    // ── NOTIFICACIONES ────────────────────────────────────────
    case 'notificaciones':
        initSchema($db);
        if ($method === 'GET') {
            // Opcional: ?profeId=X filtra por docente; sin parámetro devuelve todas (admin)
            $where = '1=1'; $p = [];
            if (isset($_GET['profeId'])) {
                if ($_GET['profeId'] === 'admin') {
                    $where .= ' AND profeId IS NULL'; // solo notificaciones de admin
                } else {
                    $where .= ' AND (profeId=? OR profeId IS NULL)';
                    $p[] = $_GET['profeId'];
                }
            }
            $s = $db->prepare("SELECT * FROM gestor_notificaciones WHERE $where ORDER BY id DESC LIMIT 100");
            $s->execute($p);
            ok(castRows($s->fetchAll()));
        }
        if ($method === 'POST') {
            $b = body();
            $db->prepare('INSERT INTO gestor_notificaciones(tipo,titulo,cuerpo,profeId,labId,reservaId) VALUES(?,?,?,?,?,?)')
               ->execute([
                   $b['tipo']    ?? 'info',
                   $b['titulo']  ?? '',
                   $b['cuerpo']  ?? '',
                   isset($b['profeId'])   && $b['profeId']   !== null ? $b['profeId']           : null,
                   isset($b['labId'])     && $b['labId']     !== null ? $b['labId']              : null,
                   isset($b['reservaId']) && $b['reservaId'] !== null ? (int)$b['reservaId']     : null,
               ]);
            $newId = (int)$db->lastInsertId();
            $s = $db->prepare('SELECT * FROM gestor_notificaciones WHERE id=?'); $s->execute([$newId]);
            ok(castRow($s->fetch()));
        }
        if ($method === 'PUT' && $id !== null) {
            // Marcar como leída
            $db->prepare('UPDATE gestor_notificaciones SET leida=1 WHERE id=?')->execute([(int)$id]);
            ok(['updated' => (int)$id]);
        }
        if ($method === 'DELETE') {
            if ($id) {
                $db->prepare('DELETE FROM gestor_notificaciones WHERE id=?')->execute([(int)$id]);
                ok(['deleted' => (int)$id]);
            }
            // DELETE sin id: borrar todas las del usuario (via body)
            $b = body();
            if (isset($b['profeId'])) {
                if ($b['profeId'] === 'admin') {
                    $db->exec('DELETE FROM gestor_notificaciones WHERE profeId IS NULL');
                } else {
                    $db->prepare('DELETE FROM gestor_notificaciones WHERE profeId=?')->execute([$b['profeId']]);
                }
                ok(['deleted_all' => true]);
            }
            err('Especificá id o profeId para eliminar', 400);
        }
        err('Not found', 404);

    // ── SINCRONIZACIÓN gestor -> `horarios` ──────────────────
    // `horarios` es una única grilla semanal (dia, id_horas, id_salones, cupof):
    // no tiene columna de semana. Refleja lo que el gestor tiene reservado para
    // la semana en curso, aplicando sólo las diferencias. Se aplica sola tras
    // cada cambio en gestor_reservas (syncHorariosTrasCambio) y, además, una vez
    // al empezar cada semana, cuando la semana en curso pasa a ser otra. La identidad de una clase es (dia, id_horas, cupof); lo que
    // cambia entre el horario oficial y el gestor es el salón.
    case 'sync-horarios':
        initSchema($db);

        $off   = isset($_GET['semanaOffset']) ? (int)$_GET['semanaOffset'] : 0;
        $lunes = lunesDeSemana($off);
        $sem   = $lunes->format('o-\WW');       // p.ej. 2026-W37

        $ultimaQ = $db->prepare('SELECT * FROM gestor_sync_horarios WHERE semana=? LIMIT 1');
        $ultimaQ->execute([$sem]);
        $yaCorrio = $ultimaQ->fetch();

        // Estado: lo consulta la app al abrir para saber si toca sincronizar.
        if ($method === 'GET') {
            $hist = $db->query('SELECT * FROM gestor_sync_horarios ORDER BY id DESC LIMIT 8')->fetchAll();
            ok([
                'semana'    => $sem,
                'lunes'     => $lunes->format('Y-m-d'),
                'yaCorrio'  => (bool)$yaCorrio,
                'ultima'    => $yaCorrio ? castRow($yaCorrio) : null,
                'historial' => castRows($hist),
            ]);
        }

        if ($method !== 'POST') err('Method not allowed', 405);

        $b      = body();
        $dryRun = !empty($b['dryRun']);
        $forzar = !empty($b['forzar']);
        $origen = ($b['origen'] ?? 'auto') === 'manual' ? 'manual' : 'auto';

        // La corrida automática es determinista y sólo puede ocurrir una vez por
        // semana, así que no exige credenciales (permite agendarla por cron).
        // Previsualizar o forzar sí son acciones de directivo.
        if (($dryRun || $forzar || $origen === 'manual') && !esDirectivoReq($db)) {
            err('Sólo un directivo puede sincronizar `horarios` a mano.', 403);
        }

        if ($yaCorrio && !$forzar && !$dryRun) {
            ok(['semana'=>$sem, 'yaCorrio'=>true, 'aplicado'=>false, 'ultima'=>castRow($yaCorrio)]);
        }

        $plan = planSyncHorarios($db, $off);
        $resumen = [
            'semana'       => $sem,
            'lunes'        => $lunes->format('Y-m-d'),
            'semanaOffset' => $off,
            'insertados'   => count($plan['insertar']),
            'actualizados' => count($plan['actualizar']),
            'eliminados'   => count($plan['eliminar']),
            'omitidos'     => $plan['omitidos'],
            'en_gestor'    => $plan['en_gestor'],
            'en_horarios'  => $plan['en_horarios'],
        ];

        if ($dryRun) {
            // Muestra acotada para que el directivo vea qué va a pasar
            $resumen['aplicado'] = false;
            $resumen['muestra'] = [
                'insertar'   => array_slice($plan['insertar'], 0, 10),
                'actualizar' => array_slice($plan['actualizar'], 0, 10),
            ];
            ok($resumen);
        }

        aplicarPlanHorarios($db, $plan, $lunes, $origen);

        $resumen['aplicado'] = true;
        $resumen['origen']   = $origen;
        ok($resumen);

    // ── STATS (contadores del panel de Administración) ──────
    // Evita que el cliente tenga que cargar todas las reservas sólo para contar.
    case 'stats':
        initSchema($db);
        if ($method !== 'GET') err('Method not allowed', 405);
        $r1 = $db->query('SELECT COUNT(*) AS total, COUNT(DISTINCT profeId) AS docentes FROM gestor_reservas')->fetch();
        $r2 = $db->query("SELECT COUNT(*) AS pendientes FROM gestor_solicitudes WHERE estado='pendiente'")->fetch();
        $r3 = $db->query('SELECT COUNT(*) AS labs FROM salones')->fetch();
        // Reservas por docente, para la columna "Reservas" de la tabla de docentes
        $porProfe = [];
        foreach ($db->query('SELECT profeId, COUNT(*) AS c FROM gestor_reservas GROUP BY profeId')->fetchAll() as $row) {
            $porProfe[(string)$row['profeId']] = (int)$row['c'];
        }
        ok([
            'reservas'    => (int)$r1['total'],
            'docentes'    => (int)$r1['docentes'],
            'pendientes'  => (int)$r2['pendientes'],
            'labs'        => (int)$r3['labs'],
            'porProfe'    => $porProfe,
        ]);

    // ── CALENDAR POLL (actualización en tiempo real) ─────────
    case 'calendar-poll':
        if ($method !== 'GET') err('Method not allowed', 405);

        list($winDesde, $winHasta) = ventanaSemanas();

        // Hash barato: agregados sobre la ventana, sin traer ni serializar filas.
        // Antes esto hacía fetchAll() + castRows() + dos json_encode() de toda la
        // tabla en CADA poll de CADA cliente, aunque no hubiera cambiado nada.
        $agg = $db->prepare("
            SELECT COUNT(*) AS c, COALESCE(MAX(id),0) AS mx, COALESCE(SUM(id),0) AS sm
            FROM gestor_reservas WHERE semanaOffset BETWEEN ? AND ?
        ");
        $agg->execute([$winDesde, $winHasta]);
        $aR = $agg->fetch();
        $aS = $db->query('SELECT COUNT(*) AS c, COALESCE(MAX(id),0) AS mx, COALESCE(SUM(id),0) AS sm FROM gestor_solicitudes')->fetch();
        $aE = $db->query('SELECT COUNT(*) AS c, COALESCE(MAX(id),0) AS mx, COALESCE(SUM(id),0) AS sm FROM gestor_espera')->fetch();
        $aL = $db->query('SELECT COUNT(*) AS c, COALESCE(SUM(ocupado),0) AS sm, COALESCE(SUM(max_grupos),0) AS mg FROM gestor_labs')->fetch();

        // `estado` y `curso` no se reflejan en los agregados de id, así que
        // sumamos un checksum de las columnas mutables de solicitudes y reservas.
        // dia/modulo entran porque el drag & drop sólo cambia esas columnas: sin
        // ellas las otras pestañas no veían la reserva movida.
        $chk = $db->prepare("
            SELECT COALESCE(SUM(CRC32(CONCAT_WS('|',id,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,renovaciones,anual,grupoId,cupofId))),0) AS ck
            FROM gestor_reservas WHERE semanaOffset BETWEEN ? AND ?
        ");
        $chk->execute([$winDesde, $winHasta]);
        $ckR = $chk->fetch();
        $ckS = $db->query("SELECT COALESCE(SUM(CRC32(CONCAT_WS('|',id,estado,lab,curso,profeId))),0) AS ck FROM gestor_solicitudes")->fetch();

        $hash = md5(json_encode([
            $winDesde, $winHasta,
            $aR['c'], $aR['mx'], $aR['sm'], $ckR['ck'],
            $aS['c'], $aS['mx'], $aS['sm'], $ckS['ck'],
            $aE['c'], $aE['mx'], $aE['sm'],
            $aL['c'], $aL['sm'], $aL['mg'],
        ]));

        // Si el cliente ya tiene ese hash, cortamos acá: ni una fila leída.
        $clientHash = $_GET['hash'] ?? '';
        if ($clientHash === $hash) {
            ok(['changed' => false, 'hash' => $hash]);
        }

        // Sólo ahora traemos los datos
        $reservas    = qWin($db, 'SELECT * FROM gestor_reservas WHERE semanaOffset BETWEEN ? AND ? ORDER BY semanaOffset,dia,modulo', $winDesde, $winHasta);
        $solicitudes = $db->query('SELECT * FROM gestor_solicitudes ORDER BY id')->fetchAll();
        $espera      = $db->query('SELECT * FROM gestor_espera ORDER BY id')->fetchAll();

        // Labs: salones + gestor_labs (ocupado/max_grupos)
        $labs = $db->query("
            SELECT
                CAST(s.id_salones AS CHAR) AS id,
                CONCAT(s.tipo, ' ', s.numero) AS nombre,
                COALESCE(gl.ocupado, 0) AS ocupado,
                s.capacidad,
                CONCAT('Ubicación: ', s.ubicacion) AS notas,
                s.numero,
                s.piso,
                s.tipo,
                COALESCE(gl.max_grupos, 2) AS max_grupos
            FROM salones s
            LEFT JOIN gestor_labs gl ON gl.id = CAST(s.id_salones AS CHAR)
            ORDER BY s.numero, s.tipo
        ")->fetchAll();

        $payload = [
            'reservas'    => castRows($reservas),
            'solicitudes' => castRows($solicitudes),
            'espera'      => castRows($espera),
            'labs'        => castRows($labs),
            'ventana'     => ['desde' => $winDesde, 'hasta' => $winHasta],
            'changed'     => true,
            'hash'        => $hash,
        ];
        ok($payload);

    default:
        err('Endpoint not found',404);
}