import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { BottomNavigation } from "./components/BottomNavigation";
import { KonvoHeader } from "./components/KonvoHeader";
import { NewKonvoSheet } from "./components/NewKonvoSheet";
import { SetupNotice } from "./components/SetupNotice";
import { HomePage } from "./routes/HomePage";
import { TripsPage } from "./routes/TripsPage";
import { ActivityPage } from "./routes/ActivityPage";
import { ProfilePage } from "./routes/ProfilePage";
import { NewKonvoPage } from "./routes/NewKonvoPage";
import { JoinKonvoPage } from "./routes/JoinKonvoPage";
import { LiveKonvoPage } from "./routes/LiveKonvoPage";
import { demoEvents, demoTrips, demoUser } from "./data/demo";

/**
 * Casca do app.
 *
 * O header e a bottom nav so existem nas telas de navegacao. Live Konvo,
 * criacao e entrada ocupam a tela inteira: durante a viagem a tela e o mapa,
 * e uma barra de abas ali so tiraria espaco do que importa.
 */

const FULLSCREEN = ["/konvo/", "/meet/", "/join/", "/new"];

export function App() {
  const { pathname } = useLocation();
  const [newOpen, setNewOpen] = useState(false);

  const chrome = !FULLSCREEN.some((p) => pathname.startsWith(p));

  // O + e contextual: com uma viagem em andamento ele age sobre ELA, em vez de
  // oferecer criar outra — que quase nunca e a intencao no meio da estrada.
  const activeTrip = demoTrips.find((t) => t.status === "active") ?? null;

  // O sino e a aba Activity sao a mesma caixa de entrada, entao o badge conta
  // exatamente o que a aba mostra como nao-lido.
  const unreadCount = demoEvents.filter((e) => e.unread).length;

  return (
    <div className="flex h-full flex-col bg-canvas">
      {chrome && <KonvoHeader user={demoUser} unreadCount={unreadCount} />}
      <SetupNotice />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/you" element={<ProfilePage />} />
          <Route path="/new" element={<NewKonvoPage />} />
          <Route path="/join/:code" element={<JoinKonvoPage />} />
          <Route path="/konvo/:tripId" element={<LiveKonvoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {chrome && <BottomNavigation onNewKonvo={() => setNewOpen(true)} />}

      <NewKonvoSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        activeTrip={activeTrip && { id: activeTrip.id, name: activeTrip.name }}
      />
    </div>
  );
}
