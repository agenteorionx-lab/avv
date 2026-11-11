/**
 * AVV Dialogs & Notifications System
 * Substitui alerts e confirms nativos do navegador por diálogos visuais profissionais
 * Marca d'água oficial, cores da federação (azul marinho #0f1c3f e dourado #c5a021).
 */

(function() {
    // Injeta o container CSS e HTML na página se não existirem
    function inicializarEstruturaAvvDialog() {
        if (document.getElementById('avv-dialog-container')) return;

        // Estilos CSS do Modal e Toast
        const style = document.createElement('style');
        style.id = 'avv-dialog-styles';
        style.textContent = `
            #avv-dialog-backdrop {
                display: none;
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(15, 28, 63, 0.72);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 99999;
                align-items: center;
                justify-content: center;
                padding: 16px;
                animation: avvFadeIn 0.2s ease-out;
            }
            #avv-dialog-card {
                background: #ffffff;
                width: 100%;
                max-width: 460px;
                border-radius: 8px;
                box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
                overflow: hidden;
                border-top: 4px solid #0f1c3f;
                animation: avvPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: inherit;
            }
            @keyframes avvFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes avvPopIn {
                from { opacity: 0; transform: scale(0.92) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .avv-dialog-body {
                padding: 24px 22px 18px 22px;
                display: flex;
                gap: 16px;
                align-items: flex-start;
            }
            .avv-dialog-icon {
                width: 46px;
                height: 46px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .avv-dialog-title {
                font-size: 14.5px;
                font-weight: 800;
                color: #0f1c3f;
                margin: 0 0 6px 0;
                line-height: 1.3;
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .avv-dialog-text {
                font-size: 13px;
                color: #475569;
                margin: 0;
                line-height: 1.55;
                white-space: pre-line;
            }
            .avv-dialog-footer {
                background: #f8fafc;
                padding: 12px 20px;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                border-top: 1px solid #e2e8f0;
            }
            .avv-dialog-btn {
                padding: 8px 18px;
                font-size: 12px;
                font-weight: 700;
                border-radius: 4px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.15s ease;
                border: none;
                font-family: inherit;
            }
            .avv-dialog-btn-cancel {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                color: #475569;
            }
            .avv-dialog-btn-cancel:hover {
                background: #f1f5f9;
            }
            .avv-dialog-btn-confirm {
                background: #16a34a;
                color: #ffffff;
            }
            .avv-dialog-btn-confirm:hover {
                filter: brightness(0.92);
            }
        `;
        document.head.appendChild(style);

        // HTML do Backdrop & Card
        const backdrop = document.createElement('div');
        backdrop.id = 'avv-dialog-backdrop';
        backdrop.innerHTML = `
            <div id="avv-dialog-card">
                <div class="avv-dialog-body">
                    <div id="avv-dialog-icon-box" class="avv-dialog-icon"></div>
                    <div style="flex: 1;">
                        <h3 id="avv-dialog-title" class="avv-dialog-title">Aviso do Sistema</h3>
                        <p id="avv-dialog-text" class="avv-dialog-text"></p>
                    </div>
                </div>
                <div class="avv-dialog-footer">
                    <button type="button" id="avv-dialog-btn-cancel" class="avv-dialog-btn avv-dialog-btn-cancel">Cancelar</button>
                    <button type="button" id="avv-dialog-btn-ok" class="avv-dialog-btn avv-dialog-btn-confirm">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
    }

    // Garante que os elementos existem mesmo se chamados antes de DOMContentLoaded
    function obterElementos() {
        inicializarEstruturaAvvDialog();
        return {
            backdrop: document.getElementById('avv-dialog-backdrop'),
            card: document.getElementById('avv-dialog-card'),
            iconBox: document.getElementById('avv-dialog-icon-box'),
            title: document.getElementById('avv-dialog-title'),
            text: document.getElementById('avv-dialog-text'),
            btnCancel: document.getElementById('avv-dialog-btn-cancel'),
            btnOk: document.getElementById('avv-dialog-btn-ok')
        };
    }

    // Função universal de alerta customizado
    window.avvAlert = function(mensagem, titulo = 'Associação Vilhenense de Voleibol', tipo = 'info') {
        return new Promise((resolve) => {
            const el = obterElementos();
            el.title.textContent = titulo;
            el.text.textContent = mensagem;
            el.btnCancel.style.display = 'none';
            el.btnOk.textContent = 'Entendido';

            if (tipo === 'success') {
                el.card.style.borderTopColor = '#16a34a';
                el.iconBox.style.background = '#dcfce7';
                el.iconBox.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                el.btnOk.style.background = '#16a34a';
            } else if (tipo === 'danger' || tipo === 'error') {
                el.card.style.borderTopColor = '#dc2626';
                el.iconBox.style.background = '#fee2e2';
                el.iconBox.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
                el.btnOk.style.background = '#dc2626';
            } else if (tipo === 'warning') {
                el.card.style.borderTopColor = '#d97706';
                el.iconBox.style.background = '#fef3c7';
                el.iconBox.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
                el.btnOk.style.background = '#d97706';
            } else {
                el.card.style.borderTopColor = '#0f1c3f';
                el.iconBox.style.background = '#eff6ff';
                el.iconBox.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d72f2" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
                el.btnOk.style.background = '#0f1c3f';
            }

            el.btnOk.onclick = function() {
                el.backdrop.style.display = 'none';
                resolve(true);
            };

            el.backdrop.style.display = 'flex';
        });
    };

    // Função universal de confirmação customizada
    window.avvConfirm = function(mensagem, titulo = 'Confirmar Ação', options = {}) {
        return new Promise((resolve) => {
            const el = obterElementos();
            el.title.textContent = titulo;
            el.text.textContent = mensagem;
            el.btnCancel.style.display = 'inline-flex';
            el.btnCancel.textContent = options.textoCancelar || 'Cancelar';
            el.btnOk.textContent = options.textoConfirmar || 'Confirmar';

            const tipo = options.tipo || 'warning';
            if (tipo === 'danger') {
                el.card.style.borderTopColor = '#dc2626';
                el.iconBox.style.background = '#fee2e2';
                el.iconBox.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
                el.btnOk.style.background = options.corConfirmar || '#dc2626';
            } else if (tipo === 'success') {
                el.card.style.borderTopColor = '#16a34a';
                el.iconBox.style.background = '#dcfce7';
                el.iconBox.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                el.btnOk.style.background = options.corConfirmar || '#16a34a';
            } else {
                el.card.style.borderTopColor = '#0f1c3f';
                el.iconBox.style.background = '#fef3c7';
                el.iconBox.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
                el.btnOk.style.background = options.corConfirmar || '#0f1c3f';
            }

            el.btnCancel.onclick = function() {
                el.backdrop.style.display = 'none';
                resolve(false);
            };

            el.btnOk.onclick = function() {
                el.backdrop.style.display = 'none';
                resolve(true);
            };

            el.backdrop.style.display = 'flex';
        });
    };

    // Sobrescreve o alert nativo do navegador para usar automaticamente o visual customizado
    window.alert = function(msg) {
        let tipo = 'info';
        const msgStr = String(msg || '');
        if (msgStr.includes('sucesso') || msgStr.includes('✓') || msgStr.includes('confirmada')) {
            tipo = 'success';
        } else if (msgStr.includes('Erro') || msgStr.includes('incorret') || msgStr.includes('Não Permitida') || msgStr.includes('obrigatório')) {
            tipo = 'error';
        } else if (msgStr.includes('Atenção') || msgStr.includes('Limite') || msgStr.includes('Selecione')) {
            tipo = 'warning';
        }
        return window.avvAlert(msgStr, 'Associação Vilhenense de Voleibol', tipo);
    };

    // ======================================================================
    // MÁSCARAS E FORMATAÇÃO AUTOMÁTICA DE CPF, TELEFONE E DATA
    // ======================================================================
    window.mascaraCpf = function(val) {
        if (!val) return '';
        let v = String(val).replace(/\D/g, '').substring(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        return v;
    };

    window.mascaraTelefone = function(val) {
        if (!val) return '';
        let v = String(val).replace(/\D/g, '').substring(0, 11);
        if (v.length > 10) {
            // (99) 99999-9999 (Celular 9 dígitos)
            v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else if (v.length > 5) {
            // (99) 9999-9999 (Fixo 8 dígitos)
            v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
        } else if (v.length > 2) {
            v = v.replace(/^(\d{2})(\d+)/, '($1) $2');
        } else if (v.length > 0) {
            v = v.replace(/^(\d+)/, '($1');
        }
        return v;
    };

    window.mascaraData = function(val) {
        if (!val) return '';
        let v = String(val).replace(/\D/g, '').substring(0, 8);
        v = v.replace(/(\d{2})(\d)/, '$1/$2');
        v = v.replace(/(\d{2})(\d)/, '$1/$2');
        return v;
    };

    // Aplica ouvintes automáticos para todos os inputs com classes ou IDs de CPF, Telefone ou Data
    function aplicarMascarasGlobais() {
        // Inputs de CPF
        const seletoresCpf = [
            '#modal-ath-cpf',
            '#modal-tec-cpf',
            'input[id*="cpf"]',
            'input[name*="cpf"]'
        ];
        document.querySelectorAll(seletoresCpf.join(',')).forEach(input => {
            if (input.dataset.mascaraAtiva) return;
            input.dataset.mascaraAtiva = 'true';
            input.setAttribute('maxlength', '14');
            input.setAttribute('placeholder', '000.000.000-00');
            input.addEventListener('input', (e) => {
                const cursorPos = e.target.selectionStart;
                e.target.value = window.mascaraCpf(e.target.value);
            });
        });

        // Inputs de Telefone / WhatsApp
        const seletoresTel = [
            '#whatsapp',
            '#prof-whats',
            '#modal-ath-whats',
            '#modal-tec-whats',
            'input[id*="whats"]',
            'input[id*="tel"]',
            'input[name*="whats"]',
            'input[name*="tel"]'
        ];
        document.querySelectorAll(seletoresTel.join(',')).forEach(input => {
            if (input.dataset.mascaraAtiva) return;
            input.dataset.mascaraAtiva = 'true';
            input.setAttribute('maxlength', '15');
            input.setAttribute('placeholder', '(69) 99999-9999');
            input.addEventListener('input', (e) => {
                e.target.value = window.mascaraTelefone(e.target.value);
            });
        });

        // Inputs de Data de Nascimento
        const seletoresData = [
            '#modal-ath-nasc',
            '#modal-tec-nasc',
            'input[id*="nasc"]',
            'input[name*="nasc"]'
        ];
        document.querySelectorAll(seletoresData.join(',')).forEach(input => {
            if (input.dataset.mascaraAtiva) return;
            input.dataset.mascaraAtiva = 'true';
            input.setAttribute('maxlength', '10');
            input.setAttribute('placeholder', 'DD/MM/AAAA');
            input.addEventListener('input', (e) => {
                e.target.value = window.mascaraData(e.target.value);
            });
        });
    }

    // Inicializa quando o documento carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            inicializarEstruturaAvvDialog();
            aplicarMascarasGlobais();
        });
    } else {
        inicializarEstruturaAvvDialog();
        aplicarMascarasGlobais();
    }

    // Observa modais que abrem dinamicamente para garantir a máscara sempre ativa
    document.addEventListener('click', () => {
        setTimeout(aplicarMascarasGlobais, 150);
    });
})();

