import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Foto } from "@shared/types";
import { obterSignedUrl } from "@/infrastructure/storage/urlCache";

interface ModalVisualizacaoFotoProps {
  fotos: Foto[];
  fotoAtual: number;
  aberto: boolean;
  onFechar: () => void;
}

/**
 * Componente de modal para visualização expandida de fotos.
 *
 * Issue #13: recebe `Foto[]` (com thumbPath/fullPath nulos ou como
 * paths crus) e faz signing LAZY no `fullPath ?? url` quando o modal
 * abre. Antes, a galeria assinava o `thumbPath` mas enviava só o
 * signed URL para o modal — o que impedia o modal de usar o full
 * size. Agora o modal tem a `Foto` completa e pode pedir o full
 * resolution sob demanda.
 */
export default function ModalVisualizacaoFoto({
  fotos,
  fotoAtual: fotoInicial,
  aberto,
  onFechar,
}: ModalVisualizacaoFotoProps) {
  const [fotoAtual, setFotoAtual] = useState(fotoInicial);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [urls, setUrls] = useState<Record<number, string>>({});

  // Lazy sign: quando o modal abre, busca a URL full-size (fullPath) de
  // cada foto. Threshold: só a foto atual + adjacentes pra swipe.
  // Antes (issue #12): a galeria assinava o thumbPath e passava o
  // string pro modal — mas o modal full-size ficava sem source.
  useEffect(() => {
    if (!aberto || fotos.length === 0) {
      setUrls({});
      return;
    }

    const signedFoto = async (foto: Foto) => {
      const path = foto.fullPath ?? foto.url;
      if (!path || path.startsWith("http")) {
        return path;
      }
      try {
        return await obterSignedUrl(path);
      } catch (err) {
        console.warn(
          "[ModalVisualizacaoFoto] Falha ao assinar URL, usando path cru:",
          path,
          err
        );
        return path;
      }
    };

    const indices = new Set<number>([
      fotoInicial,
      (fotoInicial + 1) % fotos.length,
      (fotoInicial - 1 + fotos.length) % fotos.length,
    ]);

    Promise.all(
      Array.from(indices).map(async (i) => {
        const foto = fotos[i];
        if (!foto) return;
        const url = await signedFoto(foto);
        if (url) {
          setUrls((prev) => ({ ...prev, [i]: url }));
        }
      })
    );
  }, [aberto, fotoInicial, fotos]);

  // Atualiza foto atual quando o modal abre com uma foto diferente
  useEffect(() => {
    if (aberto) {
      setFotoAtual(fotoInicial);
    }
  }, [aberto, fotoInicial]);

  // Navegação com teclado
  useEffect(() => {
    if (!aberto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        fotoAnterior();
      } else if (e.key === "ArrowRight") {
        fotoProxima();
      } else if (e.key === "Escape") {
        onFechar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [aberto, fotoAtual, fotos.length]);

  const fotoAnterior = () => {
    setFotoAtual((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
  };

  const fotoProxima = () => {
    setFotoAtual((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
  };

  // Handlers para swipe em mobile
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      fotoProxima();
    } else if (isRightSwipe) {
      fotoAnterior();
    }
  };

  if (fotos.length === 0) return null;

  // Fallback: se a URL assinada ainda não chegou, usa o path cru
  // (vai aparecer como imagem quebrada, mas a UI não quebra).
  const fotoAtualUrl =
    urls[fotoAtual] ?? fotos[fotoAtual].fullPath ?? fotos[fotoAtual].url;

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent
        className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 gap-0 bg-black/95 border-0"
        showCloseButton={false}
      >
        {/* Header com contador e botão fechar */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="text-white text-sm font-medium">
            {fotoAtual + 1} / {fotos.length}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onFechar}
            className="text-white hover:bg-white/20"
          >
            <X size={24} />
          </Button>
        </div>

        {/* Área da imagem com swipe */}
        <div
          className="flex-1 flex items-center justify-center w-full h-full overflow-hidden relative"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Botão anterior (esquerda) */}
          {fotos.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={fotoAnterior}
              className="absolute left-2 md:left-4 z-10 bg-black/50 hover:bg-black/70 text-white h-12 w-12 rounded-full"
              aria-label="Foto anterior"
            >
              <ChevronLeft size={24} />
            </Button>
          )}

          {/* Imagem em alta qualidade - sem compressão */}
          {fotoAtualUrl && (
            <img
              src={fotoAtualUrl}
              alt={`Foto ${fotoAtual + 1} de ${fotos.length}`}
              className="max-w-full max-h-full object-contain"
              style={{
                userSelect: "none",
                imageRendering: "high-quality",
              }}
              draggable={false}
              loading="eager"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}

          {/* Botão próximo (direita) */}
          {fotos.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={fotoProxima}
              className="absolute right-2 md:right-4 z-10 bg-black/50 hover:bg-black/70 text-white h-12 w-12 rounded-full"
              aria-label="Próxima foto"
            >
              <ChevronRight size={24} />
            </Button>
          )}
        </div>

        {/* Indicadores de fotos (dots) na parte inferior */}
        {fotos.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-50">
            {fotos.map((_, index) => (
              <button
                key={index}
                onClick={() => setFotoAtual(index)}
                className={`h-2 rounded-full transition-all ${
                  index === fotoAtual
                    ? "w-8 bg-white"
                    : "w-2 bg-white/50 hover:bg-white/75"
                }`}
                aria-label={`Ir para foto ${index + 1}`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

