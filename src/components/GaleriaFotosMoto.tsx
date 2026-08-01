import { useState, useEffect } from "react";
import { Image } from "lucide-react";
import { Foto } from "@shared/types";
import { obterSignedUrl } from "@/infrastructure/storage/urlCache";
import ModalVisualizacaoFoto from "@/components/ModalVisualizacaoFoto";

interface GaleriaFotosMotoProps {
  fotos: Foto[];
}

/**
 * Componente para exibir galeria de fotos do tipo "moto".
 *
 * Cada thumb usa `thumbPath` (com fallback para `url` quando `thumbPath` é
 * null — fotos legadas sem pipeline de 2 variantes). O modal recebe uma
 * lista de URLs na mesma forma do componente anterior (signed URL do thumb
 * ou url original).
 */
export default function GaleriaFotosMoto({ fotos }: GaleriaFotosMotoProps) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState(0);

  useEffect(() => {
    const carregarUrls = async () => {
      const urlsMap: Record<number, string> = {};
      await Promise.all(
        fotos.map(async (foto, index) => {
          // thumbPath preferido; cai no url para fotos legadas/documento
          const path = foto.thumbPath ?? foto.url;
          if (!path.startsWith("http")) {
            try {
              const signedUrl = await obterSignedUrl(path);
              urlsMap[index] = signedUrl;
            } catch (error) {
              console.error(`Erro ao carregar URL da foto ${index}:`, error);
            }
          } else {
            urlsMap[index] = path;
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

  // Para o modal: usa a URL já assinada para o thumb (alta resolução) e
  // cai no url original para fotos cuja thumb já vem completa (http).
  const urlsParaModal = fotos.map((foto, index) => {
    const pathOriginal = foto.thumbPath ?? foto.url;
    return urls[index] ?? pathOriginal;
  });

  return (
    <>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {fotos.map((foto, index) => (
          <button
            key={foto.id ?? index}
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