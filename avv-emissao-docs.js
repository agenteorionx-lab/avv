/**
 * AVV - Visualizador e Emissor Oficial de Documentos (Preview + Baixar PDF + Imprimir)
 * Exibe a pré-visualização completa da folha A4 e disponibiliza apenas os botões "Baixar PDF" e "Imprimir".
 * Associação Vilhenense de Voleibol (AVV)
 */

(function () {
    function garantirModalVisualizadorNaPagina() {
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
            background: rgba(15, 28, 63, 0.88);
            z-index: 99999;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            padding: 12px;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            box-sizing: border-box;
        `;

        modalDiv.innerHTML = `
            <div id="emissao-modal-card" style="background: #ffffff; width: 100%; max-width: 900px; height: 95vh; max-height: 95vh; border-radius: 10px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; overflow: hidden; animation: avvModalFadeIn 0.2s ease-out; border: 1px solid rgba(255, 255, 255, 0.25);">
                
                <!-- BARRA SUPERIOR DE AÇÕES (NO PRINT) -->
                <div id="emissao-modal-header" class="no-print" style="background: #0f1c3f; color: #ffffff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #c5a021; gap: 12px; flex-wrap: wrap;">
                    <!-- TÍTULO E SUBTÍTULO -->
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 220px;">
                        <img src="logos/logo_avv.png" style="width: 32px; height: 32px; object-fit: contain;" alt="AVV" onerror="this.style.display='none'">
                        <div>
                            <h3 id="emissao-modal-titulo" style="font-size: 13.5px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff;">Súmula Oficial • Relação Nominal</h3>
                            <span id="emissao-modal-subtitulo" style="font-size: 11px; color: #cbd5e1; display: block; margin-top: 1px;">Pré-visualização do Documento</span>
                        </div>
                    </div>

                    <!-- BOTÕES DE AÇÃO: SOMENTE BAIXAR PDF E IMPRIMIR -->
                    <div style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
                        <!-- BOTÃO 1: BAIXAR PDF (.pdf) -->
                        <button type="button" id="btn-emissao-baixar" onclick="executarAcaoEmissao('baixar')" style="background: #0284c7; color: #ffffff; border: 1px solid #0369a1; padding: 8px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.15s; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Baixar PDF (.pdf)
                        </button>

                        <!-- BOTÃO 2: IMPRIMIR -->
                        <button type="button" id="btn-emissao-imprimir" onclick="executarAcaoEmissao('imprimir')" style="background: #16a34a; color: #ffffff; border: 1px solid #15803d; padding: 8px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.15s; box-shadow: 0 2px 6px rgba(22, 163, 74, 0.35);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Imprimir Documento
                        </button>

                        <!-- BOTÃO FECHAR -->
                        <button type="button" onclick="fecharModalOpcoesEmissao()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; width: 34px; height: 34px; border-radius: 6px; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; transition: background 0.15s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.8)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'" title="Fechar Visualização">&times;</button>
                    </div>
                </div>

                <!-- FEEDBACK DE DOWNLOAD -->
                <div id="emissao-loading-feedback" class="no-print" style="display: none; padding: 8px 16px; background: #fffbeb; border-bottom: 1px solid #fef3c7; text-align: center; color: #92400e; font-size: 12px; font-weight: 700;">
                    <span style="display: inline-block; animation: avvSpin 1s linear infinite; margin-right: 6px;">⏳</span>
                    Gerando arquivo PDF oficial em alta resolução... Aguarde o download iniciar.
                </div>

                <!-- ÁREA CENTRAL DE VISUALIZAÇÃO PRÉVIA DA FOLHA A4 -->
                <div id="emissao-preview-container" style="flex: 1; overflow-y: auto; overflow-x: auto; padding: 24px 16px; background: #cbd5e1; display: flex; justify-content: center; align-items: flex-start;">
                    <div id="emissao-preview-folhas" style="width: 100%; max-width: 780px; display: flex; flex-direction: column; gap: 24px; align-items: center;">
                        <!-- O conteúdo das folhas (.folha-a4-avv) é inserido dinamicamente aqui -->
                    </div>
                </div>

                <!-- RODAPÉ INFORMATIVO (NO PRINT) -->
                <div id="emissao-modal-footer" class="no-print" style="background: #f8fafc; padding: 10px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">AVV • Sistema Oficial de Gestão Esportiva</span>
                    <button type="button" onclick="fecharModalOpcoesEmissao()" style="background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 6px 16px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
                        Fechar Visualização
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);

        if (!document.getElementById('avv-emissao-styles')) {
            const st = document.createElement('style');
            st.id = 'avv-emissao-styles';
            st.textContent = `
                @keyframes avvModalFadeIn {
                    from { opacity: 0; transform: scale(0.97) translateY(-6px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes avvSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                #btn-emissao-baixar:hover {
                    background: #0369a1 !important;
                    transform: translateY(-1px);
                }
                #btn-emissao-imprimir:hover {
                    background: #15803d !important;
                    transform: translateY(-1px);
                }
                #emissao-preview-folhas .folha-a4-avv {
                    background: #ffffff !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
                    border-radius: 4px !important;
                    margin: 0 auto;
                }

                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #modal-opcoes-emissao-avv,
                    #modal-opcoes-emissao-avv #emissao-preview-folhas,
                    #modal-opcoes-emissao-avv #emissao-preview-folhas * {
                        visibility: visible !important;
                    }
                    #modal-opcoes-emissao-avv {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        background: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        display: block !important;
                        z-index: 9999999 !important;
                    }
                    #emissao-modal-card {
                        max-width: 100% !important;
                        height: auto !important;
                        max-height: none !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                    }
                    #emissao-modal-header,
                    #emissao-modal-footer,
                    #emissao-loading-feedback,
                    .no-print {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    #emissao-preview-container {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: #ffffff !important;
                        overflow: visible !important;
                    }
                    #emissao-preview-folhas {
                        max-width: 100% !important;
                        gap: 0 !important;
                    }
                    #emissao-preview-folhas .folha-a4-avv {
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        margin: 0 auto !important;
                        padding: 3mm 7mm !important;
                        max-height: 284mm !important;
                        box-sizing: border-box !important;
                        overflow: hidden !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                }
            `;
            document.head.appendChild(st);
        }
    }

    let emissaoConfigAtual = null;

    /**
     * Abre o modal com a pré-visualização completa e botões "Baixar PDF" e "Imprimir"
     * @param {Object} config { titulo, subtitulo, nomeArquivo, elementoAlvo }
     */
    window.solicitarEmissaoDocumentoAvv = function (config) {
        garantirModalVisualizadorNaPagina();
        emissaoConfigAtual = config || {};

        const modal = document.getElementById('modal-opcoes-emissao-avv');
        const elTitulo = document.getElementById('emissao-modal-titulo');
        const elSubtitulo = document.getElementById('emissao-modal-subtitulo');
        const feedback = document.getElementById('emissao-loading-feedback');
        const previewFolhas = document.getElementById('emissao-preview-folhas');

        if (elTitulo && emissaoConfigAtual.titulo) elTitulo.textContent = emissaoConfigAtual.titulo;
        if (elSubtitulo && emissaoConfigAtual.subtitulo) elSubtitulo.textContent = emissaoConfigAtual.subtitulo;
        if (feedback) feedback.style.display = 'none';

        // Preenche o preview com o conteúdo do elementoAlvo ou area-fichas-multiplas
        if (previewFolhas) {
            previewFolhas.innerHTML = '';
            let elAlvo = emissaoConfigAtual.elementoAlvo;
            if (!elAlvo) {
                elAlvo = document.getElementById('area-fichas-multiplas');
            }

            if (elAlvo) {
                // Se for um container com filhas (ex: area-fichas-multiplas), clona cada folha
                if (elAlvo.querySelectorAll('.folha-a4-avv').length > 0) {
                    const folhas = elAlvo.querySelectorAll('.folha-a4-avv');
                    folhas.forEach(f => {
                        previewFolhas.appendChild(f.cloneNode(true));
                    });
                } else if (elAlvo.classList.contains('folha-a4-avv')) {
                    previewFolhas.appendChild(elAlvo.cloneNode(true));
                } else {
                    previewFolhas.innerHTML = elAlvo.innerHTML;
                }
            }
        }

        modal.style.display = 'flex';
        // Posiciona a rolagem no topo da folha
        const container = document.getElementById('emissao-preview-container');
        if (container) container.scrollTop = 0;
    };

    window.fecharModalOpcoesEmissao = function () {
        const modal = document.getElementById('modal-opcoes-emissao-avv');
        if (modal) modal.style.display = 'none';

        const areaMultiplas = document.getElementById('area-fichas-multiplas');
        if (areaMultiplas) areaMultiplas.style.display = 'none';
    };

    window.executarAcaoEmissao = async function (tipoAcao) {
        if (!emissaoConfigAtual) return;

        const feedback = document.getElementById('emissao-loading-feedback');
        const btnBaixar = document.getElementById('btn-emissao-baixar');
        const btnImprimir = document.getElementById('btn-emissao-imprimir');

        if (feedback) feedback.style.display = 'block';
        if (btnBaixar) btnBaixar.style.pointerEvents = 'none';
        if (btnImprimir) btnImprimir.style.pointerEvents = 'none';

        try {
            const previewFolhas = document.getElementById('emissao-preview-folhas');
            const nomeArquivo = (emissaoConfigAtual.nomeArquivo || 'Documento_Oficial_AVV')
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .replace(/_+/g, '_');

            // 1. Ação: BAIXAR PDF (.pdf)
            if (tipoAcao === 'baixar') {
                if (typeof html2pdf !== 'undefined' && previewFolhas) {
                    const opt = {
                        margin: [6, 6, 6, 6],
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
                    await html2pdf().set(opt).from(previewFolhas).save();
                } else {
                    window.print();
                }
            }

            // 2. Ação: IMPRIMIR DOCUMENTO
            if (tipoAcao === 'imprimir') {
                setTimeout(() => {
                    window.print();
                }, 100);
            }
        } catch (err) {
            console.error('Erro na emissão do documento:', err);
            window.print();
        } finally {
            if (feedback) feedback.style.display = 'none';
            if (btnBaixar) btnBaixar.style.pointerEvents = 'auto';
            if (btnImprimir) btnImprimir.style.pointerEvents = 'auto';
        }
    };
})();
