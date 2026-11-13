// db.js — Conexão MySQL Oficial (com Túnel SSH Local Automático) + Criação de Tabelas da AVV
require('dotenv').config();
const mysql = require('mysql2/promise');
const net = require('net');
const { Client } = require('ssh2');

const dbConfig = {
    host: process.env.DB_HOST || '147.93.179.208',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'orionx_db',
    password: process.env.DB_PASSWORD || '@_sist.orion2904',
    database: process.env.DB_NAME || 'avv_db',
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000,
    charset: 'utf8mb4'
};

let pool = null;
let isConnected = false;
let syncEmAndamento = false;
let proximoEstadoPendente = null;

async function iniciarTunelSshSeNecessario() {
    // Conexão direta ativa na porta 3306 (VPS 147.93.179.208 ou host.docker.internal)
    return false;
}

async function criarTabelasMySQL() {
    const queries = [
        // 1. Tabela: usuarios_adm
        `CREATE TABLE IF NOT EXISTS usuarios_adm (
            id              INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
            usuario         VARCHAR(120)   NOT NULL DEFAULT 'Administrador Geral',
            email           VARCHAR(150)   NOT NULL UNIQUE,
            setor           VARCHAR(120)   NOT NULL DEFAULT 'Diretoria Técnica AVV',
            senha_hash      VARCHAR(255)   NOT NULL,
            foto            LONGTEXT                DEFAULT NULL,
            created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 2. Tabela: campeonatos
        `CREATE TABLE IF NOT EXISTS campeonatos (
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
            dados_extras        LONGTEXT                DEFAULT NULL,
            created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 3. Tabela: equipes
        `CREATE TABLE IF NOT EXISTS equipes (
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
            email               VARCHAR(150)   NOT NULL,
            whatsapp            VARCHAR(40)    NOT NULL DEFAULT '',
            instagram           VARCHAR(100)   NOT NULL DEFAULT '',
            senha_hash          VARCHAR(255)   NOT NULL,
            status              VARCHAR(40)    NOT NULL DEFAULT 'Pendente',
            logo                LONGTEXT                DEFAULT NULL,
            categoria           VARCHAR(80)    NOT NULL DEFAULT 'Adulto Masculino',
            categorias          JSON                    DEFAULT NULL,
            campeonato_id       VARCHAR(80)    NOT NULL DEFAULT '',
            campeonato_nome     VARCHAR(255)   NOT NULL DEFAULT 'Aguardando Seleção no Painel',
            dados_extras        LONGTEXT                DEFAULT NULL,
            created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_status (status),
            INDEX idx_nome_time (nome_time(100))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 4. Tabela: atletas
        `CREATE TABLE IF NOT EXISTS atletas (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

        // 5. Tabela: comissao_tecnica
        `CREATE TABLE IF NOT EXISTS comissao_tecnica (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    ];

    for (const q of queries) {
        await pool.query(q);
    }
    // Remove índice UNIQUE antigo em equipes.email (pois um mesmo e-mail de clube pode ter conta + múltiplas equipes)
    try { await pool.query('ALTER TABLE equipes DROP INDEX email'); } catch (e) {}
    try { await pool.query('ALTER TABLE campeonatos ADD COLUMN dados_extras LONGTEXT DEFAULT NULL'); } catch (e) {}
    try { await pool.query('ALTER TABLE equipes MODIFY COLUMN dados_extras LONGTEXT DEFAULT NULL'); } catch (e) {}
    console.log('✅ Tabelas MySQL verificadas/criadas com sucesso: [usuarios_adm, campeonatos, equipes, atletas, comissao_tecnica]');
}

async function initDb() {
    const hostsParaTestar = Array.from(new Set([
        process.env.DB_HOST,
        '147.93.179.208',
        'host.docker.internal',
        '172.17.0.1'
    ].filter(Boolean)));

    let ultimoErro = null;

    for (const hostCandidato of hostsParaTestar) {
        try {
            dbConfig.host = hostCandidato;
            const tempConfig = { ...dbConfig, connectTimeout: 5000 };
            delete tempConfig.database;

            const conn = await mysql.createConnection(tempConfig);
            await conn.query(
                `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
            );
            await conn.end();
            console.log(`✅ Banco de dados MySQL "${dbConfig.database}" verificado/criado em ${hostCandidato}.`);

            pool = mysql.createPool({ ...dbConfig, connectTimeout: 5000 });
            await criarTabelasMySQL();
            isConnected = true;
            return true;
        } catch (err) {
            ultimoErro = err;
        }
    }

    isConnected = false;
    console.warn(`⚠️ MySQL indisponível (${ultimoErro ? ultimoErro.message : 'sem conexão'}). Operando com banco local (data/avv_database.json).`);
    return false;
}

async function sincronizarEstadoParaMySQL(dbState) {
    if (!isConnected || !pool || !dbState) return;

    // Fila serializada para evitar race conditions e colisões de DELETE/INSERT simultâneos no MySQL
    if (syncEmAndamento) {
        proximoEstadoPendente = dbState;
        return;
    }

    syncEmAndamento = true;
    let estadoAtual = dbState;

    while (estadoAtual) {
        proximoEstadoPendente = null;
        await executarSincronizacaoMySQLInterna(estadoAtual);
        estadoAtual = proximoEstadoPendente;
    }

    syncEmAndamento = false;
}

async function executarSincronizacaoMySQLInterna(dbState) {
    if (!isConnected || !pool || !dbState) return;
    try {
        // 1. Sincroniza Administrador
        if (dbState.adm && dbState.adm.email) {
            await pool.query(
                `INSERT INTO usuarios_adm (usuario, email, setor, senha_hash, foto)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    usuario = VALUES(usuario),
                    setor = VALUES(setor),
                    senha_hash = VALUES(senha_hash),
                    foto = VALUES(foto)`,
                [
                    dbState.adm.usuario || 'Administrador Geral',
                    dbState.adm.email,
                    dbState.adm.setor || 'Diretoria Técnica AVV',
                    dbState.adm.senhaHash || '',
                    dbState.adm.foto || null
                ]
            );
        }

        // 2. Sincroniza Campeonatos
        const campsObj = dbState.campeonatos || {};
        const campIds = Object.keys(campsObj);
        if (campIds.length === 0) {
            await pool.query('DELETE FROM campeonatos');
        } else {
            await pool.query('DELETE FROM campeonatos WHERE id NOT IN (?)', [campIds]);
            for (const cId of campIds) {
                const c = campsObj[cId];
                await pool.query(
                    `INSERT INTO campeonatos (id, nome, modalidade, fase, taxa, limite_atletas, status, descricao, categorias_aceitas, regulamento, dados_extras)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        nome = VALUES(nome),
                        modalidade = VALUES(modalidade),
                        fase = VALUES(fase),
                        taxa = VALUES(taxa),
                        limite_atletas = VALUES(limite_atletas),
                        status = VALUES(status),
                        descricao = VALUES(descricao),
                        categorias_aceitas = VALUES(categorias_aceitas),
                        regulamento = VALUES(regulamento),
                        dados_extras = VALUES(dados_extras)`,
                    [
                        String(c.id || cId),
                        c.nome || '',
                        c.modalidade || 'Vôlei de Quadra Adulto Oficial',
                        c.fase || 'Inscrições Abertas',
                        c.taxa || 'Isento / Filiação Ativa',
                        parseInt(c.limiteAtletas || 12, 10),
                        c.status || 'Ativo',
                        c.descricao || '',
                        JSON.stringify(Array.isArray(c.categoriasAceitas) ? c.categoriasAceitas : []),
                        c.regulamento || '',
                        JSON.stringify(c)
                    ]
                );
            }
        }

        // 3. Sincroniza Equipes, Atletas e Comissão Técnica
        const equipesArr = Array.isArray(dbState.equipes) ? dbState.equipes : [];
        const eqIds = equipesArr.map(e => String(e.id));

        if (eqIds.length === 0) {
            await pool.query('DELETE FROM equipes');
        } else {
            await pool.query('DELETE FROM equipes WHERE id NOT IN (?)', [eqIds]);
        }

        for (const eq of equipesArr) {
            const eqId = String(eq.id);
            const copiaExtras = { ...eq };
            delete copiaExtras.atletas;
            delete copiaExtras.comissao;
            await pool.query(
                `INSERT INTO equipes (
                    id, numero_inscricao, protocolo, data_inscricao, hora_inscricao, data_hora_completa,
                    estado, cidade, nome_time, responsavel_nome, email, whatsapp, instagram,
                    senha_hash, status, logo, categoria, categorias, campeonato_id, campeonato_nome, dados_extras
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    numero_inscricao = VALUES(numero_inscricao),
                    protocolo = VALUES(protocolo),
                    estado = VALUES(estado),
                    cidade = VALUES(cidade),
                    nome_time = VALUES(nome_time),
                    responsavel_nome = VALUES(responsavel_nome),
                    email = VALUES(email),
                    whatsapp = VALUES(whatsapp),
                    instagram = VALUES(instagram),
                    senha_hash = VALUES(senha_hash),
                    status = VALUES(status),
                    logo = VALUES(logo),
                    categoria = VALUES(categoria),
                    categorias = VALUES(categorias),
                    campeonato_id = VALUES(campeonato_id),
                    campeonato_nome = VALUES(campeonato_nome),
                    dados_extras = VALUES(dados_extras)`,
                [
                    eqId,
                    String(eq.numeroInscricao || ''),
                    String(eq.protocolo || ''),
                    String(eq.dataInscricao || ''),
                    String(eq.horaInscricao || ''),
                    String(eq.dataHoraCompleta || ''),
                    String(eq.estado || 'RO'),
                    String(eq.cidade || 'Vilhena'),
                    String(eq.nomeTime || ''),
                    String(eq.responsavelNome || ''),
                    String(eq.email || '').toLowerCase(),
                    String(eq.whatsapp || ''),
                    String(eq.instagram || ''),
                    String(eq.senhaHash || ''),
                    String(eq.status || 'Pendente'),
                    eq.logo || 'logos/logo_avv.png',
                    String(eq.categoria || 'Adulto Masculino'),
                    JSON.stringify(Array.isArray(eq.categorias) ? eq.categorias : [eq.categoria || 'Adulto Masculino']),
                    String(eq.campeonatoId || ''),
                    String(eq.campeonatoNome || 'Aguardando Seleção no Painel'),
                    JSON.stringify(copiaExtras)
                ]
            );

            // Atualiza Atletas da Equipe
            await pool.query('DELETE FROM atletas WHERE equipe_id = ?', [eqId]);
            const listaAtletas = Array.isArray(eq.atletas) ? eq.atletas : (Array.isArray(eq.elenco) ? eq.elenco : []);
            for (const atl of listaAtletas) {
                await pool.query(
                    `INSERT INTO atletas (equipe_id, inscricao, nome, cpf_rg, nascimento, genero, posicao, camisa, whatsapp, foto, dados_json)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        eqId,
                        String(atl.inscricao || atl.id || ''),
                        String(atl.nome || ''),
                        String(atl.cpf || atl.doc || ''),
                        String(atl.nascimento || atl.nasc || ''),
                        String(atl.genero || ''),
                        String(atl.posicao || atl.pos || ''),
                        String(atl.camisa || atl.num || ''),
                        String(atl.whats || atl.whatsapp || ''),
                        atl.foto || null,
                        JSON.stringify(atl)
                    ]
                );
            }

            // Atualiza Comissão Técnica da Equipe
            await pool.query('DELETE FROM comissao_tecnica WHERE equipe_id = ?', [eqId]);
            const listaComissao = Array.isArray(eq.comissao) ? eq.comissao : [];
            for (const tec of listaComissao) {
                await pool.query(
                    `INSERT INTO comissao_tecnica (equipe_id, inscricao, nome, funcao, cpf_cref, nascimento, genero, whatsapp, foto, dados_json)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        eqId,
                        String(tec.inscricao || tec.id || ''),
                        String(tec.nome || ''),
                        String(tec.funcao || 'Técnico Principal'),
                        String(tec.cpf || tec.doc || ''),
                        String(tec.nascimento || tec.nasc || ''),
                        String(tec.genero || ''),
                        String(tec.whats || tec.whatsapp || ''),
                        tec.foto || null,
                        JSON.stringify(tec)
                    ]
                );
            }
        }
    } catch (err) {
        console.error('Erro ao sincronizar estado com MySQL:', err.message);
        // Se foi queda temporária de socket (ECONNRESET / PROTOCOL_CONNECTION_LOST), tenta mais uma vez com nova conexão do pool
        if (err && (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'EPIPE')) {
            try {
                await new Promise(r => setTimeout(r, 400));
                await pool.query('SELECT 1');
            } catch (retryErr) {}
        }
    }
}

async function carregarEstadoDoMySQL() {
    if (!isConnected || !pool) return null;
    try {
        const [admRows] = await pool.query('SELECT * FROM usuarios_adm ORDER BY id ASC LIMIT 1');
        const [campRows] = await pool.query('SELECT * FROM campeonatos ORDER BY created_at DESC');
        const [eqRows] = await pool.query('SELECT * FROM equipes ORDER BY created_at DESC');
        const [atlRows] = await pool.query('SELECT * FROM atletas ORDER BY id ASC');
        const [comRows] = await pool.query('SELECT * FROM comissao_tecnica ORDER BY id ASC');

        const campeonatos = {};
        for (const c of campRows) {
            let cats = ['Adulto Masculino'];
            try {
                cats = typeof c.categorias_aceitas === 'string' ? JSON.parse(c.categorias_aceitas) : (c.categorias_aceitas || cats);
            } catch (e) {}
            let extras = {};
            if (c.dados_extras) {
                try {
                    extras = typeof c.dados_extras === 'string' ? JSON.parse(c.dados_extras) : c.dados_extras;
                } catch (e) {}
            }
            campeonatos[c.id] = {
                ...extras,
                id: c.id,
                nome: c.nome,
                modalidade: c.modalidade,
                fase: c.fase,
                taxa: c.taxa,
                limiteAtletas: c.limite_atletas,
                status: c.status,
                descricao: c.descricao,
                categoriasAceitas: cats,
                regulamento: c.regulamento
            };
        }

        const equipes = eqRows.map(e => {
            let cats = [e.categoria || 'Adulto Masculino'];
            try {
                cats = typeof e.categorias === 'string' ? JSON.parse(e.categorias) : (e.categorias || cats);
            } catch (err) {}

            const atletas = atlRows
                .filter(a => String(a.equipe_id) === String(e.id))
                .map(a => {
                    if (a.dados_json) {
                        try { return typeof a.dados_json === 'string' ? JSON.parse(a.dados_json) : a.dados_json; } catch (err) {}
                    }
                    return {
                        inscricao: a.inscricao,
                        nome: a.nome,
                        cpf: a.cpf_rg,
                        nascimento: a.nascimento,
                        genero: a.genero,
                        posicao: a.posicao,
                        camisa: a.camisa,
                        whats: a.whatsapp,
                        foto: a.foto
                    };
                });

            const comissao = comRows
                .filter(t => String(t.equipe_id) === String(e.id))
                .map(t => {
                    if (t.dados_json) {
                        try { return typeof t.dados_json === 'string' ? JSON.parse(t.dados_json) : t.dados_json; } catch (err) {}
                    }
                    return {
                        inscricao: t.inscricao,
                        nome: t.nome,
                        funcao: t.funcao,
                        cpf: t.cpf_cref,
                        nascimento: t.nascimento,
                        genero: t.genero,
                        whats: t.whatsapp,
                        foto: t.foto
                    };
                });

            let extrasEq = {};
            if (e.dados_extras) {
                try {
                    extrasEq = typeof e.dados_extras === 'string' ? JSON.parse(e.dados_extras) : e.dados_extras;
                } catch (err) {}
            }

            return {
                ...extrasEq,
                id: e.id,
                numeroInscricao: e.numero_inscricao,
                protocolo: e.protocolo,
                dataInscricao: e.data_inscricao,
                horaInscricao: e.hora_inscricao,
                dataHoraCompleta: e.data_hora_completa,
                estado: e.estado,
                cidade: e.cidade,
                nomeTime: e.nome_time,
                responsavelNome: e.responsavel_nome,
                email: e.email,
                whatsapp: e.whatsapp,
                instagram: e.instagram,
                senhaHash: e.senha_hash,
                status: e.status,
                logo: e.logo,
                categoria: e.categoria,
                categorias: cats,
                campeonatoId: e.campeonato_id,
                campeonatoNome: e.campeonato_nome,
                atletas,
                comissao
            };
        });

        const adm = admRows.length > 0 ? {
            usuario: admRows[0].usuario,
            email: admRows[0].email,
            setor: admRows[0].setor,
            senhaHash: admRows[0].senha_hash,
            foto: admRows[0].foto
        } : null;

        return { equipes, campeonatos, adm };
    } catch (err) {
        console.error('Erro ao carregar dados do MySQL:', err.message);
        return null;
    }
}

module.exports = {
    initDb,
    sincronizarEstadoParaMySQL,
    carregarEstadoDoMySQL,
    getPool: () => pool,
    isMySQLConnected: () => isConnected
};
