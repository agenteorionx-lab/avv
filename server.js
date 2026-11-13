const express = require('express');
const http = require('http');
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
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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

// Middleware para desabilitar cache em requisições de API e páginas HTML
// Garante que qualquer atualização no sistema apareça imediatamente em tempo real
app.use((req, res, next) => {
    const urlLower = req.path.toLowerCase();
    if (
        urlLower.endsWith('.html') ||
        urlLower.endsWith('/') ||
        urlLower.startsWith('/api/') ||
        urlLower.startsWith('/avv/api/')
    ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Configuração de estáticos com revalidação imediata (sem cache travado no navegador)
const staticOpts = {
    maxAge: 0,
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
};

// Roteamento amigável e moderno (Clean URLs) sem extensão .html
// Permite acessar: /administrador, /clube, /login, /inscricao
const rotasAmigaveis = {
    '/administrador': 'painel-adm.html',
    '/admin': 'painel-adm.html',
    '/painel-adm': 'painel-adm.html',
    '/clube': 'painel-time.html',
    '/time': 'painel-time.html',
    '/painel-time': 'painel-time.html',
    '/login': 'login.html',
    '/entrar': 'login.html',
    '/inscricao': 'inscricao.html',
    '/inscrever': 'inscricao.html'
};

// Redirecionamento automático caso alguém acesse diretamente com .html para a URL limpa
app.use((req, res, next) => {
    const p = req.path.toLowerCase();
    if (p === '/painel-adm.html') return res.redirect(301, '/administrador');
    if (p === '/painel-time.html') return res.redirect(301, '/clube');
    if (p === '/login.html') return res.redirect(301, '/login');
    if (p === '/inscricao.html') return res.redirect(301, '/inscricao');
    next();
});

// Entrega as páginas limpas
Object.keys(rotasAmigaveis).forEach(rota => {
    const arquivo = rotasAmigaveis[rota];
    app.get([rota, `/avv${rota}`], (req, res) => {
        res.sendFile(path.join(__dirname, arquivo));
    });
});

// Serve os arquivos estáticos da AVV tanto na raiz (/) quanto em (/avv) sem retenção de cache
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

const CAMPEONATO_OFICIAL_COPA_XXI = {
    "camp-1794335645971": {
        id: "camp-1794335645971",
        nome: "XXI COPA AVV DE VOLEIBOL",
        modalidade: "Quadra",
        fase: "Inscrições Abertas até 16/11/2026 às 17:59",
        dataLimiteEncerramento: "2026-11-16T21:59:00.000Z",
        taxa: "Gratuito / Filiação Regular",
        limiteAtletas: 12,
        status: "Ativo",
        ativo: true,
        statusTorneio: "ativo",
        banner: "avv_superliga_athlete.png",
        descricao: "A Competição denominada 21ª - Copa AVV de Voleibol ocorrerá nas categorias SUB–15 (nascidos no ano de 2012 e mais novos), SUB-18 (nascidos no ano de 2009 e mais novos) e na categoria Adulto (aberto), na modalidade de Voleibol nos naipes masculino e feminino. A competição organizada pela Associação Vilhenense de Voleibol - AVV, reúne equipes do Estado de Rondônia e região. Sendo realizada no período de 19 a 22 de novembro 2026 na cidade de Vilhena – Rondônia.",
        categoriasAceitas: [
            "Sub-15 Masculino",
            "Sub-15 Feminino",
            "Sub-18 Masculino",
            "Sub-18 Feminino",
            "Adulto Masculino",
            "Adulto Feminino"
        ],
        regulamento: "<h4>REGULAMENTO OFICIAL - AVV 2026</h4><p>REGULAMENTO OFICIAL - AVV 2026<br><br>CAPÍTULO I - DA FINALIDADE<br>Art. 1º - Torneio oficial homologado pela AVV 2026.<br><br>CAPÍTULO II - REQUISITOS<br>Art. 2º - Atletas federados com documentação regularizada.</p>"
    }
};

function carregarBancoDados() {
    const arquivosTentativa = [DB_FILE, DB_FILE + '.backup'];
    for (const arq of arquivosTentativa) {
        try {
            if (fs.existsSync(arq)) {
                const raw = fs.readFileSync(arq, 'utf-8');
                if (!raw || !raw.trim()) continue;
                const parsed = JSON.parse(raw);
                const camps = parsed.campeonatos && typeof parsed.campeonatos === 'object' ? parsed.campeonatos : {};
                // Garante que o campeonato oficial XXI COPA AVV permaneça sempre ativo e presente
                if (!camps['camp-1794335645971']) {
                    camps['camp-1794335645971'] = CAMPEONATO_OFICIAL_COPA_XXI['camp-1794335645971'];
                }
                const admData = parsed.adm || {};
                if (!admData.senhaHash) {
                    admData.senhaHash = hashSenhaSegura(process.env.ADM_DEFAULT_PASS || '@Avv_23#');
                }
                if (!admData.usuario) admData.usuario = 'Administrador Geral';
                if (!admData.email) admData.email = process.env.ADM_DEFAULT_EMAIL || 'avvvoleibol@gmail.com';
                if (!admData.setor) admData.setor = 'Diretoria Técnica AVV';

                return {
                    equipes: Array.isArray(parsed.equipes) ? parsed.equipes : [],
                    campeonatos: camps,
                    adm: admData
                };
            }
        } catch (err) {
            console.error(`Aviso ao ler ${path.basename(arq)}:`, err.message);
        }
    }

    const dbInicial = {
        equipes: [],
        campeonatos: { ...CAMPEONATO_OFICIAL_COPA_XXI },
        adm: {
            usuario: 'Administrador Geral',
            email: process.env.ADM_DEFAULT_EMAIL || 'avvvoleibol@gmail.com',
            setor: 'Diretoria Técnica AVV',
            senhaHash: hashSenhaSegura(process.env.ADM_DEFAULT_PASS || '@Avv_23#')
        }
    };
    salvarBancoDados(dbInicial, false);
    return dbInicial;
}

function salvarBancoDados(dados, sincronizarMySQL = true) {
    try {
        const jsonPayload = JSON.stringify(dados, null, 2);
        const tempFile = `${DB_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
        fs.writeFileSync(tempFile, jsonPayload, 'utf-8');
        if (fs.existsSync(DB_FILE)) {
            try {
                fs.copyFileSync(DB_FILE, DB_FILE + '.backup');
            } catch (bkpErr) { }
        }
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

        // Normalização do WhatsApp/Telefone para comparação (apenas dígitos)
        const whatsLimpo = sanitizarTexto(body.whatsapp || '', 30).replace(/\D/g, '');

        // Verifica duplicidade por e-mail ou telefone
        const existente = db.equipes.find(e => {
            const eEmail = (e.email || '').toLowerCase().trim();
            const eWhats = (e.whatsapp || '').replace(/\D/g, '');
            if (eEmail === email) return true;
            if (whatsLimpo && whatsLimpo.length >= 8 && eWhats === whatsLimpo) return true;
            return false;
        });

        if (existente) {
            const eEmail = (existente.email || '').toLowerCase().trim();
            const motivo = (eEmail === email)
                ? `O e-mail "${email}" já possui cadastro vinculado à equipe "${existente.nomeTime}".`
                : `O telefone/WhatsApp "${body.whatsapp}" já possui cadastro vinculado à equipe "${existente.nomeTime}".`;

            return res.status(409).json({
                ok: false,
                duplicado: true,
                mensagem: `${motivo} Utilize outro ou recupere o acesso na tela de login.`,
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

        // Login de Equipe / Clube (busca todos os registros deste e-mail para garantir consistência de senha)
        const registrosClube = db.equipes.filter(item => (item.email || '').toLowerCase().trim() === loginLimpo);
        if (registrosClube.length === 0) {
            return res.status(404).json({
                ok: false,
                naoEncontrado: true,
                mensagem: 'E-mail não encontrado no sistema. Faça a pré-inscrição da sua equipe antes de acessar.'
            });
        }

        // Verifica se a conta do clube está bloqueada pelo administrador
        if (registrosClube.some(item => item.bloqueado === true)) {
            return res.status(403).json({
                ok: false,
                bloqueado: true,
                mensagem: 'Esta conta de agremiação está temporariamente bloqueada pela Diretoria da AVV. Entre em contato com a organização para regularização.'
            });
        }

        const eq = registrosClube.find(item =>
            item.senhaHash ? verificarSenhaSegura(senha, item.senhaHash) : (!item.senha || item.senha === senha)
        );

        if (!eq) {
            return res.status(401).json({
                ok: false,
                mensagem: 'Senha incorreta para esta agremiação. Verifique e tente novamente.'
            });
        }

        // Unifica o hash de senha em todos os registros deste clube para evitar divergência entre equipes do mesmo clube
        const hashOficial = eq.senhaHash || hashSenhaSegura(senha);
        let precisouUnificar = false;
        registrosClube.forEach(item => {
            if (item.senhaHash !== hashOficial || item.senha) {
                item.senhaHash = hashOficial;
                delete item.senha;
                precisouUnificar = true;
            }
        });
        if (precisouUnificar) {
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
        const { equipe, equipesLista, substituirTudo } = req.body || {};
        const db = carregarBancoDados();

        // Se enviou uma lista inteira (ex: sincronização do painel ADM)
        if (Array.isArray(equipesLista)) {
            if (substituirTudo === true) {
                const mapaAntigoPorId = new Map();
                const mapaAntigoPorEmail = new Map();
                db.equipes.forEach(e => {
                    if (e && e.id) mapaAntigoPorId.set(String(e.id), e);
                    if (e && e.email) mapaAntigoPorEmail.set(String(e.email).toLowerCase().trim(), e);
                });

                db.equipes = equipesLista
                    .filter(eqCliente => eqCliente && (eqCliente.id || eqCliente.email))
                    .map(eqCliente => {
                        const antigo = (eqCliente.id && mapaAntigoPorId.get(String(eqCliente.id))) ||
                            (eqCliente.email && mapaAntigoPorEmail.get(String(eqCliente.email).toLowerCase().trim()));
                        const senhaHashPreservada = (antigo && antigo.senhaHash)
                            ? antigo.senhaHash
                            : hashSenhaSegura(eqCliente.senha || '123456');
                        const item = {
                            ...(antigo || {}),
                            ...eqCliente,
                            senhaHash: senhaHashPreservada
                        };
                        delete item.senha;
                        delete item.novaSenha;
                        return item;
                    });
            } else {
                equipesLista.forEach(eqCliente => {
                    if (!eqCliente || (!eqCliente.id && !eqCliente.email)) return;
                    const emailEq = (eqCliente.email || '').toLowerCase().trim();
                    const contaClube = emailEq ? db.equipes.find(e => (e.email || '').toLowerCase().trim() === emailEq && e.senhaHash) : null;
                    const idx = db.equipes.findIndex(e => {
                        if (eqCliente.id && e.id) {
                            return String(e.id) === String(eqCliente.id);
                        }
                        return emailEq && (e.email || '').toLowerCase().trim() === emailEq;
                    });
                    if (idx !== -1) {
                        const senhaHashPreservada = db.equipes[idx].senhaHash || (contaClube && contaClube.senhaHash) || (eqCliente.senha ? hashSenhaSegura(eqCliente.senha) : undefined);
                        db.equipes[idx] = {
                            ...db.equipes[idx],
                            ...eqCliente,
                            senhaHash: senhaHashPreservada
                        };
                        delete db.equipes[idx].senha;
                    } else {
                        const nova = {
                            ...eqCliente,
                            senhaHash: (contaClube && contaClube.senhaHash) || hashSenhaSegura(eqCliente.senha || '123456')
                        };
                        delete nova.senha;
                        db.equipes.push(nova);
                    }
                });
            }
            salvarBancoDados(db);
            return res.json({ ok: true, total: db.equipes.length, equipes: db.equipes.map(limparEquipeParaCliente) });
        }

        // Se enviou uma única equipe atualizada
        if (equipe && (equipe.id || equipe.email)) {
            const emailEq = (equipe.email || '').toLowerCase().trim();
            const contaClube = emailEq ? db.equipes.find(e => (e.email || '').toLowerCase().trim() === emailEq && e.senhaHash) : null;
            // Busca estritamente por ID único quando fornecido para não sobrescrever equipes diferentes do mesmo clube
            const idx = db.equipes.findIndex(e => {
                if (equipe.id && e.id) {
                    return String(e.id) === String(equipe.id);
                }
                return emailEq && (e.email || '').toLowerCase().trim() === emailEq;
            });
            if (idx !== -1) {
                const senhaHashPreservada = equipe.novaSenha
                    ? hashSenhaSegura(equipe.novaSenha)
                    : (db.equipes[idx].senhaHash || (contaClube && contaClube.senhaHash) || (equipe.senha ? hashSenhaSegura(equipe.senha) : undefined));

                db.equipes[idx] = {
                    ...db.equipes[idx],
                    ...equipe,
                    senhaHash: senhaHashPreservada
                };
                delete db.equipes[idx].senha;
                delete db.equipes[idx].novaSenha;

                // Se houve alteração de senha, propaga para todos os registros do mesmo clube
                if (equipe.novaSenha && emailEq) {
                    db.equipes.forEach(item => {
                        if ((item.email || '').toLowerCase().trim() === emailEq) {
                            item.senhaHash = senhaHashPreservada;
                            delete item.senha;
                        }
                    });
                }
            } else {
                const nova = {
                    ...equipe,
                    senhaHash: equipe.novaSenha
                        ? hashSenhaSegura(equipe.novaSenha)
                        : ((contaClube && contaClube.senhaHash) || hashSenhaSegura(equipe.senha || '123456'))
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
        res.json({ ok: true, equipes: db.equipes.map(limparEquipeParaCliente) });
    } catch (err) {
        res.status(500).json({ ok: false, mensagem: 'Erro ao excluir equipe.' });
    }
});

// 4.5.1. Excluir conta de clube completa e todas as suas equipes (pelo ADM)
app.post(['/api/equipes/excluir-conta', '/avv/api/equipes/excluir-conta'], (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ ok: false, mensagem: 'E-mail obrigatório.' });
        const emailNorm = String(email).toLowerCase().trim();
        const db = carregarBancoDados();
        db.equipes = db.equipes.filter(e => (e.email || '').toLowerCase().trim() !== emailNorm);
        salvarBancoDados(db);
        res.json({
            ok: true,
            mensagem: `Conta ${emailNorm} e suas equipes foram removidas do servidor.`,
            equipes: db.equipes.map(limparEquipeParaCliente)
        });
    } catch (err) {
        console.error('Erro ao excluir conta de clube:', err);
        res.status(500).json({ ok: false, mensagem: 'Erro ao excluir conta de clube.' });
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

        const novoHash = hashSenhaSegura(novaSenha);
        const emailAlvo = (eq.email || email || '').toLowerCase().trim();
        db.equipes.forEach(item => {
            if ((equipeId && String(item.id) === String(equipeId)) || (emailAlvo && (item.email || '').toLowerCase().trim() === emailAlvo)) {
                item.senhaHash = novoHash;
                delete item.senha;
            }
        });
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

    const user = process.env.SMTP_USER || 'sistema@avvvoleibol.com.br';
    const pass = process.env.SMTP_PASS || 'PlTKigQQz4Awe6^k';
    const host = process.env.SMTP_HOST || 'mail.avvvoleibol.com.br';
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true;

    transporterCache = nodemailer.createTransport({
        host,
        port,
        secure,
        pool: true,
        maxConnections: 3,
        tls: {
            rejectUnauthorized: false
        },
        auth: {
            user,
            pass
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

function enviarEmailViaHostgator(to, subject, html) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            token: 'AVV_SECURE_TOKEN_2026_x9k2',
            to,
            subject,
            html
        });

        const req = http.request({
            hostname: '162.241.203.81',
            port: 80,
            path: '/mail_bridge.php',
            method: 'POST',
            timeout: 9000,
            headers: {
                'Host': 'avvvoleibol.com.br',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(body);
                        resolve(parsed);
                    } catch (e) {
                        resolve({ ok: true, raw: body });
                    }
                } else {
                    reject(new Error(`HostGator mail_bridge retornou status ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout ao conectar com mail_bridge na HostGator'));
        });

        req.on('error', err => reject(err));
        req.write(payload);
        req.end();
    });
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
        const textEmail = `Olá, ${nomeRespFinal} (${nomeTimeFinal})!\n\nRecebemos uma solicitação para redefinir sua senha no Portal da Associação Vilhenense de Voleibol (AVV).\n\nSeu código de segurança é: ${codigo}\n\nOu utilize o link direto para redefinição:\n${linkRedefinicao}\n\nEste código e link expiram em 1 hora.\n\nAssociação Vilhenense de Voleibol - AVV`;

        // 1. Disparo prioritário via ponte nativa PHP do cPanel/HostGator
        let enviadoComSucesso = false;
        try {
            const bridgeRes = await enviarEmailViaHostgator(
                emailNormalizado,
                'AVV - Recuperação de Senha',
                htmlEmail
            );
            console.log(`[RECUPERACAO SENHA] E-mail enviado via cPanel PHP nativo para ${emailNormalizado}:`, bridgeRes);
            enviadoComSucesso = true;
        } catch (bridgeErr) {
            console.warn(`[RECUPERACAO SENHA] Ponte HostGator indisponível (${bridgeErr.message}), usando fallback SMTP...`);
        }

        // 2. Fallback via SMTP caso a ponte não esteja ativa
        if (!enviadoComSucesso) {
            const transporter = await criarTransporter();
            const info = await transporter.sendMail({
                from: '"AVV - Voleibol" <sistema@avvvoleibol.com.br>',
                replyTo: 'sistema@avvvoleibol.com.br',
                to: emailNormalizado,
                subject: 'AVV - Recuperação de Senha',
                text: textEmail,
                html: htmlEmail,
                headers: {
                    'X-Mailer': 'cPanel on avvvoleibol.com.br',
                    'X-Priority': '1',
                    'Importance': 'High'
                }
            });
            console.log(`[RECUPERACAO SENHA] E-mail enviado via SMTP fallback para ${emailNormalizado}. MessageId: ${info.messageId}`);
        }

        res.json({
            ok: true,
            mensagem: 'E-mail de recuperação enviado com sucesso!'
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

    // Atualiza em TODOS os registros do clube no banco de dados persistente do servidor
    const db = carregarBancoDados();
    const emailAlvo = tokenValido.email.toLowerCase().trim();
    const novoHash = hashSenhaSegura(novaSenha);
    let atualizouAlgum = false;
    db.equipes.forEach(item => {
        if ((item.email || '').toLowerCase().trim() === emailAlvo) {
            item.senhaHash = novoHash;
            delete item.senha;
            atualizouAlgum = true;
        }
    });
    if (atualizouAlgum) {
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
        const estadoMySQL = await carregarEstadoDoMySQL();
        const estadoLocal = carregarBancoDados();

        // Merge não-destrutivo entre Banco Local (avv_database.json) e MySQL (avv_db)
        // Garante que NENHUM usuário, clube, equipe ou campeonato seja perdido em atualizações ou reinicializações
        const mapaEquipes = new Map();
        if (estadoMySQL && Array.isArray(estadoMySQL.equipes)) {
            estadoMySQL.equipes.forEach(eq => {
                if (eq && eq.id) mapaEquipes.set(String(eq.id), eq);
            });
        }
        if (Array.isArray(estadoLocal.equipes)) {
            estadoLocal.equipes.forEach(eq => {
                if (eq && eq.id) {
                    const existenteMysql = mapaEquipes.get(String(eq.id));
                    mapaEquipes.set(String(eq.id), {
                        ...(existenteMysql || {}),
                        ...eq,
                        senhaHash: eq.senhaHash || (existenteMysql && existenteMysql.senhaHash)
                    });
                }
            });
        }

        const equipesUnificadas = Array.from(mapaEquipes.values());
        const campeonatosUnificados = {
            ...CAMPEONATO_OFICIAL_COPA_XXI,
            ...((estadoMySQL && estadoMySQL.campeonatos) || {}),
            ...(estadoLocal.campeonatos || {})
        };
        const admUnificado = estadoLocal.adm || (estadoMySQL && estadoMySQL.adm);

        const estadoFinal = {
            equipes: equipesUnificadas,
            campeonatos: campeonatosUnificados,
            adm: admUnificado
        };

        salvarBancoDados(estadoFinal, true);
        console.log(`✅ Banco de dados verificado e sincronizado com segurança (${equipesUnificadas.length} registros preservados).`);
    }
});
