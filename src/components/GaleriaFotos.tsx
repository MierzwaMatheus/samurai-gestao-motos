import { useState, useEffect } from "react";
import { FotoStatus } from "@shared/types";
import { supabase } from "@/infrastructure/supabase/client";

interface GaleriaFotosProps {
  fotos: FotoStatus[];
}

export default function GaleriaFotos({ fotos }: GaleriaFotosProps) {
  const [urls, setUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    const carregarUrls = async () => {
      const urlsMap: Record<number, string> = {};
      await Promise.all(
        fotos.map(async (foto, index) => {
          if (!foto.url.startsWith("http")) {
            const { data } = await supabase.storage
              .from("fotos")
              .createSignedUrl(foto.url, 3600);
            if (data) {
              urlsMap[index] = data.signedUrl;
            }
          } else {
            urlsMap[index] = foto.url;
          }
        })
      );
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


