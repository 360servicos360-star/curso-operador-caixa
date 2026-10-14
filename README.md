Curso Operador de Caixa — Versão offline
=======================================

O site foi adaptado para funcionar em modo offline (offline-first) usando Service Worker e cache local.

Como usar localmente (recomendado para offline completo)
1. Copia todos os ficheiros para uma pasta: index.html, styles.css, app.js, service-worker.js, products.json, README.md
2. Serve a pasta via um servidor local (ex.: Python, Node):
   - Python 3: python -m http.server 8000
   - Node (serve): npx serve .
3. Abre no browser: http://localhost:8000
   - No primeiro carregamento o Service Worker fará cache dos ficheiros.
   - Depois de carregado, o site funciona offline.

Observações sobre funcionamento offline
- Service Worker só funciona quando servido por HTTP(s) ou localhost. Em file:// (abrir index.html diretamente) o SW não será registado.
- Mesmo sem Service Worker, a app usa um fallback embutido e localStorage para produtos, pelo que o simulador corre de forma limitada offline.
- As sessões e histórico são guardados em localStorage (funciona offline).
- Quando online, o service worker atualiza os ficheiros em background (stale-while-revalidate).

Desinstalar/forçar nova versão
- Para forçar atualização, actualiza o CACHE_NAME em service-worker.js (por exemplo 'oc-cache-v2') ou limpa cache no DevTools -> Application -> Clear storage.

Próximos passos sugeridos
- Painel de administração (editar products.json e sincronizar).
- Export/Import de histórico (JSON).
- UI para gerir cache/forçar atualização.
- Opção para sincronizar sessões para um servidor quando online.

Licença: MIT
