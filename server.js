const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();
const { initDb, sincronizarEstadoParaMySQL, carregarEstadoDoMySQL } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. SEGURANÇA & MIDDLEWARES GLOBAIS
// ============================================================================
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Cabeçalhos de segurança HTTP e bloqueio de acesso direto ao arquivo .env / data
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const urlLower = req.path.toLowerCase();
    if (
        urlLower.includes('.env') ||
        urlLower.includes('avv_database.json') ||
        urlLower.startsWith('/data/') ||
        urlLower.startsWith('/avv/data/')
    ) {
        return res.status(403).json({ ok: false, mensagem: 'Acesso restrito.' });
    }
    next();
});

// Cache inteligente para estáticos: 1 dia para imagens, css e js
const staticOpts = {
    maxAge: '1d',
    etag: true
};

// Serve os arquivos estáticos da AVV tanto na raiz (/) quanto em (/avv)
app.use(express.static(__dirname, staticOpts));
app.use('/avv', express.static(__dirname, staticOpts));

// ============================================================================
// 2. BANCO DE DADOS OFICIAL PERSISTENTE (ARQUIVO JSON SEGURO E ATÔMICO)
// ============================================================================
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'avv_database.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashSenhaSegura(senha) {
    if (!senha) return '';
    // Se já estiver em formato hash sha256 prefixado, retorna como está
    if (String(senha).startsWith('sha256:')) return String(senha);
    return 'sha256:' + crypto.createHash('sha256').update(String(senha) + '_avv_salt_2026').digest('hex');
}

function verificarSenhaSegura(senhaDigitada, senhaArmazenada) {
    if (!senhaArmazenada) return false;
    if (String(senhaArmazenada).startsWith('sha256:')) {
        return hashSenhaSegura(senhaDigitada) === senhaArmazenada;
    }
    // Compatibilidade retroativa com senhas antigas em texto puro
    return String(senhaDigitada) === String(senhaArmazenada);
}

function sanitizarTexto(valor, maxLen = 250) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>]/g, '')
        .trim()
        .substring(0, maxLen);
}

function carregarBancoDados() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            return {
                equipes: Array.isArray(parsed.equipes) ? parsed.equipes : [],
                campeonatos: parsed.campeonatos && typeof parsed.campeonatos === 'object' ? parsed.campeonatos : {},
                adm: parsed.adm || {
                    usuario: 'Administrador Geral',
                    email: process.env.ADM_DEFAULT_EMAIL || 'avvvoleibol@gmail.com',
                    setor: 'Diretoria Técnica AVV',
                    senhaHash: hashSenhaSegura(process.env.ADM_DEFAULT_PASS || '@Avv_23#')
                }
            };
        }
    } catch (err) {
        console.error('Aviso ao ler banco de dados local, iniciando estrutura limpa:', err.message);
    }

    const dbInicial = {
        equipes: [],
        campeonatos: {},
        adm: {
            usuario: 'Administrador Geral',
            email: process.env.ADM_DEFAULT_EMAIL || 'avvvoleibol@gmail.com',
            setor: 'Diretoria Técnica AVV',
            senhaHash: hashSenhaSegura(process.env.ADM_DEFAULT_PASS || '@Avv_23#')
        }
    };
    salvarBancoDados(dbInicial);
    return dbInicial;
}

let escritaEmAndamento = false;
function salvarBancoDados(dados, sincronizarMySQL = true) {
    try {
        const tempFile = DB_FILE + '.tmp';
        fs.writeFileSync(tempFile, JSON.stringify(dados, null, 2), 'utf-8');
        fs.renameSync(tempFile, DB_FILE);
        if (sincronizarMySQL) {
            sincronizarEstadoParaMySQL(dados).catch(err => console.error('Aviso sync MySQL:', err.message));
        }
        return true;
    } catch (err) {
        console.error('Erro ao gravar no banco de dados:', err);
        return false;
    }
}

// Remove hashes de senha ao enviar dados públicos para o front-end
function limparEquipeParaCliente(eq) {
    if (!eq) return null;
    const copia = { ...eq };
    delete copia.senhaHash;
    return copia;
}

// ============================================================================
// 3. CONTROLE ANTI-DUPLICIDADE E RATE LIMITING (IDEMPOTÊNCIA DE REQUISIÇÕES)
// ============================================================================
const TOKENS_RECUPERACAO = new Map();
const COOLDOWN_EMAIL = new Map();
const LOCK_REQUISICOES = new Map(); // chave -> timestamp de liberação

function verificarBloqueioDuplicidade(chave, tempoMs = 2500) {
    const agora = Date.now();
    const expira = LOCK_REQUISICOES.get(chave);
    if (expira && agora < expira) {
        return true; // Requisição duplicada bloqueada
    }
    LOCK_REQUISICOES.set(chave, agora + tempoMs);
    return false;
}

// Limpeza automática de memória a cada 5 minutos
setInterval(() => {
    const agora = Date.now();
    for (const [token, dados] of TOKENS_RECUPERACAO.entries()) {
        if (agora > dados.expiraEm) TOKENS_RECUPERACAO.delete(token);
    }
    for (const [email, expira] of COOLDOWN_EMAIL.entries()) {
        if (agora > expira) COOLDOWN_EMAIL.delete(email);
    }
    for (const [chave, expira] of LOCK_REQUISICOES.entries()) {
        if (agora > expira) LOCK_REQUISICOES.delete(chave);
    }
}, 5 * 60 * 1000).unref();

// ============================================================================
// 4. ROTAS DA API DO BANCO DE DADOS E AUTENTICAÇÃO OFICIAL
// ============================================================================

// 4.1. Sincronização completa (usada pelos painéis ao carregar)
app.get(['/api/dados-sistema', '/avv/api/dados-sistema'], (req, res) => {
    const db = carregarBancoDados();
    res.json({
        ok: true,
        equipes: db.equipes.map(limparEquipeParaCliente),
        campeonatos: db.campeonatos,
        adm: {
            usuario: db.adm.usuario,
            email: db.adm.email,
            setor: db.adm.setor
        }
    });
});

// 4.2. Cadastrar nova equipe (Formulário de Pré-Inscrição ou Painel)
app.post(['/api/equipes/cadastrar', '/avv/api/equipes/cadastrar'], (req, res) => {
    try {
        const body = req.body || {};
        const email = sanitizarTexto(body.email, 120).toLowerCase();
        const nomeTime = sanitizarTexto(body.nomeTime, 120).toUpperCase();

        if (!email || !nomeTime) {
            return res.status(400).json({ ok: false, mensagem: 'Nome da equipe e e-mail são obrigatórios.' });
        }

        if (verificarBloqueioDuplicidade(`cad_${email}_${nomeTime}`, 4000)) {
            return res.status(429).json({ ok: false, mensagem: 'Cadastro já em processamento. Aguarde um instante.' });
        }

        const db = carregarBancoDados();

        // Verifica duplicidade por e-mail
        const existente = db.equipes.find(e => (e.email || '').toLowerCase() === email);
        if (existente) {
            return res.status(409).json({
                ok: false,
                duplicado: true,
                mensagem: `O e-mail "${email}" já possui cadastro vinculado à equipe "${existente.nomeTime}".`,
                equipe: limparEquipeParaCliente(existente)
            });
        }

        const agora = new Date();
        const dataInscricao = body.dataInscricao || agora.toLocaleDateString('pt-BR');
        const horaInscricao = body.horaInscricao || agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const numeroInscricao = body.numeroInscricao || Math.floor(100000 + Math.random() * 900000);

        const novaEquipe = {
            id: body.id || ('eq-' + Date.now()),
            numeroInscricao: String(numeroInscricao),
            protocolo: body.protocolo || ('AVV-' + numeroInscricao),
            dataInscricao,
            horaInscricao,
            dataHoraCompleta: body.dataHoraCompleta || `${dataInscricao} às ${horaInscricao}`,
            estado: sanitizarTexto(body.estado || 'RO', 40),
            cidade: sanitizarTexto(body.cidade || 'Vilhena', 80),
            nomeTime,
            responsavelNome: sanitizarTexto(body.responsavelNome || 'Dirigente Responsável', 120),
            email,
            whatsapp: sanitizarTexto(body.whatsapp || '', 30),
            instagram: sanitizarTexto(body.instagram || '', 80),
            senhaHash: hashSenhaSegura(body.senha || '123456'),
            status: body.status === 'Homologado' ? 'Homologado' : 'Pendente',
            logo: body.logo || 'logos/logo_avv.png',
            categoria: sanitizarTexto(body.categoria || 'Adulto Masculino', 60),
            categorias: Array.isArray(body.categorias) && body.categorias.length > 0 ? body.categorias : ['Adulto Masculino'],
            atletas: Array.isArray(body.atletas) ? body.atletas : [],
            comissao: Array.isArray(body.comissao) ? body.comissao : [],
            campeonatoId: body.campeonatoId || '',
            campeonatoNome: sanitizarTexto(body.campeonatoNome || body.campeonato || 'Aguardando Seleção no Painel', 180)
        };

        db.equipes.unshift(novaEquipe);
        salvarBancoDados(db);

        res.json({
            ok: true,
            mensagem: 'Equipe cadastrada com sucesso no banco de dados!',
            equipe: limparEquipeParaCliente(novaEquipe)
        });
    } catch (err) {
        console.error('Erro ao cadastrar equipe:', err);
        res.status(500).json({ ok: false, mensagem: 'Erro interno ao salvar cadastro.' });
    }
});

// 4.3. Login unificado e seguro (Time e ADM)
app.post(['/api/auth/login', '/avv/api/auth/login'], (req, res) => {
    try {
        const { tipo, login, senha } = req.body || {};
        const loginLimpo = sanitizarTexto(login, 120).toLowerCase();
        const db = carregarBancoDados();

        if (tipo === 'adm') {
            const emailAdmValido = (db.adm.email || 'avvvoleibol@gmail.com').toLowerCase();
            const usuarioValido = loginLimpo === 'admin' || loginLimpo === emailAdmValido || loginLimpo === 'avvvoleibol@gmail.com';
            const senhaCorreta = verificarSenhaSegura(senha, db.adm.senhaHash);

            if (!usuarioValido || !senhaCorreta) {
                return res.status(401).json({ ok: false, mensagem: 'Credenciais administrativas inválidas.' });
            }

            return res.json({
                ok: true,
                sessao: {
                    tipo: 'adm',
                    usuario: db.adm.usuario || 'Administrador Geral',
                    email: db.adm.email || 'avvvoleibol@gmail.com',
                    setor: db.adm.setor || 'Diretoria Técnica AVV',
                    timestamp: Date.now()
                }
            });
        }

        // Login de Equipe / Clube
        const eq = db.equipes.find(item => (item.email || '').toLowerCase() === loginLimpo);
        if (!eq) {
            return res.status(404).json({
                ok: false,
                naoEncontrado: true,
                mensagem: 'E-mail não encontrado no sistema. Faça a pré-inscrição da sua equipe antes de acessar.'
            });
        }

        const senhaValida = eq.senhaHash
            ? verificarSenhaSegura(senha, eq.senhaHash)
            : (!eq.senha || eq.senha === senha);

        if (!senhaValida) {
            return res.status(401).json({
                ok: false,
                mensagem: 'Senha incorreta para esta agremiação. Verifique e tente novamente.'
            });
        }

        // Se a equipe ainda tinha senha sem hash, converte automaticamente
        if (!eq.senhaHash && senha) {
            eq.senhaHash = hashSenhaSegura(senha);
            delete eq.senha;
            salvarBancoDados(db);
        }

        res.json({
            ok: true,
            equipe: limparEquipeParaCliente(eq),
            sessao: {
                tipo: 'time',
                equipeId: eq.id,
                email: eq.email,
                nomeTime: eq.nomeTime,
                responsavelNome: eq.responsavelNome || 'Dirigente Responsável',
                protocolo: eq.protocolo || ('AVV-' + eq.numeroInscricao),
                numeroInscricao: eq.numeroInscricao,
                timestamp: Date.now()
            }
        });
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ ok: false, mensagem: 'Erro interno ao processar autenticação.' });
    }
});

// 4.4. Sincronizar / Atualizar Equipe (Dados da equipe, Atletas, Comissão, Status, Perfil do Dirigente)
app.post(['/api/equipes/sincronizar', '/avv/api/equipes/sincronizar'], (req, res) => {
    try {
        const { equipe, equipesLista } = req.body || {};
        const db = carregarBancoDados();

        // Se enviou uma lista inteira (ex: sincronização do painel)
        if (Array.isArray(equipesLista)) {
            equipesLista.forEach(eqCliente => {
                if (!eqCliente || (!eqCliente.id && !eqCliente.email)) return;
                const idx = db.equipes.findIndex(
                    e => String(e.id) === String(eqCliente.id) ||
                         (eqCliente.email && (e.email || '').toLowerCase() === eqCliente.email.toLowerCase())
                );
                if (idx !== -1) {
                    const senhaHashPreservada = db.equipes[idx].senhaHash || (eqCliente.senha ? hashSenhaSegura(eqCliente.senha) : undefined);
                    db.equipes[idx] = {
                        ...db.equipes[idx],
                        ...eqCliente,
                        senhaHash: senhaHashPreservada
                    };
                    delete db.equipes[idx].senha;
                } else {
                    const nova = {
                        ...eqCliente,
                        senhaHash: hashSenhaSegura(eqCliente.senha || '123456')
                    };
                    delete nova.senha;
                    db.equipes.push(nova);
                }
            });
            salvarBancoDados(db);
            return res.json({ ok: true, total: db.equipes.length });
        }

        // Se enviou uma única equipe atualizada
        if (equipe && (equipe.id || equipe.email)) {
            const idx = db.equipes.findIndex(
                e => String(e.id) === String(equipe.id) ||
                     (equipe.email && (e.email || '').toLowerCase() === equipe.email.toLowerCase())
            );
            if (idx !== -1) {
                const senhaHashPreservada = equipe.novaSenha
                    ? hashSenhaSegura(equipe.novaSenha)
                    : (db.equipes[idx].senhaHash || (equipe.senha ? hashSenhaSegura(equipe.senha) : undefined));

                db.equipes[idx] = {
                    ...db.equipes[idx],
                    ...equipe,
                    senhaHash: senhaHashPreservada
                };
                delete db.equipes[idx].senha;
                delete db.equipes[idx].novaSenha;
            } else {
                const nova = {
                    ...equipe,
                    senhaHash: hashSenhaSegura(equipe.novaSenha || equipe.senha || '123456')
                };
                delete nova.senha;
                delete nova.novaSenha;
                db.equipes.unshift(nova);
            }
            salvarBancoDados(db);
            return res.json({ ok: true, equipe: limparEquipeParaCliente(equipe) });
        }

        res.status(400).json({ ok: false, mensagem: 'Dados de equipe inválidos para sincronização.' });
    } catch (err) {
        console.error('Erro ao sincronizar equipe:', err);
        res.status(500).json({ ok: false, mensagem: 'Erro ao salvar alterações da equipe.' });
    }
});

// 4.5. Excluir equipe (pelo ADM)
app.post(['/api/equipes/excluir', '/avv/api/equipes/excluir'], (req, res) => {
    try {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ ok: false, mensagem: 'ID obrigatório.' });
        const db = carregarBancoDados();
        db.equipes = db.equipes.filter(e => String(e.id) !== String(id));
        salvarBancoDados(db);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, mensagem: 'Erro ao excluir equipe.' });
    }
});

// 4.6. Alterar senha logado (Dirigente ou ADM)
app.post(['/api/auth/alterar-senha', '/avv/api/auth/alterar-senha'], (req, res) => {
    try {
        const { tipo, email, equipeId, senhaAtual, novaSenha } = req.body || {};
        if (!novaSenha || String(novaSenha).length < 6) {
            return res.status(400).json({ ok: false, mensagem: 'A nova senha deve ter no mínimo 6 caracteres.' });
        }

        const db = carregarBancoDados();

        if (tipo === 'adm') {
            if (!verificarSenhaSegura(senhaAtual, db.adm.senhaHash)) {
                return res.status(401).json({ ok: false, mensagem: 'A senha atual informada está incorreta.' });
            }
            db.adm.senhaHash = hashSenhaSegura(novaSenha);
            salvarBancoDados(db);
            return res.json({ ok: true, mensagem: 'Senha administrativa atualizada com sucesso!' });
        }

        // Dirigente / Equipe
        const idx = db.equipes.findIndex(
            e => (equipeId && String(e.id) === String(equipeId)) ||
                 (email && (e.email || '').toLowerCase() === String(email).toLowerCase())
        );

        if (idx === -1) {
            return res.status(404).json({ ok: false, mensagem: 'Equipe não localizada no banco de dados.' });
        }

        const eq = db.equipes[idx];
        if (eq.senhaHash && !verificarSenhaSegura(senhaAtual, eq.senhaHash)) {
            return res.status(401).json({ ok: false, mensagem: 'A senha atual informada está incorreta.' });
        }

        eq.senhaHash = hashSenhaSegura(novaSenha);
        delete eq.senha;
        salvarBancoDados(db);

        res.json({ ok: true, mensagem: 'Senha do clube alterada com sucesso!' });
    } catch (err) {
        console.error('Erro ao alterar senha:', err);
        res.status(500).json({ ok: false, mensagem: 'Erro ao atualizar senha.' });
    }
});

// 4.7. Atualizar Perfil do ADM
app.post(['/api/adm/perfil', '/avv/api/adm/perfil'], (req, res) => {
    try {
        const { usuario, setor, email, foto } = req.body || {};
        const db = carregarBancoDados();
        if (usuario) db.adm.usuario = sanitizarTexto(usuario, 100);
        if (setor) db.adm.setor = sanitizarTexto(setor, 100);
        if (email) db.adm.email = sanitizarTexto(email, 120).toLowerCase();
        if (foto) db.adm.foto = foto;
        salvarBancoDados(db);
        res.json({ ok: true, adm: { usuario: db.adm.usuario, setor: db.adm.setor, email: db.adm.email, foto: db.adm.foto } });
    } catch (err) {
        res.status(500).json({ ok: false, mensagem: 'Erro ao salvar perfil do administrador.' });
    }
});

// 4.8. Sincronizar Campeonatos (ADM cria/edita/ativa/exclui -> salva no servidor)
app.post(['/api/campeonatos/sincronizar', '/avv/api/campeonatos/sincronizar'], (req, res) => {
    try {
        const { campeonatos } = req.body || {};
        if (!campeonatos || typeof campeonatos !== 'object') {
            return res.status(400).json({ ok: false, mensagem: 'Objeto de campeonatos inválido.' });
        }
        const db = carregarBancoDados();
        db.campeonatos = campeonatos;
        salvarBancoDados(db);
        res.json({ ok: true, campeonatos: db.campeonatos });
    } catch (err) {
        console.error('Erro ao sincronizar campeonatos:', err);
        res.status(500).json({ ok: false, mensagem: 'Erro ao salvar campeonatos no servidor.' });
    }
});

// ============================================================================
// 5. SERVIÇO DE E-MAIL E RECUPERAÇÃO DE SENHA (SMTP OFICIAL)
// ============================================================================
let transporterCache = null;

async function criarTransporter() {
    if (transporterCache) return transporterCache;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporterCache = nodemailer.createTransport({
            host: process.env.SMTP_HOST || '162.241.203.81',
            port: Number(process.env.SMTP_PORT) || 465,
            secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true,
            pool: true,
            maxConnections: 3,
            tls: {
                rejectUnauthorized: false
            },
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        return transporterCache;
    }

    const contaTeste = await nodemailer.createTestAccount();
    transporterCache = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        pool: true,
        auth: {
            user: contaTeste.user,
            pass: contaTeste.pass
        }
    });
    return transporterCache;
}

function gerarHtmlEmailRecuperacao(nomeDestinatario, nomeTime, linkRedefinicao, codigoSeguranca) {
    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <style>
            body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; }
            .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 24px rgba(15, 28, 63, 0.1); border: 1px solid #cbd5e1; }
            .header { background: #0f1c3f; color: #ffffff; padding: 24px; text-align: center; border-bottom: 4px solid #c5a021; }
            .header h1 { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; }
            .header span { font-size: 11px; color: #cbd5e1; display: block; margin-top: 4px; text-transform: uppercase; }
            .body-content { padding: 32px 28px; }
            .body-content h2 { font-size: 18px; color: #0f1c3f; margin-top: 0; }
            .body-content p { font-size: 13.5px; line-height: 1.6; color: #475569; }
            .btn-action { display: inline-block; background: #16a34a; color: #ffffff !important; padding: 13px 28px; border-radius: 4px; text-decoration: none; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 18px 0; }
            .code-box { background: #f8fafc; border: 1.5px dashed #cbd5e1; padding: 14px 18px; border-radius: 6px; text-align: center; margin: 20px 0; }
            .code-digit { font-size: 24px; font-weight: 900; letter-spacing: 5px; color: #0f1c3f; }
            .footer { background: #0f1c3f; color: #94a3b8; padding: 18px 24px; text-align: center; font-size: 11px; line-height: 1.5; }
            .footer a { color: #cbd5e1; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>ASSOCIAÇÃO VILHENENSE DE VOLEIBOL</h1>
                <span>SISTEMA INTEGRADO DE COMPETIÇÕES &bull; VILHENA</span>
            </div>
            <div class="body-content">
                <h2>Recuperação de Acesso à Área do Time</h2>
                <p>Olá, <strong>${sanitizarTexto(nomeDestinatario || 'Dirigente Responsável', 100)}</strong>,</p>
                <p>Recebemos uma solicitação para redefinir a senha de acesso da equipe <strong>${sanitizarTexto(nomeTime || 'Sua Agremiação', 100)}</strong> no portal de competições da AVV.</p>
                
                <p>Para criar uma nova senha, clique com segurança no botão abaixo:</p>
                
                <div style="text-align: center;">
                    <a href="${linkRedefinicao}" class="btn-action">Redefinir Minha Senha</a>
                </div>

                <div class="code-box">
                    <span style="font-size: 11px; color: #64748b; display: block; margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Código de Segurança Alternativo</span>
                    <span class="code-digit">${codigoSeguranca}</span>
                </div>

                <p style="font-size: 11.5px; color: #64748b; margin-top: 24px;">
                    Este link e código expiram em <strong>1 hora</strong>. Se você não solicitou esta redefinição, nenhuma alteração foi realizada e você pode desconsiderar esta mensagem.
                </p>
            </div>
            <div class="footer">
                <strong>&copy; 2026 Associação Vilhenense de Voleibol. Todos os direitos reservados.</strong><br>
                Rua Quarenta e Três, 183-281, Jardim Eldorado, Vilhena - RO &bull; CEP: 76980-000
            </div>
        </div>
    </body>
    </html>
    `;
}

// 5.1. Solicitação de recuperação de senha
app.post(['/api/recuperar-senha', '/avv/api/recuperar-senha'], async (req, res) => {
    try {
        const { email, nomeResponsavel, nomeTime } = req.body || {};
        if (!email) {
            return res.status(400).json({ ok: false, mensagem: 'E-mail obrigatório.' });
        }

        const emailNormalizado = sanitizarTexto(email, 120).toLowerCase();

        // Cooldown de 15 segundos por e-mail contra múltiplos cliques
        const ultimoEnvio = COOLDOWN_EMAIL.get(emailNormalizado);
        if (ultimoEnvio && Date.now() < ultimoEnvio) {
            return res.status(429).json({
                ok: false,
                mensagem: 'Um e-mail de recuperação já foi enviado há poucos segundos. Aguarde um instante e verifique sua caixa de entrada.'
            });
        }

        // Busca dados reais no banco do servidor caso existam
        const db = carregarBancoDados();
        const eqBanco = db.equipes.find(e => (e.email || '').toLowerCase() === emailNormalizado);

        const nomeRespFinal = (eqBanco && eqBanco.responsavelNome) || nomeResponsavel || 'Dirigente Responsável';
        const nomeTimeFinal = (eqBanco && eqBanco.nomeTime) || nomeTime || 'Sua Agremiação';

        COOLDOWN_EMAIL.set(emailNormalizado, Date.now() + 15000);

        const token = crypto.randomBytes(24).toString('hex');
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expiraEm = Date.now() + 60 * 60 * 1000; // 1 hora

        TOKENS_RECUPERACAO.set(token, {
            email: emailNormalizado,
            codigo,
            expiraEm
        });

        const proto = req.get('x-forwarded-proto') || req.protocol;
        const baseUrl = `${proto}://${req.get('host')}`;
        const linkRedefinicao = `${baseUrl}/login.html?token=${token}&email=${encodeURIComponent(emailNormalizado)}`;

        const htmlEmail = gerarHtmlEmailRecuperacao(nomeRespFinal, nomeTimeFinal, linkRedefinicao, codigo);

        const transporter = await criarTransporter();
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Associação Vilhenense de Voleibol" <sistema@avvvoleibol.com.br>',
            to: emailNormalizado,
            subject: 'Recuperação de Senha - Associação Vilhenense de Voleibol (AVV)',
            html: htmlEmail
        });

        let previewUrl = null;
        if (nodemailer.getTestMessageUrl) {
            previewUrl = nodemailer.getTestMessageUrl(info);
        }

        res.json({
            ok: true,
            mensagem: 'E-mail de recuperação enviado com sucesso!',
            previewUrl
        });
    } catch (err) {
        console.error('Erro ao enviar e-mail de recuperação:', err);
        res.status(500).json({ ok: false, mensagem: 'Erro interno ao processar recuperação de senha.' });
    }
});

// 5.2. Redefinição de senha com atualização direta no Banco de Dados
app.post(['/api/redefinir-senha', '/avv/api/redefinir-senha'], (req, res) => {
    const { token, codigo, novaSenha, email } = req.body || {};

    if (!novaSenha || String(novaSenha).length < 6) {
        return res.status(400).json({ ok: false, mensagem: 'A nova senha deve possuir no mínimo 6 dígitos.' });
    }

    let tokenValido = null;
    if (token && TOKENS_RECUPERACAO.has(token)) {
        tokenValido = TOKENS_RECUPERACAO.get(token);
        TOKENS_RECUPERACAO.delete(token);
    } else if (codigo) {
        for (const [t, dados] of TOKENS_RECUPERACAO.entries()) {
            if (dados.codigo === String(codigo).trim() && (!email || dados.email === String(email).trim().toLowerCase())) {
                tokenValido = dados;
                TOKENS_RECUPERACAO.delete(t);
                break;
            }
        }
    }

    if (!tokenValido) {
        return res.status(400).json({ ok: false, mensagem: 'Token ou código de recuperação inválido ou já utilizado.' });
    }

    if (Date.now() > tokenValido.expiraEm) {
        return res.status(400).json({ ok: false, mensagem: 'O token de recuperação expirou. Solicite um novo link.' });
    }

    // Atualiza também no banco de dados persistente do servidor
    const db = carregarBancoDados();
    const idx = db.equipes.findIndex(e => (e.email || '').toLowerCase() === tokenValido.email.toLowerCase());
    if (idx !== -1) {
        db.equipes[idx].senhaHash = hashSenhaSegura(novaSenha);
        delete db.equipes[idx].senha;
        salvarBancoDados(db);
    }

    res.json({
        ok: true,
        mensagem: 'Senha redefinida com sucesso!',
        email: tokenValido.email
    });
});

app.listen(PORT, async () => {
    console.log(`====================================================`);
    console.log(`  🏐 SERVIDOR AVV EM EXECUÇÃO: http://localhost:${PORT}`);
    console.log(`  Banco Local Fallback: ${DB_FILE}`);
    console.log(`  Área de Inscrição:    http://localhost:${PORT}/inscricao.html`);
    console.log(`  Área de Login:        http://localhost:${PORT}/login.html`);
    console.log(`  Painel do Time:       http://localhost:${PORT}/painel-time.html`);
    console.log(`  Painel ADM:           http://localhost:${PORT}/painel-adm.html`);
    console.log(`====================================================`);

    const conectado = await initDb();
    if (conectado) {
        const estadoLocal = carregarBancoDados();
        const estadoMySQL = await carregarEstadoDoMySQL();
        if (estadoMySQL) {
            salvarBancoDados({
                equipes: estadoMySQL.equipes || estadoLocal.equipes,
                campeonatos: estadoMySQL.campeonatos || estadoLocal.campeonatos,
                adm: estadoMySQL.adm || estadoLocal.adm
            }, false);
            console.log(`✅ Dados sincronizados do MySQL (avv_db) para o cache local.`);
        } else {
            await sincronizarEstadoParaMySQL(estadoLocal);
            console.log(`✅ Estrutura inicial sincronizada no MySQL (avv_db).`);
        }
    }
});
