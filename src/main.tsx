import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { I18nProvider } from "./i18n";
import { ThemeProvider } from "./theme";
import { SessionProvider } from "./session";
// O CSS do MapLibre vem PRIMEIRO de proposito: ele define
// `.maplibregl-map { position: relative }`, que empata em especificidade com o
// `absolute` do Tailwind. Se viesse depois, venceria pela ordem e o mapa
// colapsaria para altura zero.
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
