import { useState, useEffect } from "react";
import { Image } from "lucide-react";
import { supabase } from "@/infrastructure/supabase/client";
import ModalVisualizacaoFoto from "@/components/ModalVisualizacaoFoto";

interface GaleriaFotosMotoProps {
  fotos: string[];
}

/**
 * Componente para exibir galeria de fotos do tipo "moto"
 * Recebe um array de URLs (pode ser filePath ou URL completa)
 * 
 * IMPORTANTE: As fotos são carregadas em alta qualidade:
 * - Upload não aplica compressão (arquivo original é salvo)
 * - URLs assinadas retornam a imagem original sem transformações
 * - Modal exibe imagem em tamanho máximo com qualidade preservada
 * 
 * A pixelização na galeria pode ocorrer devido ao redimensionamento CSS
 * (grid-cols-3), mas ao clicar para expandir, a foto é exibida em qualidade máxima
 */
export default function GaleriaFotosMoto({ fotos }: GaleriaFotosMotoProps) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState(0);

  useEffect(() => {
    const carregarUrls = async () => {
      const urlsMap: Record<number, string> = {};
      await Promise.all(
        fotos.map(async (url, index) => {
          // Se não é URL completa (começa com http), precisa gerar URL assinada
          if (!url.startsWith("http")) {
            try {
              const { data } = await supabase.storage
                .from("fotos")
                .createSignedUrl(url, 3600); // 1 hora de validade
              if (data) {
                urlsMap[index] = data.signedUrl;
              }
            } catch (error) {
              console.error(`Erro ao carregar URL da foto ${index}:`, error);
            }
          } else {
            urlsMap[index] = url;
          }
        })
      );
      setUrls(urlsMap);
    };

    if (fotos.length > 0) {
      carregarUrls();
    }
  }, [fotos]);

  const abrirModal = (index: number) => {
    setFotoSelecionada(index);
    setModalAberto(true);
  };

  if (fotos.length === 0) {
    return null;
  }

  // Prepara array de URLs para o modal (usa URLs carregadas ou originais)
  const urlsParaModal = fotos.map((url, index) => urls[index] || url);

  return (
    <>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {fotos.map((url, index) => (
          <button
            key={index}
            onClick={() => abrirModal(index)}
            className="relative aspect-square rounded overflow-hidden border border-foreground/10 bg-foreground/5 hover:opacity-90 transition-opacity cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground/20"
            aria-label={`Ver foto ${index + 1} em tamanho maior`}
          >
            {urls[index] ? (
              <img
                src={urls[index]}
                alt={`Foto da moto ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image size={24} className="text-foreground/20" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Modal de visualização expandida */}
      <ModalVisualizacaoFoto
        fotos={urlsParaModal}
        fotoAtual={fotoSelecionada}
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
      />
    </>
  );
}

