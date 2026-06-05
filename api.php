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
// Autenticación: tabla `personal` + campo `tag` para admins
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
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4",
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
            INDEX idx_profe (profeId)
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
    ");

    // Migración: asegurar que profeId sea VARCHAR en tablas ya existentes
    foreach (['gestor_reservas', 'gestor_solicitudes', 'gestor_espera'] as $t) {
        $col = $pdo->query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='$t' AND COLUMN_NAME='profeId' AND TABLE_SCHEMA=DATABASE()")->fetch();
        if ($col && stripos($col['COLUMN_TYPE'], 'INT') !== false) {
            $pdo->exec("ALTER TABLE $t MODIFY COLUMN profeId VARCHAR(50) NOT NULL");
        }
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

// ── Router ───────────────────────────────────────────────────
$method   = $_SERVER['REQUEST_METHOD'];
$path     = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$path     = preg_replace('#^.*?api\.php/?#', '', $path);
$segments = array_values(array_filter(explode('/', $path)));
$resource = $segments[0] ?? '';
$id       = $segments[1] ?? null;
$action   = $segments[2] ?? null;

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

        // Administrador estático
        if ($username === 'admin' && $password === 'admin123') {
            ok(['id'=>0,'display'=>'Administrador','role'=>'admin','profeId'=>null,'tag'=>'admin']);
        }

        $row = null;

        // Por DNI numérico
        if (is_numeric($username)) {
            $s = $db->prepare("SELECT * FROM personal WHERE dni=? LIMIT 1");
            $s->execute([(int)$username]);
            $row = $s->fetch() ?: null;
        }

        // Por tag (número SAEP)
        if (!$row) {
            $s = $db->prepare("SELECT * FROM personal WHERE tag=? AND tag<>'' LIMIT 1");
            $s->execute([$username]);
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
        $computedRole = (isset($row['tag']) && !empty(trim($row['tag']))) ? 'admin' : 'prof';

        // profeId = dni del personal (el mismo id que usamos en PROFESORES)
        ok([
            'id'      => (int)$row['dni'],
            'display' => ($computedRole === 'admin' ? '' : 'Prof. ') . $display,
            'role'    => $computedRole,
            'profeId' => (int)$row['dni'],   // dni directo, sin gestor_profesores
            'tag'     => $row['tag'] ?? '',
        ]);

    // ── PERSONAL (búsqueda de docentes) ──────────────────────
    case 'personal':
        if ($method !== 'GET') err('Method not allowed', 405);
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) ok([]);
        $s = $db->prepare(
            "SELECT dni,apellido,nombre,email,tag FROM personal
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
                    COALESCE(gl.max_grupos, 2) AS max_grupos
                FROM salones s
                LEFT JOIN gestor_labs gl ON gl.id = CAST(s.id_salones AS CHAR)
                ORDER BY s.tipo, s.numero
            ")->fetchAll();
            ok(castRows($rows));
        }
        // PUT: solo actualizar ocupado/max_grupos en gestor_labs
        if ($method === 'PUT' && $id) {
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
        if ($method === 'PUT' && $id) {
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
            if (isset($_GET['profeId'])) {
                $where.=' AND profeId=?';
                $p[]=($_GET['profeId'] === 'institucional') ? 'institucional' : $_GET['profeId'];
            }
            $s=$db->prepare("SELECT * FROM gestor_reservas WHERE $where ORDER BY semanaOffset,dia,modulo");
            $s->execute($p); ok(castRows($s->fetchAll()));
        }
        if ($method === 'POST') {
            $b=body();
            $grupoId = isset($b['grupoId']) && $b['grupoId'] !== null ? (int)$b['grupoId'] : null;
            $modulo = (int)$b['modulo'];
            $dia = (int)$b['dia'];
            if ($modulo < 0 || $modulo > 15) err('Módulo inválido (0-15)', 400);
            if ($dia < 0 || $dia > 4) err('Día inválido (0-4)', 400);

            // Validar profesor en `personal` (si no es 'institucional')
            if (isset($b['profeId']) && $b['profeId'] !== 'institucional') {
                $chk = $db->prepare('SELECT dni FROM personal WHERE dni=? LIMIT 1');
                $chk->execute([(int)$b['profeId']]);
                if (!$chk->fetch()) err('El docente no existe en personal', 400);
            }

            $profeIdVal = ($b['profeId'] === 'institucional') ? 'institucional' : (int)$b['profeId'];
            $cupofId = isset($b['cupofId']) && $b['cupofId'] !== null ? (int)$b['cupofId'] : null;

            $db->prepare('INSERT INTO gestor_reservas(semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,renovaciones,anual,grupoId,cupofId) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
               ->execute([(int)($b['semanaOffset']??0),$dia,$modulo,
                           $b['lab'],$b['curso'],$b['orient']??'bas',$profeIdVal,
                           $b['secuencia']??'',(int)($b['cicloClases']??1),
                           (int)($b['renovaciones']??0),(int)($b['anual']??0),$grupoId,$cupofId]);
            $newId=(int)$db->lastInsertId();
            $s=$db->prepare('SELECT * FROM gestor_reservas WHERE id=?'); $s->execute([$newId]); ok(castRow($s->fetch()));
        }
        if ($method === 'PUT' && $id) {
            $b=body();
            $grupoId = isset($b['grupoId']) && $b['grupoId'] !== null ? (int)$b['grupoId'] : null;
            $profeIdVal = ($b['profeId'] === 'institucional') ? 'institucional' : (int)$b['profeId'];
            $cupofId = isset($b['cupofId']) && $b['cupofId'] !== null ? (int)$b['cupofId'] : null;
            $db->prepare('UPDATE gestor_reservas SET semanaOffset=?,dia=?,modulo=?,lab=?,curso=?,orient=?,profeId=?,secuencia=?,cicloClases=?,renovaciones=?,anual=?,grupoId=?,cupofId=? WHERE id=?')
               ->execute([(int)($b['semanaOffset']??0),(int)$b['dia'],(int)$b['modulo'],
                           $b['lab'],$b['curso'],$b['orient']??'bas',$profeIdVal,
                           $b['secuencia']??'',(int)($b['cicloClases']??1),
                           (int)($b['renovaciones']??0),(int)($b['anual']??0),$grupoId,$cupofId,(int)$id]);
            $s=$db->prepare('SELECT * FROM gestor_reservas WHERE id=?'); $s->execute([(int)$id]); ok(castRow($s->fetch()));
        }
        if ($method === 'DELETE' && $id) {
            if ($action === 'serie') {
                $b=body();
                $db->prepare('DELETE FROM gestor_reservas WHERE lab=? AND dia=? AND profeId=? AND curso=? AND anual=1')
                   ->execute([$b['lab'],(int)$b['dia'],(int)$b['profeId'],$b['curso']]);
                ok(['deleted_series'=>true]);
            }
            $db->prepare('DELETE FROM gestor_reservas WHERE id=?')->execute([(int)$id]); ok(['deleted'=>(int)$id]);
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
        if ($method === 'PUT' && $id) {
            $b=body(); $fields=[]; $vals=[];
            foreach(['semanaOffset','dia','modulo','lab','curso','orient','profeId',
                     'secuencia','cicloClases','estado','esRenovacion','reservaOriginalId','renovacionNum'] as $f) {
                if (array_key_exists($f,$b)) { $fields[]="$f=?"; $vals[]=$b[$f]; }
            }
            if ($fields) { $vals[]=(int)$id; $db->prepare('UPDATE gestor_solicitudes SET '.implode(',',$fields).' WHERE id=?')->execute($vals); }
            $s=$db->prepare('SELECT * FROM gestor_solicitudes WHERE id=?'); $s->execute([(int)$id]); ok(castRow($s->fetch()));
        }
        if ($method === 'DELETE' && $id) {
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
        if ($method === 'DELETE' && $id) {
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
        if ($method === 'DELETE' && $id) {
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
        ok(castRows($db->query('SELECT id, division, ano, turno FROM cursos ORDER BY ano, division')->fetchAll()));

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
                CONCAT(cu.ano, '°', cu.division,
                    IF(cu.turno IS NOT NULL AND cu.turno <> '',
                        CONCAT(' (', cu.turno, ')'), '')
                ) AS curso_label,
                g.nombre AS grupo_nombre
            FROM revista r
            JOIN cupof    c  ON r.cupof = c.cupof
            LEFT JOIN materias m  ON c.id_materias = m.id
            LEFT JOIN cursos   cu ON c.id_cursos   = cu.id
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
                    CONCAT(cu.ano, '°', cu.division,
                        IF(cu.turno IS NOT NULL AND cu.turno <> '',
                            CONCAT(' (', cu.turno, ')'), '')
                    ) AS curso_label,
                    g.nombre AS grupo_nombre
                FROM revista r
                JOIN cupof    c  ON r.cupof = c.cupof
                LEFT JOIN materias m  ON c.id_materias = m.id
                LEFT JOIN cursos   cu ON c.id_cursos   = cu.id
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

    // ── HORARIOS FIJOS (Drag & Drop) ──────────────────────────
    case 'horarios_fijos':
        if ($method === 'PUT' && $id) {
            $b = body();
            if (!isset($b['dia'], $b['id_horas'], $b['id_salones'])) {
                err('Faltan datos requeridos: dia, id_horas, id_salones', 400);
            }
            $db->prepare('UPDATE horarios SET dia=?, id_horas=?, id_salones=? WHERE id=?')
               ->execute([$b['dia'], (int)$b['id_horas'], (int)$b['id_salones'], (int)$id]);
            ok(['updated'=>(int)$id]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM horarios WHERE id=?')->execute([(int)$id]);
            ok(['deleted'=>(int)$id]);
        }
        err('Not found',404);

    // ── ALL (carga inicial batch) ─────────────────────────────
    case 'all':
        if ($method !== 'GET') err('Method not allowed', 405);
        $repeat = isset($_GET['repeat']) ? max(1, (int)$_GET['repeat']) : 1;

        // Profesores desde `personal`
        $profs = castRows($db->query(sqlProfesores())->fetchAll());
        if ($repeat > 1) {
            $expanded = [];
            for ($i=0; $i<$repeat; $i++) $expanded = array_merge($expanded, $profs);
            $profs = $expanded;
        }

        // Labs: salones + gestor_labs (ocupado/max_grupos)
        $sql_labs = "
            SELECT
                CAST(s.id_salones AS CHAR) AS id,
                CONCAT(s.tipo, ' ', s.numero) AS nombre,
                COALESCE(gl.ocupado, 0) AS ocupado,
                s.capacidad,
                CONCAT('Ubicación: ', s.ubicacion) AS notas,
                COALESCE(gl.max_grupos, 2) AS max_grupos
            FROM salones s
            LEFT JOIN gestor_labs gl ON gl.id = CAST(s.id_salones AS CHAR)
            ORDER BY s.tipo, s.numero
        ";

        $res = [
            'labs'        => castRows($db->query($sql_labs)->fetchAll()),
            'profesores'  => $profs,
            'reservas'    => castRows($db->query('SELECT * FROM gestor_reservas ORDER BY semanaOffset,dia,modulo')->fetchAll()),
            'solicitudes' => castRows($db->query('SELECT * FROM gestor_solicitudes ORDER BY id')->fetchAll()),
            'espera'      => castRows($db->query('SELECT * FROM gestor_espera ORDER BY id')->fetchAll()),
            'pautas'      => castRows($db->query('SELECT * FROM gestor_pautas ORDER BY id')->fetchAll()),
        ];

        // Tablas maestras opcionales
        if ($db->query("SHOW TABLES LIKE 'cursos'")->fetch())
            $res['cursos'] = castRows($db->query('SELECT id, division, ano, turno FROM cursos ORDER BY ano, division')->fetchAll());
        if ($db->query("SHOW TABLES LIKE 'materias'")->fetch())
            $res['materias'] = castRows($db->query('SELECT id, nombre, abreviatura FROM materias ORDER BY nombre')->fetchAll());
        if ($db->query("SHOW TABLES LIKE 'grupos'")->fetch())
            $res['grupos'] = castRows($db->query('SELECT id, nombre, id_cursos FROM grupos ORDER BY id_cursos, nombre')->fetchAll());

        // Horarios fijos
        $hasH = $db->query("SHOW TABLES LIKE 'horarios'")->fetch();
        $hasC = $db->query("SHOW TABLES LIKE 'cupof'")->fetch();
        if ($hasH && $hasC) {
            $res['horarios_fijos'] = castRows($db->query("
                SELECT
                    h.id, h.dia, h.id_horas, h.id_salones, h.cupof,
                    c.id_materias, c.id_cursos,
                    c.turno       AS cupof_turno,
                    m.abreviatura AS materia_abrev,
                    m.nombre      AS materia_nombre,
                    cu.ano        AS curso_ano,
                    cu.division   AS curso_division,
                    CONCAT(cu.ano, '\u00b0 ', cu.division) AS curso_label,
                    CONCAT(s.piso, '-', LPAD(s.numero, 2, '0')) AS aula_codigo,
                    s.numero      AS aula_numero,
                    s.tipo        AS aula_tipo
                FROM horarios h
                JOIN cupof c  ON h.cupof     = c.cupof
                LEFT JOIN materias m   ON c.id_materias = m.id
                LEFT JOIN cursos   cu  ON c.id_cursos   = cu.id
                LEFT JOIN salones  s   ON h.id_salones  = s.id_salones
                ORDER BY h.dia, h.id_horas
            ")->fetchAll());
        }

        ok($res);

    default:
        err('Endpoint not found',404);
}
