import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

/**
 * Registro do Service Worker — issue #13, ciclo 4.
 *
 * Só registra em PRODUÇÃO (`import.meta.env.PROD === true`). Em dev
 * o vite dev server reescreve requests de `/sw.js` e o cache do SW
 * atrapalha o hot-reload, então pulamos o registro.
 *
 * Estratégia do SW: stale-while-revalidate para o bucket público
 * `fotos` do Supabase Storage. Ver `public/sw.js` para detalhes.
 *
 * Validação manual (depois do gate): DevTools → Application → Service
 * Workers mostra o SW ativo; Network mostra `(ServiceWorker)` ou
 * `(disk cache)` em revisitas.
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(err => {
        // Falha no registro é tolerável — degrada para "sem cache",
        // que é o comportamento antigo. Não bloqueia o app.
        console.warn("[sw] Falha ao registrar Service Worker:", err);
      });
  });
}
