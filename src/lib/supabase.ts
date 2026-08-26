import { createClient } from "@supabase/supabase-js";

import { clockSkewSeconds } from "./authRecovery";

/**
 * Cliente Supabase.
 *
 * A chave usada aqui e a `publishable` — ela nasce para viver no bundle do
 * navegador, e quem protege os dados e o RLS, nao o segredo da chave.
 */

// `.trim()` e proposital: uma variavel colada no painel da Vercel com espaco
// ou quebra de linha no fim chega como string "cheia" mas invalida.
const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/**
 * O que falta configurar, se faltar alguma coisa.
 *
 * Isto NAO lanca excecao no carregamento do modulo, e a diferenca importa: um
 * `throw` aqui derruba o React antes de qualquer coisa renderizar, e o
 * resultado e uma tela branca sem uma linha de explicacao. Na estrada, um app
 * que some sem dizer nada e pior do que um app que nao abre.
 *
 * Em vez disso o erro vira dado, a interface mostra o que falta, e o resto do
 * app (inclusive o modo demonstracao) continua funcionando.
 */
export const configError: string | null = (() => {
  const missing = [
    !url && "VITE_SUPABASE_URL",
    !key && "VITE_SUPABASE_ANON_KEY",
  ].filter(Boolean);

  if (missing.length === 0) return null;
  return `Faltando na Vercel: ${missing.join(", ")}. Variáveis VITE_* entram no BUILD — depois de cadastrar, e preciso um deploy novo.`;
})();

// `||` e nao `??`: uma variavel cadastrada com valor VAZIO na Vercel chega
// como "", que passa direto pelo `??` e faz o createClient lancar
// "supabaseKey is required" no import do modulo — antes de qualquer coisa
// renderizar, e antes do ErrorBoundary existir. Ou seja: tela branca.
export const supabase = createClient(url || "https://nao-configurado.invalid", key || "nao-configurado", {
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
  if (configError) throw new Error(configError);

  const { data } = await supabase.auth.getSession();

  if (data.session) {
    // Token com horario de emissao no futuro (relogio do aparelho adiantado)
    // faz o Postgres recusar TUDO com "JWT issued at future". Melhor detectar
    // aqui e trocar por um novo do que deixar cada consulta falhar depois.
    const skew = clockSkewSeconds(data.session.access_token);
    if (skew !== null && skew < -5) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    } else {
      return data.session;
    }
  }

  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(
      `Não foi possível criar a sessão: ${error.message}. ` +
        "Confira se 'Anonymous sign-ins' está habilitado em Authentication → Providers.",
    );
  }
  return created.session;
}
