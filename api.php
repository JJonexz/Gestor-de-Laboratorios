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

    initSchema($pdo);
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
            orientacion VARCHAR(10) NOT NULL DEFAULT 'bas',
            materia     VARCHAR(100) NOT NULL DEFAULT '',
            dni_personal INT DEFAULT NULL,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

        CREATE TABLE IF NOT EXISTS gestor_reservas (
            id           INT NOT NULL AUTO_INCREMENT,
            semanaOffset INT NOT NULL DEFAULT 0,
            dia          TINYINT NOT NULL,
            modulo       TINYINT NOT NULL,
            lab          VARCHAR(10) NOT NULL,
            curso        VARCHAR(20) NOT NULL,
            orient       VARCHAR(10) NOT NULL DEFAULT 'bas',
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
            orient            VARCHAR(10) NOT NULL DEFAULT 'bas',
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

    $cnt = $pdo->query('SELECT COUNT(*) FROM gestor_labs')->fetchColumn();
    if ($cnt == 0) seedInitialData($pdo);
}

function seedInitialData($pdo) {
    $pdo->exec("INSERT INTO gestor_labs VALUES
        ('A','Lab. Informático A',0,20,'Windows 11, Packet Tracer, Visual Studio Code'),
        ('B','Lab. Informático B',0,24,'Linux Mint, Arduino IDE, Python 3.11'),
        ('C','Sala Multimedia',0,16,'Proyector 4K, Adobe Suite, cámaras digitales')
    ");

    $profs = [
        ['Ces',        'Roberto', 'info', 'Programación'],
        ['Di Martino', 'Claudia', 'const','Construcciones Civiles'],
        ['Pieroni',    'Marcelo', 'tur',  'Turismo y Hotelería'],
        ['Reichert',   'Sandra',  'info', 'Redes y Comunicaciones'],
        ['Arnaiz',     'Gustavo', 'bas',  'Matemática'],
        ['Fontana',    'Valeria', 'info', 'Sistemas Operativos'],
        ['Romero',     'Diego',   'tur',  'Geografía Turística'],
        ['Salinas',    'Patricia','bas',  'Lengua y Literatura'],
    ];
    $matchQ = $pdo->prepare("SELECT dni FROM personal WHERE UPPER(TRIM(apellido)) LIKE UPPER(?) LIMIT 1");
    $insProf = $pdo->prepare(
        'INSERT INTO gestor_profesores(apellido,nombre,orientacion,materia,dni_personal) VALUES(?,?,?,?,?)'
    );
    foreach ($profs as $p) {
        $matchQ->execute([$p[0] . '%']);
        $dni = $matchQ->fetchColumn() ?: null;
        $insProf->execute([$p[0], $p[1], $p[2], $p[3], $dni]);
    }

    $reservas = [
        [0,0,0,'A','4°B','info',1,'Introducción a Python: variables y tipos de datos',1,0],
        [0,0,1,'B','6°A','const',2,'Diseño asistido: planos en AutoCAD',2,0],
        [0,0,3,'A','3°A','const',2,'Planos estructurales digitales con SketchUp',1,0],
        [0,0,6,'C','2°C','bas',5,'Funciones cuadráticas con GeoGebra',3,0],
        [0,0,9,'A','5°A','tur',3,'Diseño de página web turística — maquetado HTML',1,0],
        [0,0,11,'B','1°B','bas',8,'Introducción a procesadores de texto',2,0],
        [0,1,0,'B','2°A','bas',5,'Estadística descriptiva con planilla de cálculo',2,0],
        [0,1,1,'A','5°A','tur',3,'Sistemas de reservas online: Opera PMS',2,0],
        [0,1,4,'C','4°A','tur',7,'Cartografía digital y Google Earth',1,0],
        [0,1,6,'A','6°B','info',4,'Configuración de routers Cisco — VLANs',3,1],
        [0,1,11,'B','3°C','info',6,'Sistemas operativos: instalación de Linux',1,0],
        [0,2,0,'A','3°B','const',2,'Maquetas 3D con SketchUp: modelado de fachadas',1,0],
        [0,2,1,'B','6°B','info',4,'Subredes IPv4 y tablas de enrutamiento',2,0],
        [0,2,3,'C','5°B','tur',3,'Presentaciones multimedia de destinos turísticos',3,0],
        [0,2,9,'A','1°A','bas',5,'Introducción a la informática: hardware y software',1,0],
        [0,3,0,'A','2°A','const',2,'Instalaciones eléctricas: simulación en ETAP',2,0],
        [0,3,1,'B','4°C','info',1,'Algoritmia y estructuras de datos en Python',3,0],
        [0,4,0,'B','5°A','info',1,'Proyecto final: app de gestión escolar',2,0],
        [0,4,1,'A','6°A','info',4,'Seguridad en redes: configuración de VPN',1,0],
    ];
    $stmt = $pdo->prepare('INSERT INTO gestor_reservas(semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,renovaciones) VALUES(?,?,?,?,?,?,?,?,?,?)');
    foreach ($reservas as $r) $stmt->execute($r);

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

// ── Helpers ──────────────────────────────────────────────────
function ok($data)  { echo json_encode(['ok'=>true,'data'=>$data], JSON_UNESCAPED_UNICODE); exit; }
function err($msg, $code=400) { http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg], JSON_UNESCAPED_UNICODE); exit; }
function body() { return json_decode(file_get_contents('php://input'), true) ?? []; }

function castRow($r) {
    return array_map(function($v) {
        if (is_null($v)) return null;
        if (is_numeric($v) && strpos((string)$v, '.') === false) return (int)$v;
        return $v;
    }, $r);
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
        if ($method !== 'POST') err('Method not allowed', 405);
        $b        = body();
        $username = strtolower(trim($b['username'] ?? ''));
        $password = $b['password'] ?? '';
        $role     = $b['role'] ?? 'prof';

        // Administrador estático
        if ($username === 'admin' && $password === 'admin123') {
            if ($role !== 'admin') err('Credenciales incorrectas para el rol seleccionado', 401);
            ok(['id'=>0,'display'=>'Administrador','role'=>'admin','profeId'=>null]);
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
        ok([
            'id'      => (int)$row['dni'],
            'display' => ($role === 'admin' ? '' : 'Prof. ') . $display,
            'role'    => $role,
            'profeId' => $profId ? (int)$profId : null,
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
            ok(castRows($db->query('SELECT id,apellido,nombre,orientacion,materia,dni_personal FROM gestor_profesores ORDER BY apellido')->fetchAll()));
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

    // ── ALL ───────────────────────────────────────────────────
    case 'all':
        if ($method !== 'GET') err('Method not allowed',405);
        ok([
            'labs'        => $db->query('SELECT * FROM gestor_labs ORDER BY id')->fetchAll(),
            'profesores'  => castRows($db->query('SELECT id,apellido,nombre,orientacion,materia,dni_personal FROM gestor_profesores ORDER BY apellido')->fetchAll()),
            'reservas'    => castRows($db->query('SELECT * FROM gestor_reservas ORDER BY semanaOffset,dia,modulo')->fetchAll()),
            'solicitudes' => castRows($db->query('SELECT * FROM gestor_solicitudes ORDER BY id')->fetchAll()),
            'espera'      => castRows($db->query('SELECT * FROM gestor_espera ORDER BY id')->fetchAll()),
            'pautas'      => castRows($db->query('SELECT * FROM gestor_pautas ORDER BY id')->fetchAll()),
        ]);

    default:
        err('Endpoint not found',404);
}
