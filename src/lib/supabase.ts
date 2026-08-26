import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase.
 *
 * A chave usada aqui e a `publishable` — ela nasce para viver no bundle do
 * navegador, e quem protege os dados e o RLS, nao o segredo da chave. Se o RLS
 * estiver frouxo, esconder a chave nao salva nada.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Falhar alto aqui e melhor do que descobrir na estrada que ninguem
  // consegue entrar na viagem.
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sao obrigatorias. Copie .env.example para .env.",
  );
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // O convidado nao passa por e-mail nem redirect; nao ha nada na URL para ler.
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      // Posicao de ate ~8 pessoas em movimento. Mais que isso e ruido; menos,
      // e atraso perceptivel no mapa.
      eventsPerSecond: 10,
    },
  },
});

/**
 * Garante uma sessao anonima.
 *
 * Entrar por link nao pode pedir conta (brief §10), mas o RLS precisa de um
 * `auth.uid()` de verdade — sem ele nao da para dizer "cada um so escreve a
 * propria posicao". Usuario anonimo resolve os dois: zero atrito na entrada,
 * identidade real no banco, e da para vincular a uma conta depois.
 */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error) {
    // O erro mais provavel aqui e o provider anonimo desligado no painel.
    throw new Error(
      `Nao foi possivel criar a sessao: ${error.message}. ` +
        "Confira se 'Anonymous sign-ins' esta habilitado em Authentication -> Providers.",
    );
  }
  return created.session;
}
