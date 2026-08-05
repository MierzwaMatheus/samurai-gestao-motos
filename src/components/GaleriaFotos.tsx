import { useState, useEffect } from "react";
import { FotoStatus } from "@shared/types";
import { obterSignedUrl } from "@/infrastructure/storage/urlCache";

interface GaleriaFotosProps {
  fotos: FotoStatus[];
}

/**
 * Componente para exibir galeria de fotos de status.
 *
 * Cada thumb usa `thumbPath` (com fallback para `url` quando `thumbPath` é
 * null — fotos legadas sem pipeline de 2 variantes).
 */
export default function GaleriaFotos({ fotos }: GaleriaFotosProps) {
  const [urls, setUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    const carregarUrls = async () => {
      const urlsMap: Record<number, string> = {};
      // Issue #13: tolerância a falhas — uma foto com signed URL que
      // falha (ex.: 400 Bad Request) não pode quebrar a galeria inteira.
      // Promise.allSettled + fallback para placeholders.
      const resultados = await Promise.allSettled(
        fotos.map(async (foto, index) => {
          // thumbPath preferido; cai no url para fotos legadas
          const path = foto.thumbPath ?? foto.url;
          if (!path.startsWith("http")) {
            const signedUrl = await obterSignedUrl(path);
            return { index, url: signedUrl };
          }
          return { index, url: path };
        })
      );
      for (const r of resultados) {
        if (r.status === "fulfilled") {
          urlsMap[r.value.index] = r.value.url;
        } else {
          console.warn(
            `[GaleriaFotos] Falha ao assinar URL, usando path cru: ${String(r.reason)}`
          );
        }
      }
      setUrls(urlsMap);
    };

    if (fotos.length > 0) {
      carregarUrls();
    }
  }, [fotos]);

  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {fotos.map((foto, index) => (
        <div
          key={index}
          className="relative aspect-square rounded overflow-hidden border border-foreground/10 bg-foreground/5"
        >
          {urls[index] ? (
            <img
              src={urls[index]}
              alt={`Status ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-pulse text-foreground/20">Carregando...</div>
            </div>
          )}
          {foto.observacao && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
              {foto.observacao}
            </div>
          )}
          <div className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
            {foto.progresso}%
          </div>
        </div>
      ))}
    </div>
  );
}