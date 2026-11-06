const express = require('express');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve todos os arquivos estáticos da AVV tanto na raiz (/) quanto em (/avv)
app.use(express.static(__dirname));
app.use('/avv', express.static(__dirname));

// Armazenamento em memória de tokens de recuperação (token -> { email, codigo, expiraEm })
const TOKENS_RECUPERACAO = new Map();
const COOLDOWN_EMAIL = new Map(); // Previne múltiplos cliques seguidos para o mesmo e-mail

// Limpeza automática de memória para tokens expirados a cada 10 minutos
setInterval(() => {
    const agora = Date.now();
    for (const [token, dados] of TOKENS_RECUPERACAO.entries()) {
        if (agora > dados.expiraEm) {
            TOKENS_RECUPERACAO.delete(token);
        }
    }
    for (const [email, expira] of COOLDOWN_EMAIL.entries()) {
        if (agora > expira) {
            COOLDOWN_EMAIL.delete(email);
        }
    }
}, 10 * 60 * 1000).unref();

// Cache do transporter SMTP para resposta rápida sem recriar conexão a cada requisição
let transporterCache = null;

// Helper: Configura transporter do Nodemailer
async function criarTransporter() {
    if (transporterCache) return transporterCache;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporterCache = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            pool: true,
            maxConnections: 3,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        return transporterCache;
    }

    // Se ainda não tiver SMTP configurado, cria conta de teste automática no Ethereal (e mantém em cache)
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

// Template HTML Oficial do E-mail da AVV
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
                <span>SISTEMA INTEGRADO DE COMPETIÇÕES &bull; AVV</span>
            </div>
            <div class="body-content">
                <h2>Recuperação de Acesso à Área do Time</h2>
                <p>Olá, <strong>${nomeDestinatario || 'Dirigente Responsável'}</strong>,</p>
                <p>Recebemos uma solicitação para redefinir a senha de acesso da equipe <strong>${nomeTime || 'Sua Agremiação'}</strong> no portal de competições da AVV.</p>
                
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
                <strong>Associação Vilhenense de Voleibol - AVV</strong><br>
                Rua Quarenta e Três, 183-281, Jardim Eldorado, Vilhena - RO &bull; CEP: 76980-000<br>
                Expediente: Seg. a Sex. 08h às 18h &bull; <a href="mailto:contato@avv.com.br">contato@avv.com.br</a>
            </div>
        </div>
    </body>
    </html>
    `;
}

// 1. ROTA DE SOLICITAÇÃO DE RECUPERAÇÃO DE SENHA
app.post(['/api/recuperar-senha', '/avv/api/recuperar-senha'], async (req, res) => {
    try {
        const { email, nomeResponsavel, nomeTime } = req.body;
        if (!email) {
            return res.status(400).json({ ok: false, mensagem: 'E-mail obrigatório.' });
        }

        const emailNormalizado = email.trim().toLowerCase();

        // Prevenção contra múltiplos disparos seguidos (cooldown de 15 segundos por e-mail)
        const ultimoEnvio = COOLDOWN_EMAIL.get(emailNormalizado);
        if (ultimoEnvio && Date.now() < ultimoEnvio) {
            return res.status(429).json({
                ok: false,
                mensagem: 'Um e-mail de recuperação já foi enviado há poucos segundos. Aguarde um instante e verifique sua caixa de entrada.'
            });
        }
        COOLDOWN_EMAIL.set(emailNormalizado, Date.now() + 15000);

        const token = crypto.randomBytes(24).toString('hex');
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expiraEm = Date.now() + 60 * 60 * 1000; // 1 hora

        TOKENS_RECUPERACAO.set(token, {
            email: emailNormalizado,
            codigo,
            expiraEm
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const linkRedefinicao = `${baseUrl}/login.html?token=${token}&email=${encodeURIComponent(emailNormalizado)}`;

        const htmlEmail = gerarHtmlEmailRecuperacao(nomeResponsavel, nomeTime, linkRedefinicao, codigo);

        const transporter = await criarTransporter();
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Associação Vilhenense de Voleibol" <contato@avv.com.br>',
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
            codigo,
            linkRedefinicao,
            previewUrl
        });
    } catch (err) {
        console.error('Erro ao enviar e-mail de recuperação:', err);
        res.status(500).json({ ok: false, mensagem: 'Erro interno ao processar recuperação de senha.' });
    }
});

// 2. ROTA DE REDEFINIÇÃO DE SENHA (VALIDAÇÃO DE TOKEN / CÓDIGO)
app.post(['/api/redefinir-senha', '/avv/api/redefinir-senha'], (req, res) => {
    const { token, codigo, novaSenha, email } = req.body;

    if (!novaSenha || novaSenha.length < 6) {
        return res.status(400).json({ ok: false, mensagem: 'A nova senha deve possuir no mínimo 6 dígitos.' });
    }

    let tokenValido = null;
    if (token && TOKENS_RECUPERACAO.has(token)) {
        tokenValido = TOKENS_RECUPERACAO.get(token);
    } else if (codigo) {
        for (const [t, dados] of TOKENS_RECUPERACAO.entries()) {
            if (dados.codigo === codigo && (!email || dados.email === email.toLowerCase())) {
                tokenValido = dados;
                TOKENS_RECUPERACAO.delete(t);
                break;
            }
        }
    }

    if (!tokenValido) {
        return res.status(400).json({ ok: false, mensagem: 'Token ou código de recuperação inválido ou expirado.' });
    }

    if (Date.now() > tokenValido.expiraEm) {
        return res.status(400).json({ ok: false, mensagem: 'O token de recuperação expirou. Solicite um novo link.' });
    }

    res.json({
        ok: true,
        mensagem: 'Senha redefinida com sucesso!',
        email: tokenValido.email
    });
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  🏐 SERVIDOR AVV EM EXECUÇÃO: http://localhost:${PORT}`);
    console.log(`  Área de Inscrição: http://localhost:${PORT}/inscricao.html`);
    console.log(`  Área de Login:     http://localhost:${PORT}/login.html`);
    console.log(`  Painel do Time:    http://localhost:${PORT}/painel-time.html`);
    console.log(`  Painel ADM:        http://localhost:${PORT}/painel-adm.html`);
    console.log(`====================================================`);
});

