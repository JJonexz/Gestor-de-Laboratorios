<?php
// ============================================================
// api.php — Backend MySQL para Gestor de Laboratorios
// Base de datos: escuela (MariaDB/MySQL)
//
// Tablas propias del gestor (creadas automáticamente):
//   gestor_labs, gestor_profesores, gestor_reservas,
//   gestor_solicitudes, gestor_espera, gestor_pautas
//
// Autenticación: tabla `personal` de la BDD escuela
// ============================================================

// Mostrar errores PHP en la respuesta JSON (debug — quitar en producción)
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
// Editá estos valores según tu servidor
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

    // Opcional: Solo inicializar si se solicita explícitamente o en el login
    // Para evitar deadlocks en peticiones concurrentes, no ejecutamos initSchema siempre.
    return $pdo;
}

function initSchema($pdo) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS gestor_labs (
            id        VARCHAR(10) NOT NULL,
            nombre    VARCHAR(100) NOT NULL,
            ocupado   TINYINT NOT NULL DEFAULT 0,
            capacidad SMALLINT NOT NULL DEFAULT 20,
            notas     VARCHAR(500) NOT NULL DEFAULT '',
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS gestor_profesores (
            id          INT NOT NULL AUTO_INCREMENT,
            apellido    VARCHAR(50) NOT NULL,
            nombre      VARCHAR(50) NOT NULL,
            orientacion VARCHAR(50) NOT NULL DEFAULT 'bas',
            materia     VARCHAR(100) NOT NULL DEFAULT '',
            dni_personal INT DEFAULT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY (dni_personal)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS gestor_reservas (
            id           INT NOT NULL AUTO_INCREMENT,
            semanaOffset INT NOT NULL DEFAULT 0,
            dia          TINYINT NOT NULL,
            modulo       TINYINT NOT NULL,
            lab          VARCHAR(10) NOT NULL,
            curso        VARCHAR(20) NOT NULL,
            orient       VARCHAR(50) NOT NULL DEFAULT 'bas',
            profeId      INT NOT NULL,
            secuencia    VARCHAR(500) NOT NULL DEFAULT '',
            cicloClases  TINYINT NOT NULL DEFAULT 1,
            renovaciones TINYINT NOT NULL DEFAULT 0,
            anual        TINYINT NOT NULL DEFAULT 0,
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
            profeId           INT NOT NULL,
            secuencia         VARCHAR(500) NOT NULL DEFAULT '',
            cicloClases       TINYINT NOT NULL DEFAULT 1,
            estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente',
            esRenovacion      TINYINT NOT NULL DEFAULT 0,
            reservaOriginalId INT DEFAULT NULL,
            renovacionNum     TINYINT NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            INDEX idx_estado (estado)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS gestor_espera (
            id           INT NOT NULL AUTO_INCREMENT,
            profeId      INT NOT NULL,
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

    syncFromMaster($pdo);
}

function syncFromMaster($pdo) {
    // 1. Sincronizar SALONES -> GESTOR_LABS
    $hasSalones = $pdo->query("SHOW TABLES LIKE 'salones'")->fetch();
    if ($hasSalones) {
        // Eliminamos labs de ejemplo (A, B, C) si existen
        $pdo->exec("DELETE FROM gestor_labs WHERE id IN ('A', 'B', 'C')");
        // Eliminamos reservas y solicitudes que referencien a los labs viejos
        $pdo->exec("DELETE FROM gestor_reservas WHERE lab IN ('A', 'B', 'C')");
        $pdo->exec("DELETE FROM gestor_solicitudes WHERE lab IN ('A', 'B', 'C')");
        
        // Insertamos/Actualizamos desde salones
        $pdo->exec("
            INSERT IGNORE INTO gestor_labs (id, nombre, capacidad, notas)
            SELECT 
                CAST(id_salones AS CHAR), 
                CONCAT(tipo, ' ', numero), 
                capacidad, 
                CONCAT('Ubicación: ', ubicacion)
            FROM salones
        ");
    }

    // 2. Sincronizar PERSONAL -> GESTOR_PROFESORES
    $hasPersonal = $pdo->query("SHOW TABLES LIKE 'personal'")->fetch();
    if ($hasPersonal) {
        // Eliminamos profesores de ejemplo si no tienen DNI vinculado
        $pdo->exec("DELETE FROM gestor_profesores WHERE dni_personal IS NULL");
        
        $pdo->exec("
            INSERT IGNORE INTO gestor_profesores (apellido, nombre, dni_personal, materia)
            SELECT apellido, nombre, dni, 'Docente'
            FROM personal
            WHERE dni > 0 AND apellido <> ''
        ");
    }

    // Datos iniciales de ejemplo (solo si no hay nada en absoluto)
    $cntPautas = $pdo->query('SELECT COUNT(*) FROM gestor_pautas')->fetchColumn();
    if ($cntPautas == 0) {
        $pautas = [
            'Dejar el aula limpia al salir',
            'Apagar todos los equipos al finalizar la clase',
            'Renovar el turno cada 3 clases (ciclo didáctico)',
            'Registrar la secuencia didáctica al reservar',
            'No consumir alimentos ni bebidas en el laboratorio',
            'Reportar desperfectos al personal de mantenimiento',
            'Respetar el horario asignado — no excederse',
        ];
        $s = $pdo->prepare('INSERT INTO gestor_pautas(texto) VALUES(?)');
        foreach ($pautas as $p) $s->execute([$p]);
    }
}


// ── Helpers ──────────────────────────────────────────────────
function ok($data)  { echo json_encode(['ok'=>true,'data'=>$data], JSON_UNESCAPED_UNICODE); exit; }
function err($msg, $code=400) { http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg], JSON_UNESCAPED_UNICODE); exit; }
function body() { return json_decode(file_get_contents('php://input'), true) ?? []; }

function castRow($r) {
    $numericStringsAsInt = true; 
    foreach($r as $key => $v) {
        if (is_null($v)) {
            $r[$key] = null;
            continue;
        }
        // No castear a int los IDs de laboratorio o referencias de lab para evitar fallos de === en JS
        if ($key === 'lab' || ($key === 'id' && !is_numeric($v))) {
            $r[$key] = (string)$v;
            continue;
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
        initSchema($db); // Inicializar/Sincronizar solo al loguear
        if ($method !== 'POST') err('Method not allowed', 405);
        $b        = body();
        $username = strtolower(trim($b['username'] ?? ''));
        $password = $b['password'] ?? '';

        // Administrador estático
        if ($username === 'admin' && $password === 'admin123') {
            ok(['id'=>0,'display'=>'Administrador','role'=>'admin','profeId'=>null,'tag'=>'admin']);
        }

        // DNI numérico
        $row = null;
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

        // Por apellido.primerNombre  (ej: "ces.leandro")
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

        // Por apellido solo (ej: "ces")
        if (!$row) {
            $s = $db->prepare(
                "SELECT * FROM personal WHERE LOWER(REPLACE(TRIM(apellido),' ',''))=? LIMIT 1"
            );
            $s->execute([str_replace(' ', '', $username)]);
            $row = $s->fetch() ?: null;
        }

        if (!$row) err('Usuario no encontrado', 401);
        if ($row['pass'] !== $password) err('Contraseña incorrecta', 401);

        // Buscar profeId en el gestor
        $s2 = $db->prepare("SELECT id FROM gestor_profesores WHERE dni_personal=? LIMIT 1");
        $s2->execute([(int)$row['dni']]);
        $profId = $s2->fetchColumn() ?: null;
        if (!$profId) {
            $s3 = $db->prepare("SELECT id FROM gestor_profesores WHERE UPPER(TRIM(apellido))=UPPER(TRIM(?)) LIMIT 1");
            $s3->execute([$row['apellido']]);
            $profId = $s3->fetchColumn() ?: null;
        }

        $display = ucwords(strtolower(trim($row['apellido'])));
        $computedRole = (isset($row['tag']) && !empty(trim($row['tag']))) ? 'admin' : 'prof';
        ok([
            'id'      => (int)$row['dni'],
            'display' => ($computedRole === 'admin' ? '' : 'Prof. ') . $display,
            'role'    => $computedRole,
            'profeId' => $profId ? (int)$profId : null,
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
    case 'labs':
        if ($method === 'GET') ok($db->query('SELECT * FROM gestor_labs ORDER BY id')->fetchAll());
        if ($method === 'POST') {
            $b = body();
            $db->prepare('INSERT INTO gestor_labs(id,nombre,ocupado,capacidad,notas) VALUES(?,?,?,?,?)')
               ->execute([$b['id'],$b['nombre'],(int)($b['ocupado']??0),(int)($b['capacidad']??20),$b['notas']??'']);
            $s=$db->prepare('SELECT * FROM gestor_labs WHERE id=?'); $s->execute([$b['id']]); ok($s->fetch());
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $db->prepare('UPDATE gestor_labs SET nombre=?,ocupado=?,capacidad=?,notas=? WHERE id=?')
               ->execute([$b['nombre'],(int)($b['ocupado']??0),(int)($b['capacidad']??20),$b['notas']??'',$id]);
            $s=$db->prepare('SELECT * FROM gestor_labs WHERE id=?'); $s->execute([$id]); ok($s->fetch());
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM gestor_labs WHERE id=?')->execute([$id]); ok(['deleted'=>$id]);
        }
        err('Not found',404);

    // ── PROFESORES ────────────────────────────────────────────
    case 'profesores':
        if ($method === 'GET') {
            $repeat = isset($_GET['repeat']) ? max(1, (int)$_GET['repeat']) : 1;
            $data = castRows($db->query('SELECT id,apellido,nombre,orientacion,materia,dni_personal FROM gestor_profesores ORDER BY apellido')->fetchAll());
            if ($repeat > 1) {
                $expanded = [];
                for ($i=0; $i<$repeat; $i++) $expanded = array_merge($expanded, $data);
                $data = $expanded;
            }
            ok($data);
        }
        if ($method === 'POST') {
            $b = body();
            $db->prepare('INSERT INTO gestor_profesores(apellido,nombre,orientacion,materia,dni_personal) VALUES(?,?,?,?,?)')
               ->execute([$b['apellido'],$b['nombre'],$b['orientacion']??'bas',$b['materia']??'',
                          isset($b['dni_personal'])?(int)$b['dni_personal']:null]);
            $newId=(int)$db->lastInsertId();
            $s=$db->prepare('SELECT * FROM gestor_profesores WHERE id=?'); $s->execute([$newId]); ok(castRow($s->fetch()));
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $db->prepare('UPDATE gestor_profesores SET apellido=?,nombre=?,orientacion=?,materia=?,dni_personal=? WHERE id=?')
               ->execute([$b['apellido'],$b['nombre'],$b['orientacion']??'bas',$b['materia']??'',
                          isset($b['dni_personal'])?(int)$b['dni_personal']:null,(int)$id]);
            $s=$db->prepare('SELECT * FROM gestor_profesores WHERE id=?'); $s->execute([(int)$id]); ok(castRow($s->fetch()));
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM gestor_profesores WHERE id=?')->execute([(int)$id]); ok(['deleted'=>(int)$id]);
        }
        err('Not found',404);

    // ── RESERVAS ──────────────────────────────────────────────
    case 'reservas':
        if ($method === 'GET') {
            $where='1=1'; $p=[];
            if (isset($_GET['semanaOffset'])) { $where.=' AND semanaOffset=?'; $p[]=(int)$_GET['semanaOffset']; }
            if (isset($_GET['profeId']))      { $where.=' AND profeId=?';      $p[]=(int)$_GET['profeId']; }
            $s=$db->prepare("SELECT * FROM gestor_reservas WHERE $where ORDER BY semanaOffset,dia,modulo");
            $s->execute($p); ok(castRows($s->fetchAll()));
        }
        if ($method === 'POST') {
            $b=body();
            $db->prepare('INSERT INTO gestor_reservas(semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,renovaciones,anual) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
               ->execute([(int)($b['semanaOffset']??0),(int)$b['dia'],(int)$b['modulo'],
                           $b['lab'],$b['curso'],$b['orient']??'bas',(int)$b['profeId'],
                           $b['secuencia']??'',(int)($b['cicloClases']??1),
                           (int)($b['renovaciones']??0),(int)($b['anual']??0)]);
            $newId=(int)$db->lastInsertId();
            $s=$db->prepare('SELECT * FROM gestor_reservas WHERE id=?'); $s->execute([$newId]); ok(castRow($s->fetch()));
        }
        if ($method === 'PUT' && $id) {
            $b=body();
            $db->prepare('UPDATE gestor_reservas SET semanaOffset=?,dia=?,modulo=?,lab=?,curso=?,orient=?,profeId=?,secuencia=?,cicloClases=?,renovaciones=?,anual=? WHERE id=?')
               ->execute([(int)($b['semanaOffset']??0),(int)$b['dia'],(int)$b['modulo'],
                           $b['lab'],$b['curso'],$b['orient']??'bas',(int)$b['profeId'],
                           $b['secuencia']??'',(int)($b['cicloClases']??1),
                           (int)($b['renovaciones']??0),(int)($b['anual']??0),(int)$id]);
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
            if (isset($_GET['profeId'])) { $where.=' AND profeId=?'; $p[]=(int)$_GET['profeId']; }
            $s=$db->prepare("SELECT * FROM gestor_solicitudes WHERE $where ORDER BY id");
            $s->execute($p); ok(castRows($s->fetchAll()));
        }
        if ($method === 'POST') {
            $b=body();
            $db->prepare('INSERT INTO gestor_solicitudes(semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,estado,esRenovacion,reservaOriginalId,renovacionNum) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
               ->execute([(int)($b['semanaOffset']??0),(int)$b['dia'],(int)$b['modulo'],
                           $b['lab'],$b['curso'],$b['orient']??'bas',(int)$b['profeId'],
                           $b['secuencia']??'',(int)($b['cicloClases']??1),
                           $b['estado']??'pendiente',(int)($b['esRenovacion']??0),
                           isset($b['reservaOriginalId'])?(int)$b['reservaOriginalId']:null,
                           (int)($b['renovacionNum']??0)]);
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
               ->execute([(int)$b['profeId'],$b['lab'],(int)$b['dia'],(int)$b['modulo'],(int)($b['semanaOffset']??0)]);
            $newId=(int)$db->lastInsertId();
            ok(['id'=>$newId,'profeId'=>(int)$b['profeId'],'lab'=>$b['lab'],
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
    case 'cursos':
        if ($method !== 'GET') err('Method not allowed', 405);
        ok(castRows($db->query('SELECT id, division, ano, turno FROM cursos ORDER BY ano, division')->fetchAll()));

    // ── MATERIAS ──────────────────────────────────────────────
    case 'materias':
        if ($method !== 'GET') err('Method not allowed', 405);
        ok(castRows($db->query('SELECT id, nombre, abreviatura FROM materias ORDER BY nombre')->fetchAll()));

    // ── ALL ───────────────────────────────────────────────────
    case 'all':
        if ($method !== 'GET') err('Method not allowed', 405);
        $repeat = isset($_GET['repeat']) ? max(1, (int)$_GET['repeat']) : 1;
        $profs = castRows($db->query('SELECT id,apellido,nombre,orientacion,materia,dni_personal FROM gestor_profesores ORDER BY apellido')->fetchAll());
        if ($repeat > 1) {
            $expanded = [];
            for ($i=0; $i<$repeat; $i++) $expanded = array_merge($expanded, $profs);
            $profs = $expanded;
        }

        $res = [
            'labs'        => $db->query('SELECT * FROM gestor_labs ORDER BY id')->fetchAll(),
            'profesores'  => $profs,
            'reservas'    => castRows($db->query('SELECT * FROM gestor_reservas ORDER BY semanaOffset,dia,modulo')->fetchAll()),
            'solicitudes' => castRows($db->query('SELECT * FROM gestor_solicitudes ORDER BY id')->fetchAll()),
            'espera'      => castRows($db->query('SELECT * FROM gestor_espera ORDER BY id')->fetchAll()),
            'pautas'      => castRows($db->query('SELECT * FROM gestor_pautas ORDER BY id')->fetchAll()),
        ];
        
        // Tablas maestras opcionales
        $hasCursos = $db->query("SHOW TABLES LIKE 'cursos'")->fetch();
        if ($hasCursos) $res['cursos'] = castRows($db->query('SELECT id, division, ano, turno FROM cursos ORDER BY ano, division')->fetchAll());
        
        $hasMaterias = $db->query("SHOW TABLES LIKE 'materias'")->fetch();
        if ($hasMaterias) $res['materias'] = castRows($db->query('SELECT id, nombre, abreviatura FROM materias ORDER BY nombre')->fetchAll());

        ok($res);

    default:
        err('Endpoint not found',404);
}
