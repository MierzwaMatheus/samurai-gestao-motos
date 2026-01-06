/**
 * Utilitário para gerar PDF da Ordem de Serviço
 * Esta é uma implementação de infraestrutura que conhece detalhes de geração de PDF
 */

interface DadosOS {
  entrada: {
    id: string;
    tipo: string;
    descricao?: string;
    observacoes?: string;
    valorCobrado?: number;
    frete: number;
    dataEntrada?: Date;
    dataEntrega?: Date;
  };
  cliente: {
    nome: string;
    telefone?: string;
    endereco?: string;
  };
  moto: {
    modelo: string;
    placa?: string;
    finalNumeroQuadro?: string;
    km?: number;
    ano?: string;
    marca?: string;
    cilindrada?: string;
    cor?: string;
  };
  fotos: Array<{ url: string; tipo: string }>;
  tiposServico?: Array<{
    nome: string;
    categoria?: "padrao" | "alinhamento";
    comOleo?: boolean;
    quantidade?: number;
    preco?: number;
  }>;
  servicosPersonalizados?: Array<{
    nome: string;
    valor: number;
    quantidade: number;
  }>;
}

export async function gerarOSPDF(dados: DadosOS): Promise<Blob> {
  // Cálculos de totais
  const valorServicos = dados.entrada.valorCobrado || 0;
  const valorFrete = dados.entrada.frete || 0;
  const valorTotal = valorServicos + valorFrete;

  // Separação de fotos
  // Fotos de entrada: 'moto' é o tipo legado usado para fotos tiradas na recepção/orçamento
  // Fotos de orçamento: 'orcamento' é um tipo mais recente
  // Fotos de documento: 'documento' geralmente são CNH/CRLV, mas podem ser relevantes dependendo do uso
  const fotosOrcamento = dados.fotos.filter(f => f.tipo === 'moto' || f.tipo === 'orcamento' || f.tipo === 'documento');
  const fotosServico = dados.fotos.filter(f => f.tipo === 'status');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>OS - ${dados.entrada.id}</title>
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          margin: 0;
          padding: 10mm; /* Margem interna para simular A4 e evitar corte */
          background: #fff;
          color: #000;
          box-sizing: border-box;
          width: 210mm;
          min-height: 297mm;
        }
        .container {
          width: 100%;
          border: 1px solid #000;
          box-sizing: border-box;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed; /* Importante para respeitar larguras */
        }
        th, td {
          border: 1px solid #000;
          padding: 4px;
          vertical-align: top;
          word-wrap: break-word;
        }
        .header-logo {
          width: 25%;
          text-align: center;
          vertical-align: middle;
          padding: 10px;
        }
        .header-info {
          width: 75%;
          text-align: center;
          vertical-align: middle;
        }
        .header-info h1 {
          font-size: 18px;
          margin: 0 0 5px 0;
          font-weight: bold;
        }
        .header-info p {
          margin: 2px 0;
          font-size: 10px;
        }
        .section-header {
          background-color: #f0f0f0;
          font-weight: bold;
          text-align: center;
          text-transform: uppercase;
          font-size: 10px;
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 2px 0;
          -webkit-print-color-adjust: exact;
        }
        .label {
          font-weight: bold;
          font-size: 9px;
          color: #333;
          display: block;
          margin-bottom: 2px;
        }
        .value {
          font-size: 11px;
          min-height: 14px; /* Garante altura para campos vazios */
          display: block;
        }
        /* Utilitários de grid para layout fixo */
        .client-grid td { width: 25%; }
        .moto-grid td { width: 16.66%; }
        
        /* Serviços */
        .services-table { border: none; }
        .services-table td { border: none; padding: 2px 5px; }
        
        /* Descrição/Valores */
        .desc-col { width: 60%; }
        .val-col { width: 20%; text-align: right; }
        .total-col { width: 20%; text-align: right; font-weight: bold; }

        /* Rodapé de assinatura e entrega */
        .footer-delivery td {
          vertical-align: top;
        }
        
        /* Imagens */
        .images-section {
          padding: 5px;
          text-align: center;
        }
        .images-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }
        .image-container {
          width: 120px;
          height: 120px; /* Altura fixa para uniformidade */
          border: 1px solid #ccc;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .image-container img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .image-caption {
          font-size: 9px;
          margin-top: 2px;
          text-align: center;
        }

        @media print {
          body { 
            margin: 0;
            padding: 10mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- CABEÇALHO -->
        <table>
          <tr>
            <td class="header-logo">
              <img src="/assets/img/logo-samurai.png" alt="SAMURAI" style="max-width: 100%; max-height: 80px;" onerror="this.onerror=null; this.parentNode.innerHTML='<h2>SAMURAI</h2>';"/>
            </td>
            <td class="header-info">
              <h1>SAMURAI GESTÃO DE MOTOS</h1>
              <p>R. Maria Ondina, 275 - Jardim Sagrado Coracao, Jandira - SP, 06608-280, Brasil</p>
              <p>WhatsApp: (11) 95759-3725 | Instagram: @SAMURAI_ALINHAMENTO</p>
              <br>
              <p style="font-weight: bold; font-size: 12px;">ORDEM DE SERVIÇO Nº ${dados.entrada.id.substring(0, 8).toUpperCase()}</p>
              <p>Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}</p>
            </td>
          </tr>
        </table>

        <!-- DADOS DO CLIENTE -->
        <div class="section-header">DADOS DO CLIENTE</div>
        <table class="client-grid">
          <tr>
            <td>
              <span class="label">NOME</span>
              <span class="value">${dados.cliente.nome}</span>
            </td>
            <td>
              <span class="label">TELEFONE</span>
              <span class="value">${dados.cliente.telefone || ''}</span>
            </td>
            <td colspan="2">
              <span class="label">ENDEREÇO</span>
              <span class="value">${dados.cliente.endereco || ''}</span>
            </td>
          </tr>
        </table>

        <!-- DADOS DA MOTO -->
        <div class="section-header">DADOS DA MOTO</div>
        <table class="moto-grid">
          <tr>
             <td>
              <span class="label">MODELO</span>
              <span class="value">${dados.moto.modelo}</span>
            </td>
            <td>
              <span class="label">MARCA</span>
              <span class="value">${dados.moto.marca || ''}</span>
            </td>
            <td>
              <span class="label">CILINDRADA</span>
              <span class="value">${dados.moto.cilindrada || ''}</span>
            </td>
            <td>
              <span class="label">ANO</span>
              <span class="value">${dados.moto.ano || ''}</span>
            </td>
            <td>
              <span class="label">PLACA</span>
              <span class="value">${dados.moto.placa || ''}</span>
            </td>
             <td>
              <span class="label">Nº CHASSI</span>
              <span class="value">${dados.moto.finalNumeroQuadro || ''}</span>
            </td>
          </tr>
        </table>

         <!-- TIPO DE SERVIÇO -->
        <div class="section-header">TIPO DE SERVIÇO</div>
        <table style="width: 100%;">
          <tr>
             <td style="padding: 0; border: none;">
               ${renderServicesTable(dados.tiposServico, dados.servicosPersonalizados)}
             </td>
          </tr>
        </table>

        <!-- DESCRIÇÃO / VALORES -->
        <div class="section-header">DESCRIÇÃO DOS SERVIÇOS / PEÇAS</div>
        <table>
          <tr style="background: #f9f9f9;">
            <th class="desc-col" style="font-size: 9px; text-align: left;">DESCRIÇÃO</th>
            <th class="val-col" style="font-size: 9px;">VALOR UNIT.</th>
            <th class="total-col" style="font-size: 9px;">TOTAL</th>
          </tr>
          <tr>
            <td class="desc-col" style="height: 150px;">
              ${dados.entrada.descricao ? dados.entrada.descricao.replace(/\n/g, '<br>') : ''}
              <br>
              ${dados.entrada.frete > 0 ? `<br>Frete: R$ ${dados.entrada.frete.toFixed(2)}` : ''}
            </td>
            <td class="val-col">
              R$ ${valorServicos.toFixed(2)}
            </td>
            <td class="total-col" style="font-size: 14px;">
              R$ ${valorTotal.toFixed(2)}
            </td>
          </tr>
        </table>

         <!-- OBSERVAÇÃO -->
        <div class="section-header">OBSERVAÇÕES</div>
        <table style="width: 100%;">
          <tr>
            <td style="height: 60px; border: none;">
              ${dados.entrada.observacoes || ''}
            </td>
          </tr>
        </table>

        <!-- IMAGENS -->
        ${(fotosOrcamento.length > 0 || fotosServico.length > 0) ? `
        <div class="section-header">REGISTRO FOTOGRÁFICO</div>
        <div class="images-section">
           ${fotosOrcamento.length > 0 ? `
             <p style="font-weight: bold; margin: 5px 0; font-size: 10px; text-align: left;">FOTOS DE ENTRADA / ORÇAMENTO:</p>
             <div class="images-grid">
               ${fotosOrcamento.map(foto => `
                 <div class="image-container">
                   <img src="${foto.url}" alt="Foto Orçamento" loading="lazy" />
                 </div>
               `).join('')}
             </div>
           ` : ''}

           ${fotosServico.length > 0 ? `
             <p style="font-weight: bold; margin: 10px 0 5px 0; font-size: 10px; text-align: left;">FOTOS DO SERVIÇO:</p>
             <div class="images-grid">
               ${fotosServico.map(foto => `
                 <div class="image-container">
                    <img src="${foto.url}" alt="Foto Serviço" loading="lazy" />
                 </div>
               `).join('')}
             </div>
           ` : ''}
        </div>
        ` : ''}

        <!-- DADOS DA ENTREGA -->
        <div class="section-header">DADOS DA ENTREGA</div>
        <table class="footer-delivery">
          <tr>
            <td width="33%">
              <span class="label">LOCAL DE ENTREGA</span>
              <div style="height: 20px;"></div>
            </td>
            <td width="33%">
              <span class="label">DATA</span>
              <div style="height: 20px;">${dados.entrada.dataEntrega ? new Date(dados.entrada.dataEntrega).toLocaleDateString('pt-BR') : ''}</div>
            </td>
            <td width="34%">
              <span class="label">RECEBIDO/ENTREGUE POR</span>
              <div style="height: 20px;"></div>
            </td>
          </tr>
          <tr>
            <td colspan="3">
              <span class="label">FORMA DE PAGAMENTO</span>
              <div style="padding-top: 5px; font-size: 10px;">
                 (&nbsp;&nbsp;) DINHEIRO &nbsp;&nbsp;&nbsp;
                 (&nbsp;&nbsp;) PIX &nbsp;&nbsp;&nbsp;
                 (&nbsp;&nbsp;) CARTÃO DÉBITO &nbsp;&nbsp;&nbsp;
                 (&nbsp;&nbsp;) CARTÃO CRÉDITO &nbsp;&nbsp;&nbsp;
                 (&nbsp;&nbsp;) OUTRO: _______________________
              </div>
            </td>
          </tr>
           <tr>
            <td colspan="3" style="text-align: center; border: none; padding-top: 30px; padding-bottom: 20px;">
              _______________________________________________________________<br>
              ASSINATURA DO CLIENTE
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'text/html' });
  return blob;
}

function renderServicesTable(
  tiposServico?: Array<any>,
  servicosPersonalizados?: Array<any>
): string {
  const allServices: string[] = [];

  // Adicionar tipos de serviço padrão
  if (tiposServico && tiposServico.length > 0) {
    tiposServico.forEach(s => {
      allServices.push(formatarServico(s));
    });
  }

  // Adicionar serviços personalizados
  if (servicosPersonalizados && servicosPersonalizados.length > 0) {
    servicosPersonalizados.forEach(s => {
      let nome = s.nome;
      if (s.quantidade && s.quantidade > 1) {
        nome += ` (${s.quantidade}x)`;
      }
      allServices.push(nome);
    });
  }

  if (allServices.length === 0) {
    return '<div style="padding: 5px; font-style: italic;">Nenhum tipo de serviço especificado.</div>';
  }

  // Divide em duas colunas
  const half = Math.ceil(allServices.length / 2);
  const col1 = allServices.slice(0, half);
  const col2 = allServices.slice(half);

  const renderItem = (text: string) => `
    <div style="margin-bottom: 2px;">
      • ${text}
    </div>
  `;

  return `
    <table style="width: 100%; border: none;">
      <tr>
        <td style="width: 50%; vertical-align: top; border: none; border-right: 1px solid #000;">
          ${col1.map(renderItem).join('')}
        </td>
        <td style="width: 50%; vertical-align: top; border: none;">
          ${col2.map(renderItem).join('')}
        </td>
      </tr>
    </table>
  `;
}

function formatarServico(t: any): string {
  let nome = t.nome;
  if (t.categoria === "alinhamento") {
    nome += t.comOleo ? " (Com Óleo)" : " (Sem Óleo)";
  }
  if (t.quantidade && t.quantidade > 1) {
    nome += ` (${t.quantidade}x)`;
  }
  return nome;
}

export function imprimirOS(html: string) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();

    // Função melhorada para esperar carregamento de imagens
    const waitForImagesAndPrint = async () => {
      const images = Array.from(printWindow.document.querySelectorAll('img'));

      const imagePromises = images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Resolve mesmo com erro para não travar
        });
      });

      // Timeout de segurança de 3s
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));

      await Promise.race([Promise.all(imagePromises), timeoutPromise]);

      try {
        printWindow.print();
      } catch (e) {
        console.error("Erro ao imprimir", e);
      }
    };

    // Aguarda o documento estar pronto se necessário, depois aguarda imagens
    if (printWindow.document.readyState === 'complete') {
      waitForImagesAndPrint();
    } else {
      printWindow.onload = waitForImagesAndPrint;
    }
  }
}
