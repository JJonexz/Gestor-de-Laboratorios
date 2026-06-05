-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Versión del servidor:         8.4.3 - MySQL Community Server - GPL
-- SO del servidor:              Win64
-- HeidiSQL Versión:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Volcando estructura de base de datos para escuela
CREATE DATABASE IF NOT EXISTS `escuela` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `escuela`;

-- Volcando estructura para tabla escuela.alumnos
CREATE TABLE IF NOT EXISTS `alumnos` (
  `dni` int NOT NULL,
  `apellido` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `nombre` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `fechan` date DEFAULT NULL,
  `sexo` varchar(1) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT 'N',
  `id_localidades` int DEFAULT NULL,
  `domicilio` varchar(80) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `clave` varchar(40) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT '1234',
  PRIMARY KEY (`dni`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.archivos_visto
CREATE TABLE IF NOT EXISTS `archivos_visto` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_archivo` int NOT NULL,
  `id_asignacionesalumnos` int NOT NULL,
  `visto` tinyint NOT NULL,
  `tipo` varchar(1) NOT NULL,
  `fecha` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id archivo` (`id_archivo`),
  KEY `id asig` (`id_asignacionesalumnos`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.asignacionesalumnos
CREATE TABLE IF NOT EXISTS `asignacionesalumnos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_cursosciclolectivo` int NOT NULL,
  `dni_alumnos` int NOT NULL,
  `id_grupos` tinyint NOT NULL,
  `estado` varchar(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id_cursosciclolectivo` (`id_cursosciclolectivo`),
  KEY `dni_alumnos` (`dni_alumnos`),
  KEY `id grupos` (`id_grupos`)
) ENGINE=InnoDB AUTO_INCREMENT=19750 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.ciclosuperior
CREATE TABLE IF NOT EXISTS `ciclosuperior` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_cursos` tinyint NOT NULL,
  `id_orientaciones` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id del curso` (`id_cursos`),
  KEY `id orientacion` (`id_orientaciones`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.cupof
CREATE TABLE IF NOT EXISTS `cupof` (
  `cupof` int NOT NULL,
  `turno` varchar(1) NOT NULL,
  `hsmodcar` tinyint NOT NULL,
  `id_materias` int NOT NULL,
  `id_cursos` int NOT NULL,
  `estado` varchar(1) NOT NULL,
  `funcion` varchar(4) NOT NULL DEFAULT '0',
  `cargo` varchar(5) NOT NULL DEFAULT 'PF',
  `id_grupos` tinyint NOT NULL,
  PRIMARY KEY (`cupof`),
  KEY `id materias` (`id_materias`),
  KEY `id del curso` (`id_cursos`),
  KEY `id del grupo` (`id_grupos`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.cursos
CREATE TABLE IF NOT EXISTS `cursos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `division` varchar(1) NOT NULL,
  `ano` tinyint NOT NULL,
  `turno` varchar(1) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.cursosciclolectivo
CREATE TABLE IF NOT EXISTS `cursosciclolectivo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `estado` varchar(1) NOT NULL,
  `id_cursos` int NOT NULL,
  `ciclolectivo` year NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id cursos` (`id_cursos`)
) ENGINE=InnoDB AUTO_INCREMENT=525 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.email
CREATE TABLE IF NOT EXISTS `email` (
  `dni` int NOT NULL,
  `email` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`dni`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.gestor_espera
CREATE TABLE IF NOT EXISTS `gestor_espera` (
  `id` int NOT NULL AUTO_INCREMENT,
  `profeId` varchar(50) NOT NULL,
  `lab` varchar(10) NOT NULL,
  `dia` tinyint NOT NULL,
  `modulo` tinyint NOT NULL,
  `semanaOffset` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.gestor_pautas
CREATE TABLE IF NOT EXISTS `gestor_pautas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `texto` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.gestor_profesores
CREATE TABLE IF NOT EXISTS `gestor_profesores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `apellido` varchar(50) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `orientacion` varchar(50) NOT NULL DEFAULT 'bas',
  `materia` varchar(100) NOT NULL DEFAULT '',
  `dni_personal` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dni_personal` (`dni_personal`)
) ENGINE=InnoDB AUTO_INCREMENT=1133 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.gestor_reservas
CREATE TABLE IF NOT EXISTS `gestor_reservas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `semanaOffset` int NOT NULL DEFAULT '0',
  `dia` tinyint NOT NULL,
  `modulo` tinyint NOT NULL,
  `lab` varchar(10) NOT NULL,
  `curso` varchar(20) NOT NULL,
  `orient` varchar(50) NOT NULL DEFAULT 'bas',
  `profeId` varchar(50) NOT NULL,
  `secuencia` varchar(500) NOT NULL DEFAULT '',
  `cicloClases` tinyint NOT NULL DEFAULT '1',
  `renovaciones` tinyint NOT NULL DEFAULT '0',
  `anual` tinyint NOT NULL DEFAULT '0',
  `grupoId` int DEFAULT NULL,
  `cupofId` int DEFAULT NULL,
  `semanasReservadas` tinyint NOT NULL DEFAULT '1',
  `cooldownHasta` int DEFAULT NULL COMMENT 'semanaOffset hasta la que el slot está bloqueado (exclusive)',
  PRIMARY KEY (`id`),
  KEY `idx_slot` (`lab`,`dia`,`modulo`,`semanaOffset`),
  KEY `idx_profe` (`profeId`)
) ENGINE=InnoDB AUTO_INCREMENT=157 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.gestor_solicitudes
CREATE TABLE IF NOT EXISTS `gestor_solicitudes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `semanaOffset` int NOT NULL DEFAULT '0',
  `dia` tinyint NOT NULL,
  `modulo` tinyint NOT NULL,
  `lab` varchar(10) NOT NULL,
  `curso` varchar(20) NOT NULL,
  `orient` varchar(50) NOT NULL DEFAULT 'bas',
  `profeId` varchar(50) NOT NULL,
  `secuencia` varchar(500) NOT NULL DEFAULT '',
  `cicloClases` tinyint NOT NULL DEFAULT '1',
  `estado` varchar(20) NOT NULL DEFAULT 'pendiente',
  `esRenovacion` tinyint NOT NULL DEFAULT '0',
  `reservaOriginalId` int DEFAULT NULL,
  `renovacionNum` tinyint NOT NULL DEFAULT '0',
  `grupoId` int DEFAULT NULL,
  `cupofId` int DEFAULT NULL,
  `semanasReservadas` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_estado` (`estado`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.grupos
CREATE TABLE IF NOT EXISTS `grupos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` int NOT NULL,
  `id_cursos` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id cursos` (`id_cursos`)
) ENGINE=InnoDB AUTO_INCREMENT=86 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.horarios
CREATE TABLE IF NOT EXISTS `horarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dia` varchar(3) NOT NULL,
  `id_horas` tinyint NOT NULL,
  `id_salones` tinyint NOT NULL,
  `cupof` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2229 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.horas
CREATE TABLE IF NOT EXISTS `horas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(15) NOT NULL,
  `turno` varchar(1) NOT NULL,
  `hd` time NOT NULL,
  `hh` time NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.inasistenciasalumnos
CREATE TABLE IF NOT EXISTS `inasistenciasalumnos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_asignacionesalumnos` int NOT NULL,
  `fecha` date NOT NULL,
  `turno` varchar(1) NOT NULL,
  `estado` varchar(1) NOT NULL,
  `justificado` varchar(1) NOT NULL,
  `dni_personal` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id_asignacionesalumnos` (`id_asignacionesalumnos`),
  KEY `id_asignacionesalumnos_2` (`id_asignacionesalumnos`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.informe_periodo
CREATE TABLE IF NOT EXISTS `informe_periodo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_asignacionesalumnos` int NOT NULL,
  `cupof` int NOT NULL,
  `dni_personal` int NOT NULL,
  `devolucion` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `nota` varchar(4) COLLATE utf8mb4_unicode_ci NOT NULL,
  `periodo` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.informe_visto
CREATE TABLE IF NOT EXISTS `informe_visto` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_asignacionesalumnos` int NOT NULL,
  `dni_padre` int NOT NULL,
  `fecha` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.localidades
CREATE TABLE IF NOT EXISTS `localidades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `localidad` varchar(120) NOT NULL,
  `cp` mediumint NOT NULL,
  `id_provincias` varchar(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6437 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.materias
CREATE TABLE IF NOT EXISTS `materias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(70) NOT NULL,
  `abreviatura` varchar(15) NOT NULL,
  `estado` varchar(1) NOT NULL DEFAULT 'H',
  `resumen` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=131 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.orientaciones
CREATE TABLE IF NOT EXISTS `orientaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(30) NOT NULL,
  `titulo` varchar(80) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.padresalumnos
CREATE TABLE IF NOT EXISTS `padresalumnos` (
  `dni_alumnos` int NOT NULL,
  `dni_padrestutores` int NOT NULL,
  `id_parentesco` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.padrestutores
CREATE TABLE IF NOT EXISTS `padrestutores` (
  `dni` int NOT NULL,
  `ocupacion` varchar(50) NOT NULL,
  `sexo` varchar(1) NOT NULL,
  `fechan` date NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `apellido` varchar(50) NOT NULL,
  `domicilio` varchar(80) NOT NULL,
  `id_localidades` int NOT NULL,
  `telefono` varchar(50) NOT NULL,
  `contrasena` varchar(40) NOT NULL DEFAULT '1234',
  PRIMARY KEY (`dni`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.parentesco
CREATE TABLE IF NOT EXISTS `parentesco` (
  `id` tinyint NOT NULL AUTO_INCREMENT,
  `parentesco` varchar(30) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.pautas
CREATE TABLE IF NOT EXISTS `pautas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `texto` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.personal
CREATE TABLE IF NOT EXISTS `personal` (
  `dni` int NOT NULL,
  `apellido` varchar(50) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `tipo_doc` varchar(3) NOT NULL,
  `sexo` varchar(1) NOT NULL,
  `domicilio` varchar(80) NOT NULL,
  `cp` mediumint NOT NULL,
  `fechan` date NOT NULL,
  `email` varchar(100) NOT NULL,
  `pass` varchar(40) NOT NULL DEFAULT '1234',
  `id_localidades` int NOT NULL,
  `tag` varchar(100) NOT NULL,
  PRIMARY KEY (`dni`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.revista
CREATE TABLE IF NOT EXISTS `revista` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cupof` int NOT NULL,
  `fd` date NOT NULL,
  `fh` date NOT NULL,
  `dni_personal` int NOT NULL,
  `secuencia` int NOT NULL,
  `situacion` varchar(30) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id cupof` (`cupof`),
  KEY `dni personal` (`dni_personal`)
) ENGINE=InnoDB AUTO_INCREMENT=2768 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.salones
CREATE TABLE IF NOT EXISTS `salones` (
  `id_salones` int NOT NULL AUTO_INCREMENT,
  `piso` tinyint NOT NULL,
  `numero` tinyint NOT NULL,
  `tipo` varchar(50) NOT NULL,
  `capacidad` int NOT NULL,
  `corriente` varchar(50) NOT NULL,
  `televisor` varchar(50) NOT NULL,
  `pizarron` varchar(50) NOT NULL,
  `ubicacion` varchar(50) NOT NULL,
  PRIMARY KEY (`id_salones`)
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.tareas
CREATE TABLE IF NOT EXISTS `tareas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titulo` varchar(150) NOT NULL,
  `descripcion` mediumtext NOT NULL,
  `tamanio` int NOT NULL,
  `nombre_archivo` varchar(255) NOT NULL,
  `tipo` varchar(150) NOT NULL,
  `fecha_subida` date NOT NULL,
  `fecha_entrega` date NOT NULL,
  `id_revista` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `id revista` (`id_revista`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.tareas_alumnos
CREATE TABLE IF NOT EXISTS `tareas_alumnos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_tarea` int NOT NULL,
  `id_asignacionesalumnos` int NOT NULL,
  `fecha` date NOT NULL,
  `nombre_archivo` varchar(150) NOT NULL,
  `borrado_fisico` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `id tarea` (`id_tarea`),
  KEY `id asig` (`id_asignacionesalumnos`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.tbl_documentos
CREATE TABLE IF NOT EXISTS `tbl_documentos` (
  `id_documento` int unsigned NOT NULL AUTO_INCREMENT,
  `titulo` varchar(150) DEFAULT NULL,
  `descripcion` mediumtext,
  `tamanio` int unsigned DEFAULT NULL,
  `tipo` varchar(150) DEFAULT NULL,
  `nombre_archivo` varchar(255) DEFAULT NULL,
  `fecha_subida` datetime NOT NULL,
  `cupof` int NOT NULL,
  PRIMARY KEY (`id_documento`),
  KEY `id cupof` (`cupof`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla escuela.telefono
CREATE TABLE IF NOT EXISTS `telefono` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dni` int NOT NULL,
  `telefono` varchar(25) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- La exportación de datos fue deseleccionada.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
