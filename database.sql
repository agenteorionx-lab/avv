-- ============================================================
--  Sistema Oficial AVV — Schema MySQL (phpMyAdmin / VPS Contabo)
--  Criação do banco avv_db e todas as tabelas relacionais
-- ============================================================

CREATE DATABASE IF NOT EXISTS avv_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE avv_db;

-- ------------------------------------------------------------
-- 1. Tabela: usuarios_adm
-- Administradores e Diretoria Técnica da AVV
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_adm (
  id              INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario         VARCHAR(120)   NOT NULL DEFAULT 'Administrador Geral',
  email           VARCHAR(150)   NOT NULL UNIQUE,
  setor           VARCHAR(120)   NOT NULL DEFAULT 'Diretoria Técnica AVV',
  senha_hash      VARCHAR(255)   NOT NULL,
  foto            LONGTEXT                DEFAULT NULL,
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. Tabela: campeonatos
-- Competições oficiais criadas e geridas pelo Painel ADM
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campeonatos (
  id                  VARCHAR(80)    NOT NULL PRIMARY KEY,
  nome                VARCHAR(255)   NOT NULL,
  modalidade          VARCHAR(120)   NOT NULL DEFAULT 'Vôlei de Quadra Adulto Oficial',
  fase                VARCHAR(120)   NOT NULL DEFAULT 'Inscrições Abertas',
  taxa                VARCHAR(100)   NOT NULL DEFAULT 'Isento / Filiação Ativa',
  limite_atletas      INT            NOT NULL DEFAULT 12,
  status              VARCHAR(40)    NOT NULL DEFAULT 'Ativo',
  descricao           TEXT                    DEFAULT NULL,
  categorias_aceitas  JSON                    DEFAULT NULL,
  regulamento         LONGTEXT                DEFAULT NULL,
  created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. Tabela: equipes
-- Agremiações / Clubes cadastrados no formulário ou painel
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipes (
  id                  VARCHAR(80)    NOT NULL PRIMARY KEY,
  numero_inscricao    VARCHAR(30)    NOT NULL,
  protocolo           VARCHAR(50)    NOT NULL,
  data_inscricao      VARCHAR(20)    NOT NULL DEFAULT '',
  hora_inscricao      VARCHAR(20)    NOT NULL DEFAULT '',
  data_hora_completa  VARCHAR(50)    NOT NULL DEFAULT '',
  estado              VARCHAR(40)    NOT NULL DEFAULT 'RO',
  cidade              VARCHAR(100)   NOT NULL DEFAULT 'Vilhena',
  nome_time           VARCHAR(200)   NOT NULL,
  responsavel_nome    VARCHAR(150)   NOT NULL DEFAULT '',
  email               VARCHAR(150)   NOT NULL UNIQUE,
  whatsapp            VARCHAR(40)    NOT NULL DEFAULT '',
  instagram           VARCHAR(100)   NOT NULL DEFAULT '',
  senha_hash          VARCHAR(255)   NOT NULL,
  status              VARCHAR(40)    NOT NULL DEFAULT 'Pendente',
  logo                LONGTEXT                DEFAULT NULL,
  categoria           VARCHAR(80)    NOT NULL DEFAULT 'Adulto Masculino',
  categorias          JSON                    DEFAULT NULL,
  campeonato_id       VARCHAR(80)    NOT NULL DEFAULT '',
  campeonato_nome     VARCHAR(255)   NOT NULL DEFAULT 'Aguardando Seleção no Painel',
  dados_extras        JSON                    DEFAULT NULL,
  created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_nome_time (nome_time(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. Tabela: atletas
-- Elenco vinculado a cada equipe
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atletas (
  id                  INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
  equipe_id           VARCHAR(80)    NOT NULL,
  inscricao           VARCHAR(50)    NOT NULL DEFAULT '',
  nome                VARCHAR(200)   NOT NULL,
  cpf_rg              VARCHAR(50)    NOT NULL DEFAULT '',
  nascimento          VARCHAR(30)    NOT NULL DEFAULT '',
  genero              VARCHAR(30)    NOT NULL DEFAULT '',
  posicao             VARCHAR(60)    NOT NULL DEFAULT '',
  camisa              VARCHAR(15)    NOT NULL DEFAULT '',
  whatsapp            VARCHAR(40)    NOT NULL DEFAULT '',
  foto                LONGTEXT                DEFAULT NULL,
  dados_json          JSON                    DEFAULT NULL,
  created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_equipe_id (equipe_id),
  CONSTRAINT fk_atletas_equipe FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. Tabela: comissao_tecnica
-- Técnicos, auxiliares e dirigentes vinculados a cada equipe
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comissao_tecnica (
  id                  INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
  equipe_id           VARCHAR(80)    NOT NULL,
  inscricao           VARCHAR(50)    NOT NULL DEFAULT '',
  nome                VARCHAR(200)   NOT NULL,
  funcao              VARCHAR(80)    NOT NULL DEFAULT 'Técnico Principal',
  cpf_cref            VARCHAR(60)    NOT NULL DEFAULT '',
  nascimento          VARCHAR(30)    NOT NULL DEFAULT '',
  genero              VARCHAR(30)    NOT NULL DEFAULT '',
  whatsapp            VARCHAR(40)    NOT NULL DEFAULT '',
  foto                LONGTEXT                DEFAULT NULL,
  dados_json          JSON                    DEFAULT NULL,
  created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_equipe_id (equipe_id),
  CONSTRAINT fk_comissao_equipe FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

