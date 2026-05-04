<?php
// ============================================================
// api.php — Backend SQLite para Gestor de Laboratorios
// Soporta: GET/POST/PUT/DELETE para todas las entidades
// ============================================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

define('DB_FILE', __DIR__ . '/data/gestor.sqlite');

// ── Conectar / inicializar SQLite ────────────────────────────
function getDB() {
    static $pdo = null;
    if ($pdo) return $pdo;

    $dir = dirname(DB_FILE);
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $pdo = new PDO('sqlite:' . DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;');

    initSchema($pdo);
    return $pdo;
}

function initSchema($pdo) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS personal (
            dni       INTEGER PRIMARY KEY,
            apellido  TEXT NOT NULL,
            nombre    TEXT NOT NULL,
            email     TEXT NOT NULL DEFAULT '',
            pass      TEXT NOT NULL DEFAULT '1234',
            tag       TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS profesores (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            apellido    TEXT NOT NULL,
            nombre      TEXT NOT NULL,
            orientacion TEXT NOT NULL DEFAULT 'bas',
            materia     TEXT NOT NULL DEFAULT '',
            dni_personal INTEGER REFERENCES personal(dni)
        );

        CREATE TABLE IF NOT EXISTS labs (
            id        TEXT PRIMARY KEY,
            nombre    TEXT NOT NULL,
            ocupado   INTEGER NOT NULL DEFAULT 0,
            capacidad INTEGER NOT NULL DEFAULT 20,
            notas     TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS reservas (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            semanaOffset INTEGER NOT NULL DEFAULT 0,
            dia          INTEGER NOT NULL,
            modulo       INTEGER NOT NULL,
            lab          TEXT NOT NULL REFERENCES labs(id),
            curso        TEXT NOT NULL,
            orient       TEXT NOT NULL DEFAULT 'bas',
            profeId      INTEGER NOT NULL REFERENCES profesores(id),
            secuencia    TEXT NOT NULL DEFAULT '',
            cicloClases  INTEGER NOT NULL DEFAULT 1,
            renovaciones INTEGER NOT NULL DEFAULT 0,
            anual        INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS solicitudes (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            semanaOffset      INTEGER NOT NULL DEFAULT 0,
            dia               INTEGER NOT NULL,
            modulo            INTEGER NOT NULL,
            lab               TEXT NOT NULL REFERENCES labs(id),
            curso             TEXT NOT NULL,
            orient            TEXT NOT NULL DEFAULT 'bas',
            profeId           INTEGER NOT NULL REFERENCES profesores(id),
            secuencia         TEXT NOT NULL DEFAULT '',
            cicloClases       INTEGER NOT NULL DEFAULT 1,
            estado            TEXT NOT NULL DEFAULT 'pendiente',
            esRenovacion      INTEGER NOT NULL DEFAULT 0,
            reservaOriginalId INTEGER,
            renovacionNum     INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS lista_espera (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            profeId      INTEGER NOT NULL REFERENCES profesores(id),
            lab          TEXT NOT NULL REFERENCES labs(id),
            dia          INTEGER NOT NULL,
            modulo       INTEGER NOT NULL,
            semanaOffset INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS pautas (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            texto TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_reservas_slot ON reservas(lab, dia, modulo, semanaOffset);
        CREATE INDEX IF NOT EXISTS idx_reservas_profe ON reservas(profeId);
        CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
    ");

    // Seed initial data only if tables are empty
    $cnt = $pdo->query('SELECT COUNT(*) FROM labs')->fetchColumn();
    if ($cnt == 0) {
        seedInitialData($pdo);
    }
}

function seedInitialData($pdo) {
    // Labs
    $pdo->exec("INSERT INTO labs VALUES
        ('A','Lab. Informático A',0,20,'Windows 11, Packet Tracer, Visual Studio Code'),
        ('B','Lab. Informático B',0,24,'Linux Mint, Arduino IDE, Python 3.11'),
        ('C','Sala Multimedia',0,16,'Proyector 4K, Adobe Suite, cámaras digitales')
    ");

    // Profesores
    $profs = [
        [1,'Ces','Roberto','info','Programación'],
        [2,'Di Martino','Claudia','const','Construcciones Civiles'],
        [3,'Pieroni','Marcelo','tur','Turismo y Hotelería'],
        [4,'Reichert','Sandra','info','Redes y Comunicaciones'],
        [5,'Arnaiz','Gustavo','bas','Matemática'],
        [6,'Fontana','Valeria','info','Sistemas Operativos'],
        [7,'Romero','Diego','tur','Geografía Turística'],
        [8,'Salinas','Patricia','bas','Lengua y Literatura'],
    ];
    $stmt = $pdo->prepare('INSERT INTO profesores(id,apellido,nombre,orientacion,materia) VALUES(?,?,?,?,?)');
    foreach ($profs as $p) $stmt->execute($p);

    // Reservas (from original reservas.json)
    $reservas = [
        [1,0,0,0,'A','4°B','info',1,'Introducción a Python: variables y tipos de datos',1,0],
        [2,0,0,1,'B','6°A','const',2,'Diseño asistido: planos en AutoCAD',2,0],
        [3,0,0,3,'A','3°A','const',2,'Planos estructurales digitales con SketchUp',1,0],
        [4,0,0,6,'C','2°C','bas',5,'Funciones cuadráticas con GeoGebra',3,0],
        [5,0,0,9,'A','5°A','tur',3,'Diseño de página web turística — maquetado HTML',1,0],
        [6,0,0,11,'B','1°B','bas',8,'Introducción a procesadores de texto',2,0],
        [7,0,1,0,'B','2°A','bas',5,'Estadística descriptiva con planilla de cálculo',2,0],
        [8,0,1,1,'A','5°A','tur',3,'Sistemas de reservas online: Opera PMS',2,0],
        [9,0,1,4,'C','4°A','tur',7,'Cartografía digital y Google Earth',1,0],
        [10,0,1,6,'A','6°B','info',4,'Configuración de routers Cisco — VLANs',3,1],
        [11,0,1,11,'B','3°C','info',6,'Sistemas operativos: instalación de Linux',1,0],
        [12,0,2,0,'A','3°B','const',2,'Maquetas 3D con SketchUp: modelado de fachadas',1,0],
        [13,0,2,1,'B','6°B','info',4,'Subredes IPv4 y tablas de enrutamiento',2,0],
        [14,0,2,3,'C','5°B','tur',3,'Presentaciones multimedia de destinos turísticos',3,0],
        [15,0,2,9,'A','1°A','bas',5,'Introducción a la informática: hardware y software',1,0],
        [16,0,2,12,'B','2°B','bas',8,'Producción textual con procesadores digitales',2,0],
        [17,0,3,0,'A','2°A','const',2,'Instalaciones eléctricas: simulación en ETAP',2,0],
        [18,0,3,1,'B','4°C','info',1,'Algoritmia y estructuras de datos en Python',3,0],
        [19,0,3,6,'C','2°B','bas',5,'Geometría con GeoGebra 3D',1,0],
        [20,0,3,9,'A','6°A','info',6,'Virtualización con VirtualBox: máquinas virtuales',2,0],
        [21,0,3,15,'B','3°B','tur',7,'Geografía turística: análisis de rutas digitales',1,0],
        [22,0,4,0,'B','5°A','info',1,'Proyecto final: app de gestión escolar',2,0],
        [23,0,4,1,'A','6°A','info',4,'Seguridad en redes: configuración de VPN',1,0],
        [24,0,4,3,'C','3°A','tur',3,'Diseño de folleto turístico digital en Canva',2,0],
        [25,0,4,6,'A','4°B','info',1,'Programación orientada a objetos: clases y herencia',3,1],
        [26,0,4,11,'B','1°C','bas',8,'Alfabetización digital: Internet y búsquedas avanzadas',1,0],
        [27,1,0,0,'A','4°B','info',1,'Python: funciones y módulos',2,0],
        [28,1,1,1,'B','5°A','info',4,'Protocolos de red: TCP/IP en profundidad',1,0],
        [29,1,2,3,'A','6°A','const',2,'Presupuestos de obra con software especializado',1,0],
        [30,1,3,6,'C','3°B','tur',7,'Itinerarios turísticos con herramientas digitales',1,0],
        [31,1,4,9,'B','2°C','bas',5,'Trigonometría: gráficas con GeoGebra',1,0],
        [32,-1,1,0,'A','4°B','info',1,'Python: condicionales y bucles',3,0],
        [33,-1,3,1,'B','6°B','info',4,'Laboratorio de cableado estructurado',3,0],
    ];
    $stmt = $pdo->prepare('INSERT INTO reservas(id,semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,renovaciones) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    foreach ($reservas as $r) $stmt->execute($r);

    // Solicitudes
    $solicitudes = [
        [101,0,2,6,'B','2°A','info',4,'Laboratorio de subredes IPv4 — práctica con Packet Tracer',1,'pendiente',0,null,0],
        [102,0,4,4,'A','3°C','const',2,'Cálculo de estructuras: planillas digitales',1,'pendiente',0,null,0],
        [103,0,1,10,'A','6°A','info',4,'Seguridad perimetral — firewall y ACLs',1,'pendiente',1,10,2],
    ];
    $stmt = $pdo->prepare('INSERT INTO solicitudes(id,semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,estado,esRenovacion,reservaOriginalId,renovacionNum) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    foreach ($solicitudes as $s) $stmt->execute($s);

    // Lista espera
    $pdo->exec("INSERT INTO lista_espera(id,profeId,lab,dia,modulo,semanaOffset) VALUES
        (1,5,'A',3,0,0),(2,6,'B',1,6,0)
    ");

    // Pautas
    $pautas = [
        'Dejar el aula limpia al salir',
        'Apagar todos los equipos al finalizar la clase',
        'Renovar el turno cada 3 clases (ciclo didáctico)',
        'Registrar la secuencia didáctica al reservar',
        'No consumir alimentos ni bebidas en el laboratorio',
        'Reportar desperfectos al personal de mantenimiento',
        'Respetar el horario asignado — no excederse',
    ];
    $stmt = $pdo->prepare('INSERT INTO pautas(texto) VALUES(?)');
    foreach ($pautas as $p) $stmt->execute([$p]);
}

// ── Helpers ──────────────────────────────────────────────────
function ok($data)  { echo json_encode(['ok' => true, 'data' => $data]); exit; }
function err($msg, $code = 400) { http_response_code($code); echo json_encode(['ok' => false, 'error' => $msg]); exit; }
function body()     { return json_decode(file_get_contents('php://input'), true) ?? []; }

// ── Router ───────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$path   = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
// Remove leading directory if running in subdir
$path = preg_replace('#^.*?api\.php/?#', '', $path);
$segments = array_values(array_filter(explode('/', $path)));
$resource = $segments[0] ?? '';
$id       = $segments[1] ?? null;
$action   = $segments[2] ?? null;

$db = getDB();

switch ($resource) {

    // ── AUTH ─────────────────────────────────────────────────
    case 'auth':
        if ($method !== 'POST') err('Method not allowed', 405);
        $b = body();
        $username = strtolower(trim($b['username'] ?? ''));
        $password = $b['password'] ?? '';
        $role     = $b['role'] ?? 'prof';

        // Static admin account
        if ($username === 'admin' && $password === 'admin123' && $role === 'admin') {
            ok(['id' => 0, 'display' => 'Administrador', 'role' => 'admin', 'profeId' => null]);
        }

        // Lookup in personal table using tag field (username format: apellido.nombre)
        $row = $db->query("SELECT * FROM personal WHERE LOWER(REPLACE(apellido,' ','') || '.' || LOWER(SUBSTR(nombre,1,INSTR(nombre,' ')-1))) = " . $db->quote($username) . " OR LOWER(tag) = " . $db->quote($username))->fetch();

        if (!$row) err('Usuario no encontrado', 401);
        if ($row['pass'] !== $password) err('Contraseña incorrecta', 401);

        // Find matching profesor
        $prof = $db->query("SELECT * FROM profesores WHERE dni_personal = " . intval($row['dni']))->fetch();

        ok([
            'id'      => $row['dni'],
            'display' => 'Prof. ' . ucfirst(strtolower($row['apellido'])),
            'role'    => ($role === 'admin') ? 'admin' : 'prof',
            'profeId' => $prof ? (int)$prof['id'] : null,
        ]);

    // ── LOGIN (legacy simple lookup by tag) ───────────────────
    case 'login':
        if ($method !== 'POST') err('Method not allowed', 405);
        $b = body();
        $username = strtolower(trim($b['username'] ?? ''));
        $password = $b['password'] ?? '';

        // Static users (profesores hardcoded from original)
        $static = [
            'ces.roberto'       => ['pass'=>'ces123',   'id'=>1, 'display'=>'Prof. Ces',        'role'=>'prof'],
            'dimartino.claudia' => ['pass'=>'dim123',   'id'=>2, 'display'=>'Prof. Di Martino', 'role'=>'prof'],
            'pieroni.marcelo'   => ['pass'=>'pie123',   'id'=>3, 'display'=>'Prof. Pieroni',    'role'=>'prof'],
            'reichert.sandra'   => ['pass'=>'rei123',   'id'=>4, 'display'=>'Prof. Reichert',   'role'=>'prof'],
            'arnaiz.gustavo'    => ['pass'=>'arn123',   'id'=>5, 'display'=>'Prof. Arnaiz',     'role'=>'prof'],
            'admin'             => ['pass'=>'admin123', 'id'=>0, 'display'=>'Administrador',    'role'=>'admin'],
        ];

        if (isset($static[$username])) {
            $u = $static[$username];
            if ($u['pass'] !== $password) err('Contraseña incorrecta', 401);
            ok($u);
        }

        // Also check personal table by tag
        $row = $db->query("SELECT * FROM personal WHERE LOWER(tag) = " . $db->quote($username))->fetch();
        if (!$row || $row['pass'] !== $password) err('Usuario o contraseña incorrectos', 401);

        $prof = $db->query("SELECT id FROM profesores WHERE dni_personal = " . intval($row['dni']))->fetchColumn();
        ok([
            'id'      => $row['dni'],
            'display' => 'Prof. ' . ucwords(strtolower($row['apellido'])),
            'role'    => 'prof',
            'profeId' => $prof ? (int)$prof : null,
        ]);

    // ── LABS ─────────────────────────────────────────────────
    case 'labs':
        if ($method === 'GET') {
            ok($db->query('SELECT * FROM labs ORDER BY id')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $db->prepare('INSERT INTO labs(id,nombre,ocupado,capacidad,notas) VALUES(?,?,?,?,?)')
               ->execute([$b['id'], $b['nombre'], (int)($b['ocupado']??0), (int)($b['capacidad']??20), $b['notas']??'']);
            ok($db->query('SELECT * FROM labs WHERE id=' . $db->quote($b['id']))->fetch());
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $db->prepare('UPDATE labs SET nombre=?,ocupado=?,capacidad=?,notas=? WHERE id=?')
               ->execute([$b['nombre'], (int)($b['ocupado']??0), (int)($b['capacidad']??20), $b['notas']??'', $id]);
            ok($db->query('SELECT * FROM labs WHERE id=' . $db->quote($id))->fetch());
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM labs WHERE id=?')->execute([$id]);
            ok(['deleted' => $id]);
        }
        err('Not found', 404);

    // ── PROFESORES ───────────────────────────────────────────
    case 'profesores':
        if ($method === 'GET') {
            ok($db->query('SELECT id,apellido,nombre,orientacion,materia FROM profesores ORDER BY apellido')->fetchAll());
        }
        if ($method === 'POST') {
            $b = body();
            $db->prepare('INSERT INTO profesores(apellido,nombre,orientacion,materia) VALUES(?,?,?,?)')
               ->execute([$b['apellido'], $b['nombre'], $b['orientacion']??'bas', $b['materia']??'']);
            $newId = $db->lastInsertId();
            ok($db->query("SELECT * FROM profesores WHERE id=$newId")->fetch());
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $db->prepare('UPDATE profesores SET apellido=?,nombre=?,orientacion=?,materia=? WHERE id=?')
               ->execute([$b['apellido'], $b['nombre'], $b['orientacion']??'bas', $b['materia']??'', (int)$id]);
            ok($db->query("SELECT * FROM profesores WHERE id=" . (int)$id)->fetch());
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM profesores WHERE id=?')->execute([(int)$id]);
            ok(['deleted' => (int)$id]);
        }
        err('Not found', 404);

    // ── RESERVAS ─────────────────────────────────────────────
    case 'reservas':
        if ($method === 'GET') {
            $where = '1=1';
            if (isset($_GET['semanaOffset'])) $where .= ' AND semanaOffset=' . intval($_GET['semanaOffset']);
            if (isset($_GET['profeId']))      $where .= ' AND profeId=' . intval($_GET['profeId']);
            $rows = $db->query("SELECT * FROM reservas WHERE $where ORDER BY semanaOffset,dia,modulo")->fetchAll();
            // Cast integers
            $rows = array_map(fn($r) => array_map(fn($v) => is_numeric($v) && !str_contains((string)$v, '.') ? (int)$v : $v, $r), $rows);
            ok($rows);
        }
        if ($method === 'POST') {
            $b = body();
            $stmt = $db->prepare('INSERT INTO reservas(semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,renovaciones,anual) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([(int)($b['semanaOffset']??0),(int)$b['dia'],(int)$b['modulo'],$b['lab'],$b['curso'],$b['orient']??'bas',(int)$b['profeId'],$b['secuencia']??'',(int)($b['cicloClases']??1),(int)($b['renovaciones']??0),(int)($b['anual']??0)]);
            $newId = (int)$db->lastInsertId();
            $row = $db->query("SELECT * FROM reservas WHERE id=$newId")->fetch();
            ok(array_map(fn($v) => is_numeric($v) && !str_contains((string)$v,'.') ? (int)$v : $v, $row));
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            $db->prepare('UPDATE reservas SET semanaOffset=?,dia=?,modulo=?,lab=?,curso=?,orient=?,profeId=?,secuencia=?,cicloClases=?,renovaciones=?,anual=? WHERE id=?')
               ->execute([(int)($b['semanaOffset']??0),(int)$b['dia'],(int)$b['modulo'],$b['lab'],$b['curso'],$b['orient']??'bas',(int)$b['profeId'],$b['secuencia']??'',(int)($b['cicloClases']??1),(int)($b['renovaciones']??0),(int)($b['anual']??0),(int)$id]);
            $row = $db->query("SELECT * FROM reservas WHERE id=" . (int)$id)->fetch();
            ok(array_map(fn($v) => is_numeric($v) && !str_contains((string)$v,'.') ? (int)$v : $v, $row));
        }
        if ($method === 'DELETE' && $id) {
            if ($action === 'serie') {
                // Delete annual series
                $b = body();
                $db->prepare('DELETE FROM reservas WHERE lab=? AND dia=? AND profeId=? AND curso=? AND anual=1')
                   ->execute([$b['lab'], (int)$b['dia'], (int)$b['profeId'], $b['curso']]);
                ok(['deleted_series' => true]);
            }
            $db->prepare('DELETE FROM reservas WHERE id=?')->execute([(int)$id]);
            ok(['deleted' => (int)$id]);
        }
        err('Not found', 404);

    // ── SOLICITUDES ──────────────────────────────────────────
    case 'solicitudes':
        if ($method === 'GET') {
            $where = '1=1';
            if (isset($_GET['estado']))  $where .= ' AND estado=' . $db->quote($_GET['estado']);
            if (isset($_GET['profeId'])) $where .= ' AND profeId=' . intval($_GET['profeId']);
            $rows = $db->query("SELECT * FROM solicitudes WHERE $where ORDER BY id")->fetchAll();
            $rows = array_map(fn($r) => array_map(fn($v) => is_numeric($v) && !str_contains((string)$v,'.') ? (int)$v : $v, $r), $rows);
            ok($rows);
        }
        if ($method === 'POST') {
            $b = body();
            $stmt = $db->prepare('INSERT INTO solicitudes(semanaOffset,dia,modulo,lab,curso,orient,profeId,secuencia,cicloClases,estado,esRenovacion,reservaOriginalId,renovacionNum) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([(int)($b['semanaOffset']??0),(int)$b['dia'],(int)$b['modulo'],$b['lab'],$b['curso'],$b['orient']??'bas',(int)$b['profeId'],$b['secuencia']??'',(int)($b['cicloClases']??1),$b['estado']??'pendiente',(int)($b['esRenovacion']??0),isset($b['reservaOriginalId']) ? (int)$b['reservaOriginalId'] : null,(int)($b['renovacionNum']??0)]);
            $newId = (int)$db->lastInsertId();
            $row = $db->query("SELECT * FROM solicitudes WHERE id=$newId")->fetch();
            ok(array_map(fn($v) => is_numeric($v) && !str_contains((string)$v,'.') ? (int)$v : $v, $row));
        }
        if ($method === 'PUT' && $id) {
            $b = body();
            // Partial update support (for estado changes)
            $fields = []; $vals = [];
            foreach (['semanaOffset','dia','modulo','lab','curso','orient','profeId','secuencia','cicloClases','estado','esRenovacion','reservaOriginalId','renovacionNum'] as $f) {
                if (array_key_exists($f, $b)) { $fields[] = "$f=?"; $vals[] = $b[$f]; }
            }
            if ($fields) {
                $vals[] = (int)$id;
                $db->prepare('UPDATE solicitudes SET ' . implode(',', $fields) . ' WHERE id=?')->execute($vals);
            }
            $row = $db->query("SELECT * FROM solicitudes WHERE id=" . (int)$id)->fetch();
            ok(array_map(fn($v) => is_numeric($v) && !str_contains((string)$v,'.') ? (int)$v : $v, $row));
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM solicitudes WHERE id=?')->execute([(int)$id]);
            ok(['deleted' => (int)$id]);
        }
        err('Not found', 404);

    // ── LISTA ESPERA ─────────────────────────────────────────
    case 'espera':
        if ($method === 'GET') {
            $rows = $db->query('SELECT * FROM lista_espera ORDER BY id')->fetchAll();
            $rows = array_map(fn($r) => array_map(fn($v) => is_numeric($v) ? (int)$v : $v, $r), $rows);
            ok($rows);
        }
        if ($method === 'POST') {
            $b = body();
            $db->prepare('INSERT INTO lista_espera(profeId,lab,dia,modulo,semanaOffset) VALUES(?,?,?,?,?)')
               ->execute([(int)$b['profeId'], $b['lab'], (int)$b['dia'], (int)$b['modulo'], (int)($b['semanaOffset']??0)]);
            $newId = (int)$db->lastInsertId();
            ok(['id' => $newId] + $b);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM lista_espera WHERE id=?')->execute([(int)$id]);
            ok(['deleted' => (int)$id]);
        }
        err('Not found', 404);

    // ── PAUTAS ───────────────────────────────────────────────
    case 'pautas':
        if ($method === 'GET') {
            $rows = $db->query('SELECT * FROM pautas ORDER BY id')->fetchAll();
            ok(array_map(fn($r) => ['id' => (int)$r['id'], 'texto' => $r['texto']], $rows));
        }
        if ($method === 'POST') {
            $b = body();
            $db->prepare('INSERT INTO pautas(texto) VALUES(?)')->execute([$b['texto']]);
            ok(['id' => (int)$db->lastInsertId(), 'texto' => $b['texto']]);
        }
        if ($method === 'DELETE' && $id) {
            $db->prepare('DELETE FROM pautas WHERE id=?')->execute([(int)$id]);
            ok(['deleted' => (int)$id]);
        }
        err('Not found', 404);

    // ── ALL DATA (batch load) ─────────────────────────────────
    case 'all':
        if ($method !== 'GET') err('Method not allowed', 405);
        $castInts = fn($rows) => array_map(fn($r) => array_map(fn($v) => is_numeric($v) && !str_contains((string)$v,'.') ? (int)$v : $v, $r), $rows);
        ok([
            'labs'        => $db->query('SELECT * FROM labs ORDER BY id')->fetchAll(),
            'profesores'  => $db->query('SELECT id,apellido,nombre,orientacion,materia FROM profesores ORDER BY apellido')->fetchAll(),
            'reservas'    => $castInts($db->query('SELECT * FROM reservas ORDER BY semanaOffset,dia,modulo')->fetchAll()),
            'solicitudes' => $castInts($db->query('SELECT * FROM solicitudes ORDER BY id')->fetchAll()),
            'espera'      => $castInts($db->query('SELECT * FROM lista_espera ORDER BY id')->fetchAll()),
            'pautas'      => $castInts($db->query('SELECT * FROM pautas ORDER BY id')->fetchAll()),
        ]);

    default:
        err('Endpoint not found', 404);
}
