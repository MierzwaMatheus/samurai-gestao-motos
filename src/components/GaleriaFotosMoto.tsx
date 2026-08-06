import { useState, useEffect } from "react";
import { Image } from "lucide-react";
import { Foto } from "@shared/types";
import { obterUrlParaFoto } from "@/infrastructure/storage/urlCache";
import ModalVisualizacaoFoto from "@/components/ModalVisualizacaoFoto";

interface GaleriaFotosMotoProps {
  fotos: Foto[];
}

/**
 * Componente para exibir galeria de fotos do tipo "moto".
 *
 * Cada thumb usa `thumbPath` (com fallback para `url` quando `thumbPath` é
 * null — fotos legadas sem pipeline de 2 variantes). Issue #13: a
 * resolução do `thumbPath` é lazy no `useEffect`; o modal recebe
 * `Foto[]` (com thumbPath/fullPath crus) e resolve o `fullPath`
 * internamente quando abre.
 *
 * Ciclo 3 (issue #13): usa `obterUrlParaFoto(path, "moto")` em vez de
 * `obterSignedUrl` direto. Para moto photos, o helper retorna public
 * URL (cache infinito) — antes assinava desnecessariamente.
 */
export default function GaleriaFotosMoto({ fotos }: GaleriaFotosMotoProps) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState(0);

  useEffect(() => {
    const carregarUrls = async () => {
      const urlsMap: Record<number, string> = {};
      // Issue #13: tolerância a falhas — uma foto com URL que falha
      // (ex.: 400 Bad Request) não pode quebrar a galeria inteira.
      // Mantemos o path cru como fallback para aquela foto específica.
      // Também trocamos Promise.all por Promise.allSettled para garantir
      // que o map rode até o fim mesmo se uma rejeitar.
      const resultados = await Promise.allSettled(
        fotos.map(async (foto, index) => {
          // thumbPath preferido; cai no url para fotos legadas/documento
          const path = foto.thumbPath ?? foto.url;
          if (!path.startsWith("http")) {
            const resolvedUrl = await obterUrlParaFoto(path, "moto");
            return { index, url: resolvedUrl };
          }
          return { index, url: path };
        })
      );
      for (const r of resultados) {
        if (r.status === "fulfilled") {
          urlsMap[r.value.index] = r.value.url;
        } else {
          // Fallback: a foto problemática fica sem `urls[index]` — o thumb
          // não renderiza (placeholder), mas as outras fotos renderizam.
          console.warn(
            `[GaleriaFotosMoto] Falha ao resolver URL, usando path cru: ${String(
              r.reason
            )}`
          );
        }
      }
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

      {/* Modal de visualização expandida — recebe Foto[] e assina
          fullPath sob demanda quando abre */}
      <ModalVisualizacaoFoto
        fotos={fotos}
        fotoAtual={fotoSelecionada}
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
      />
    </>
  );
}