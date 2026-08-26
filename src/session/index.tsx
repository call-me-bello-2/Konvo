import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { ensureSession, supabase } from "@/lib/supabase";

/**
 * Identidade do usuario.
 *
 * Entrar por link nao pode pedir conta (brief §10), mas o RLS precisa de um
 * `auth.uid()` real — sem ele nao da para garantir que cada um so escreve a
 * propria posicao. Usuario anonimo resolve os dois lados: zero atrito na
 * entrada e identidade de verdade no banco.
 *
 * O NOME fica no dispositivo, nao na conta: a pessoa digita uma vez e o app
 * nao pergunta de novo a cada viagem.
 */

const NAME_KEY = "konvo.displayName";
const PHONE_KEY = "konvo.phone";
const AVATAR_KEY = "konvo.avatar";

interface SessionValue {
  userId: string | null;
  /** null enquanto a sessao anonima nao foi criada */
  loading: boolean;
  /** erro de bootstrap — quase sempre 'anonymous sign-ins' desligado no painel */
  error: string | null;
  displayName: string;
  setDisplayName: (n: string) => void;
  /**
   * Telefone. E o plano B do produto: se o app travar, ficar sem sinal ou a
   * bateria acabar, o grupo ainda precisa conseguir falar com a pessoa.
   */
  phone: string;
  setPhone: (p: string) => void;
  /** foto reduzida, guardada como data URL */
  avatarUrl: string | null;
  setAvatarUrl: (a: string | null) => void;
  retry: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // sem persistencia a pessoa so digita de novo; nao pode quebrar o app
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setName] = useState(() => read(NAME_KEY));
  const [phone, setPhoneState] = useState(() => read(PHONE_KEY));
  const [avatarUrl, setAvatarState] = useState<string | null>(
    () => read(AVATAR_KEY) || null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    ensureSession()
      .then((session) => {
        if (cancelled) return;
        setUserId(session?.user.id ?? null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // A sessao anonima pode ser revogada (limpar dados do site, por exemplo);
    // sem isto o app continuaria tentando escrever com um uid morto.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUserId(session?.user.id ?? null);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [attempt]);

  const setDisplayName = (n: string) => {
    setName(n);
    write(NAME_KEY, n);
  };

  const setPhone = (p: string) => {
    setPhoneState(p);
    write(PHONE_KEY, p);
  };

  const setAvatarUrl = (a: string | null) => {
    setAvatarState(a);
    write(AVATAR_KEY, a ?? "");
  };

  const value = useMemo(
    () => ({
      userId,
      loading,
      error,
      displayName,
      setDisplayName,
      phone,
      setPhone,
      avatarUrl,
      setAvatarUrl,
      retry: () => setAttempt((a) => a + 1),
    }),
    [userId, loading, error, displayName, phone, avatarUrl],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return ctx;
}
