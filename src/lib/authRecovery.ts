import { supabase } from "./supabase";

/**
 * Recuperacao de sessao quebrada.
 *
 * O erro "JWT issued at future" acontece quando o relogio do aparelho esta
 * adiantado em relacao ao servidor: o token nasce com horario de emissao no
 * futuro e o Postgres recusa tudo. Aparelho com relogio alguns segundos fora
 * e comum, e quem esta viajando nao vai abrir os ajustes do celular para
 * consertar isso no meio da estrada.
 *
 * Tambem cobre o caso de token velho ou corrompido no armazenamento local, que
 * da o mesmo resultado pratico: nada funciona e ninguem sabe por que.
 *
 * A resposta certa nao e mostrar o erro cru — e jogar a sessao fora e pegar
 * uma nova. Uma sessao anonima custa nada para recriar.
 */

/** Mensagens de erro que indicam token invalido, e nao falha de permissao. */
const JWT_ERRORS = [
  "jwt",
  "issued at",
  "token is expired",
  "invalid claim",
  "bad_jwt",
  "pgrst301",
];

export function isJwtError(err: unknown): boolean {
  const msg = (
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? "")
  ).toLowerCase();
  return JWT_ERRORS.some((needle) => msg.includes(needle));
}

/** Descarta a sessao local e cria outra. Nao mexe em nada no servidor. */
export async function resetSession(): Promise<void> {
  // `scope: local` de proposito: nao ha nada a revogar do outro lado, e um
  // signOut global falharia justamente porque o token esta invalido.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message);
}

/**
 * Roda uma operacao e, se ela falhar por token invalido, recria a sessao e
 * tenta de novo — uma vez so.
 *
 * Uma vez e proposital: se falhar de novo o problema nao era a sessao, e
 * insistir esconderia a causa real.
 */
export async function withAuthRetry<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (!isJwtError(err)) throw err;
    await resetSession();
    return op();
  }
}

/**
 * Diferenca entre o relogio do aparelho e o do servidor, em segundos.
 *
 * Lida do proprio token: `iat` e carimbado pelo servidor. Positivo significa
 * aparelho adiantado, que e o caso que quebra.
 */
export function clockSkewSeconds(accessToken: string): number | null {
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1])) as { iat?: number };
    if (!payload.iat) return null;
    return Math.round(Date.now() / 1000) - payload.iat;
  } catch {
    return null;
  }
}
