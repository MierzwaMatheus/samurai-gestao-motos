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
  };
  fotos: Array<{ url: string; tipo: string }>;
  tiposServico?: Array<{ nome: string }>;
}

export async function gerarOSPDF(dados: DadosOS): Promise<Blob> {
  // Por enquanto, vamos gerar um HTML que pode ser impresso
  // Futuramente pode ser integrado com uma biblioteca de PDF como jsPDF ou pdfkit
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ordem de Serviço - ${dados.entrada.id}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .section {
          margin-bottom: 20px;
        }
        .section h2 {
          font-size: 16px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 5px;
          margin-bottom: 10px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .label {
          font-weight: bold;
        }
        .row > span:not(.label) {
          text-align: right;
        }
        .fotos {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 10px;
        }
        .foto {
          border: 1px solid #ccc;
          padding: 5px;
        }
        .foto img {
          width: 100%;
          height: auto;
          display: block;
        }
        .assinatura {
          margin-top: 50px;
          border-top: 1px solid #000;
          padding-top: 10px;
        }
        @media print {
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SAMURAI GESTÃO DE MOTOS</h1>
        <p>ORDEM DE SERVIÇO</p>
        <p>OS #${dados.entrada.id.substring(0, 8).toUpperCase()}</p>
      </div>

      <div class="section">
        <h2>DADOS DO CLIENTE</h2>
        <div class="row">
          <span class="label">Nome:</span>
          <span>${dados.cliente.nome}</span>
        </div>
        ${dados.cliente.telefone ? `
        <div class="row">
          <span class="label">Telefone:</span>
          <span>${dados.cliente.telefone}</span>
        </div>
        ` : ''}
        ${dados.cliente.endereco ? `
        <div class="row">
          <span class="label">Endereço:</span>
          <span>${dados.cliente.endereco}</span>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <h2>DADOS DA MOTO</h2>
        <div class="row">
          <span class="label">Modelo:</span>
          <span>${dados.moto.modelo}</span>
        </div>
        ${dados.moto.placa ? `
        <div class="row">
          <span class="label">Placa:</span>
          <span>${dados.moto.placa}</span>
        </div>
        ` : ''}
        ${dados.moto.finalNumeroQuadro ? `
        <div class="row">
          <span class="label">Final Nº Quadro:</span>
          <span>${dados.moto.finalNumeroQuadro}</span>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <h2>SERVIÇO</h2>
        ${dados.tiposServico && dados.tiposServico.length > 0 ? `
        <div class="row">
          <span class="label">Tipos de Serviço:</span>
          <span>${dados.tiposServico.map(t => t.nome).join(', ')}</span>
        </div>
        ` : ''}
        ${dados.entrada.descricao ? `
        <div class="row">
          <span class="label">Descrição:</span>
          <span>${dados.entrada.descricao}</span>
        </div>
        ` : ''}
        ${dados.entrada.dataEntrada ? `
        <div class="row">
          <span class="label">Data Entrada:</span>
          <span>${new Date(dados.entrada.dataEntrada).toLocaleDateString('pt-BR')}</span>
        </div>
        ` : ''}
        ${dados.entrada.dataEntrega ? `
        <div class="row">
          <span class="label">Previsão Entrega:</span>
          <span>${new Date(dados.entrada.dataEntrega).toLocaleDateString('pt-BR')}</span>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <h2>VALORES</h2>
        ${dados.entrada.valorCobrado ? `
        <div class="row">
          <span class="label">Valor do Serviço:</span>
          <span>R$ ${dados.entrada.valorCobrado.toFixed(2)}</span>
        </div>
        ` : ''}
        ${dados.entrada.frete > 0 ? `
        <div class="row">
          <span class="label">Frete:</span>
          <span>R$ ${dados.entrada.frete.toFixed(2)}</span>
        </div>
        ` : ''}
        ${dados.entrada.valorCobrado ? `
        <div class="row" style="font-size: 18px; font-weight: bold; margin-top: 10px;">
          <span class="label">TOTAL:</span>
          <span>R$ ${((dados.entrada.valorCobrado || 0) + dados.entrada.frete).toFixed(2)}</span>
        </div>
        ` : ''}
      </div>

      ${dados.fotos.length > 0 ? `
      <div class="section">
        <h2>FOTOS</h2>
        <div class="fotos">
          ${dados.fotos.map(foto => `
            <div class="foto">
              <img src="${foto.url}" alt="${foto.tipo}" />
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <div class="assinatura">
        <p>_________________________________</p>
        <p>Assinatura do Cliente</p>
        <p style="margin-top: 30px;">Data: _______________</p>
      </div>
    </body>
    </html>
  `;

  // Retorna HTML que pode ser impresso ou convertido para PDF
  // Para produção, pode usar bibliotecas como jsPDF, pdfkit, ou uma API de geração de PDF
  const blob = new Blob([html], { type: 'text/html' });
  return blob;
}

export function imprimirOS(html: string) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Função para aguardar imagens e imprimir
    const aguardarImagensEImprimir = () => {
      const images = printWindow.document.querySelectorAll('img');
      const totalImages = images.length;
      
      if (totalImages === 0) {
        // Se não há imagens, imprime imediatamente
        setTimeout(() => {
          printWindow.print();
        }, 100);
        return;
      }
      
      let loadedImages = 0;
      let hasError = false;
      
      // Aguarda todas as imagens carregarem
      images.forEach((img: HTMLImageElement) => {
        // Mostra a imagem imediatamente se já estiver carregada
        if (img.complete && img.naturalHeight !== 0) {
          loadedImages++;
          img.style.display = 'block';
        } else {
          // Aguarda o carregamento
          img.onload = () => {
            loadedImages++;
            img.style.display = 'block';
            if (loadedImages === totalImages && !hasError) {
              setTimeout(() => {
                printWindow.print();
              }, 200);
            }
          };
          img.onerror = () => {
            loadedImages++;
            hasError = true;
            img.style.display = 'none';
            if (loadedImages === totalImages) {
              setTimeout(() => {
                printWindow.print();
              }, 200);
            }
          };
        }
      });
      
      // Se todas as imagens já estavam carregadas
      if (loadedImages === totalImages) {
        setTimeout(() => {
          printWindow.print();
        }, 200);
      }
      
      // Timeout de segurança: imprime após 2 segundos mesmo se algumas imagens não carregarem
      setTimeout(() => {
        images.forEach((img: HTMLImageElement) => {
          if (img.complete || img.naturalHeight !== 0) {
            img.style.display = 'block';
          }
        });
        printWindow.print();
      }, 2000);
    };
    
    // Aguarda o documento estar pronto
    if (printWindow.document.readyState === 'complete') {
      aguardarImagensEImprimir();
    } else {
      printWindow.addEventListener('load', aguardarImagensEImprimir);
    }
  }
}

