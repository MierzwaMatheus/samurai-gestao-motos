import { Image } from "lucide-react";

interface GaleriaFotosMotoProps {
  fotos: string[];
}

/**
 * Componente para exibir galeria de fotos do tipo "moto"
 * Recebe um array de URLs das fotos
 */
export default function GaleriaFotosMoto({ fotos }: GaleriaFotosMotoProps) {
  if (fotos.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {fotos.map((url, index) => (
        <div
          key={index}
          className="relative aspect-square rounded overflow-hidden border border-foreground/10 bg-foreground/5"
        >
          {url ? (
            <img
              src={url}
              alt={`Foto da moto ${index + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image size={24} className="text-foreground/20" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

