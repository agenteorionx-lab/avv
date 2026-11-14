/**
 * AVV - Módulo Oficial de Emissão de Documentos (Download PDF e Impressão)
 * Permite ao usuário Baixar em PDF (.pdf), Imprimir ou Baixar e Imprimir com 1 clique.
 * Desenvolvido para a Associação Vilhenense de Voleibol (AVV).
 */

(function () {
    // Injeta o HTML do modal de opções de emissão uma única vez na página
    function garantirModalEmissaoNaPagina() {
        if (document.getElementById('modal-opcoes-emissao-avv')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'modal-opcoes-emissao-avv';
        modalDiv.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 28, 63, 0.78);
            z-index: 99999;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            padding: 16px;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        `;

        modalDiv.innerHTML = `
            <div style="background: #ffffff; width: 100%; max-width: 490px; border-radius: 10px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45); overflow: hidden; animation: avvModalFadeIn 0.22s ease-out; border: 1px solid rgba(255, 255, 255, 0.2);">
                <!-- TOPO COM CABEÇALHO AVV -->
                <div style="background: #0f1c3f; color: #ffffff; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #c5a021;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.15);">
                            <img src="logos/logo_avv.png" style="width: 24px; height: 24px; object-fit: contain;" alt="AVV" onerror="this.style.display='none'">
                        </div>
                        <div>
                            <h3 id="emissao-modal-titulo" style="font-size: 14.5px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff;">Emissão de Documento Oficial</h3>
                            <span id="emissao-modal-subtitulo" style="font-size: 11.5px; color: #cbd5e1; display: block; margin-top: 2px;">Selecione como deseja emitir o arquivo</span>
                        </div>
                    </div>
                    <button type="button" onclick="fecharModalOpcoesEmissao()" style="background: none; border: none; color: #94a3b8; font-size: 26px; cursor: pointer; line-height: 1; padding: 0 4px; transition: color 0.2s;" onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#94a3b8'" title="Fechar">&times;</button>
                </div>

                <!-- CORPO COM OPÇÕES -->
                <div style="padding: 22px 22px 18px 22px;">
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #334155; line-height: 1.45;">
                        Selecione como deseja obter o documento oficial timbrado:
                    </p>

                    <div style="display: flex; flex-direction: column; gap: 11px;">
                        <!-- OPÇÃO 1: BAIXAR PDF (.pdf) -->
                        <button type="button" id="btn-emissao-baixar" class="btn-opcao-emissao" onclick="executarAcaoEmissao('baixar')" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 8px; border: 1.5px solid #0284c7; background: #f0f9ff; color: #0369a1; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; align-items: center; gap: 14px;">
                                <div style="width: 38px; height: 38px; border-radius: 8px; background: #e0f2fe; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #bae6fd;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                </div>
                                <div>
                                    <strong style="font-size: 13.5px; display: block; color: #0369a1; font-weight: 800;">Baixar Arquivo PDF (.pdf)</strong>
                                    <span style="font-size: 11.5px; color: #64748b; font-weight: 500;">Salva o documento .pdf diretamente no seu aparelho</span>
                                </div>
                            </div>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>

                        <!-- OPÇÃO 2: IMPRIMIR -->
                        <button type="button" id="btn-emissao-imprimir" class="btn-opcao-emissao" onclick="executarAcaoEmissao('imprimir')" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 8px; border: 1.5px solid #0f1c3f; background: #f8fafc; color: #0f1c3f; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; align-items: center; gap: 14px;">
                                <div style="width: 38px; height: 38px; border-radius: 8px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #cbd5e1;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f1c3f" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                </div>
                                <div>
                                    <strong style="font-size: 13.5px; display: block; color: #0f1c3f; font-weight: 800;">Imprimir Documento</strong>
                                    <span style="font-size: 11.5px; color: #64748b; font-weight: 500;">Abre o diálogo de impressão da impressora</span>
                                </div>
                            </div>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f1c3f" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>

                        <!-- OPÇÃO 3: BAIXAR PDF E IMPRIMIR JUNTOS -->
                        <button type="button" id="btn-emissao-ambos" class="btn-opcao-emissao" onclick="executarAcaoEmissao('ambos')" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 8px; border: 1.5px solid #16a34a; background: #f0fdf4; color: #15803d; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; align-items: center; gap: 14px;">
                                <div style="width: 38px; height: 38px; border-radius: 8px; background: #dcfce7; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #bbf7d0;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                                </div>
                                <div>
                                    <strong style="font-size: 13.5px; display: block; color: #15803d; font-weight: 800;">Baixar PDF e Imprimir Juntos</strong>
                                    <span style="font-size: 11.5px; color: #166534; font-weight: 500;">Gera o arquivo .pdf no dispositivo e aciona a impressão</span>
                                </div>
                            </div>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>
                    </div>

                    <!-- FEEDBACK DE PROCESSAMENTO -->
                    <div id="emissao-loading-feedback" style="display: none; margin-top: 16px; padding: 12px 14px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; text-align: center; color: #92400e; font-size: 12px; font-weight: 700;">
                        <span style="display: inline-block; animation: avvSpin 1s linear infinite; margin-right: 8px;">⏳</span>
                        Processando documento oficial em alta resolução... Aguarde um instante.
                    </div>
                </div>

                <!-- RODAPÉ -->
                <div style="background: #f8fafc; padding: 12px 22px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">AVV &bull; Sistema Oficial de Voleibol</span>
                    <button type="button" onclick="fecharModalOpcoesEmissao()" style="background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 7px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#ffffff'">
                        Cancelar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);

        // Estilos CSS auxiliares
        if (!document.getElementById('avv-emissao-styles')) {
            const st = document.createElement('style');
            st.id = 'avv-emissao-styles';
            st.textContent = `
                @keyframes avvModalFadeIn {
                    from { opacity: 0; transform: scale(0.96) translateY(-4px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes avvSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .btn-opcao-emissao:hover {
                    transform: translateY(-1.5px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                }
                .btn-opcao-emissao:active {
                    transform: translateY(0);
                }
                @media print {
                    #modal-opcoes-emissao-avv {
                        display: none !important;
                        visibility: hidden !important;
                    }
                }
            `;
            document.head.appendChild(st);
        }
    }

    let emissaoConfigAtual = null;

    /**
     * Abre o modal com as opções de emissão (Baixar PDF, Imprimir ou Ambos)
     * @param {Object} config { titulo, subtitulo, nomeArquivo, elementoAlvo }
     */
    window.solicitarEmissaoDocumentoAvv = function (config) {
        garantirModalEmissaoNaPagina();
        emissaoConfigAtual = config || {};

        const modal = document.getElementById('modal-opcoes-emissao-avv');
        const elTitulo = document.getElementById('emissao-modal-titulo');
        const elSubtitulo = document.getElementById('emissao-modal-subtitulo');
        const feedback = document.getElementById('emissao-loading-feedback');

        if (elTitulo && emissaoConfigAtual.titulo) elTitulo.textContent = emissaoConfigAtual.titulo;
        if (elSubtitulo && emissaoConfigAtual.subtitulo) elSubtitulo.textContent = emissaoConfigAtual.subtitulo;
        if (feedback) feedback.style.display = 'none';

        modal.style.display = 'flex';
    };

    window.fecharModalOpcoesEmissao = function () {
        const modal = document.getElementById('modal-opcoes-emissao-avv');
        if (modal) modal.style.display = 'none';

        // Oculta área de fichas múltiplas se não estiver em visualização ativa
        const areaMultiplas = document.getElementById('area-fichas-multiplas');
        if (areaMultiplas) areaMultiplas.style.display = 'none';
    };

    window.executarAcaoEmissao = async function (tipoAcao) {
        if (!emissaoConfigAtual) return;

        const feedback = document.getElementById('emissao-loading-feedback');
        const btnBaixar = document.getElementById('btn-emissao-baixar');
        const btnImprimir = document.getElementById('btn-emissao-imprimir');
        const btnAmbos = document.getElementById('btn-emissao-ambos');

        if (feedback) feedback.style.display = 'block';
        if (btnBaixar) btnBaixar.style.pointerEvents = 'none';
        if (btnImprimir) btnImprimir.style.pointerEvents = 'none';
        if (btnAmbos) btnAmbos.style.pointerEvents = 'none';

        try {
            // Localiza o elemento alvo a ser impresso/baixado
            let elAlvo = emissaoConfigAtual.elementoAlvo;
            if (!elAlvo) {
                elAlvo = document.getElementById('area-fichas-multiplas');
            }

            if (elAlvo) {
                elAlvo.style.display = 'block';
            }

            const nomeArquivo = (emissaoConfigAtual.nomeArquivo || 'Documento_Oficial_AVV')
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .replace(/_+/g, '_');

            // 1. Ação: Baixar PDF
            if (tipoAcao === 'baixar' || tipoAcao === 'ambos') {
                if (typeof html2pdf !== 'undefined' && elAlvo) {
                    const opt = {
                        margin: [8, 8, 8, 8],
                        filename: `${nomeArquivo}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: {
                            scale: 2,
                            useCORS: true,
                            allowTaint: true,
                            logging: false
                        },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                        pagebreak: { mode: ['css', 'legacy'], after: '.folha-a4-avv' }
                    };
                    await html2pdf().set(opt).from(elAlvo).save();
                } else {
                    // Fallback se biblioteca não estiver pronta
                    window.print();
                }
            }

            // 2. Ação: Imprimir
            if (tipoAcao === 'imprimir' || tipoAcao === 'ambos') {
                const tempoEspera = tipoAcao === 'ambos' ? 700 : 150;
                setTimeout(() => {
                    // Garante que o diálogo feche após a impressão
                    const onAfterPrint = () => {
                        fecharModalOpcoesEmissao();
                        window.removeEventListener('afterprint', onAfterPrint);
                    };
                    window.addEventListener('afterprint', onAfterPrint);

                    window.print();

                    // Timeout de segurança caso afterprint não seja disparado
                    setTimeout(() => {
                        fecharModalOpcoesEmissao();
                    }, 2000);
                }, tempoEspera);
            } else {
                fecharModalOpcoesEmissao();
            }
        } catch (err) {
            console.error('Erro na emissão do documento:', err);
            // Em caso de exceção, fallback seguro para impressão nativa
            window.print();
            fecharModalOpcoesEmissao();
        } finally {
            if (feedback) feedback.style.display = 'none';
            if (btnBaixar) btnBaixar.style.pointerEvents = 'auto';
            if (btnImprimir) btnImprimir.style.pointerEvents = 'auto';
            if (btnAmbos) btnAmbos.style.pointerEvents = 'auto';
        }
    };
})();
