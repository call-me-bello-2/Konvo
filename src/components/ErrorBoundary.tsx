import { Component, type ReactNode } from "react";

/**
 * Rede de seguranca contra tela branca.
 *
 * Um erro nao tratado em qualquer componente derruba a arvore inteira do React
 * e deixa a pagina em branco — sem mensagem, sem botao, sem pista. Isso ja e
 * ruim num app comum; num app que as pessoas vao abrir dirigindo na estrada,
 * e inaceitavel.
 *
 * Aqui o app quebrado ainda diz o que aconteceu e oferece uma saida.
 */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Sem servico de monitoramento ainda; o console e o que o celular tem.
    console.error("[Konvo] erro não tratado:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid h-full place-items-center bg-canvas px-6 text-center">
        <div className="max-w-sm">
          <img
            src="/brand/wordmark.png"
            alt="Konvo"
            className="mx-auto mb-6 h-[22px] w-auto opacity-40"
          />
          <h1 className="text-[20px] font-extrabold">Alguma coisa quebrou</h1>
          <p className="mt-2 text-[14px] font-semibold leading-snug text-ink-50">
            O Konvo encontrou um erro e parou. Recarregar costuma resolver.
          </p>

          <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-card bg-surface-2 p-3 text-left font-mono text-[11px] leading-snug text-ink-50">
            {error.message}
          </pre>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-13 w-full rounded-pill bg-konvo-500 font-extrabold text-white active:bg-konvo-600"
            style={{ height: 52 }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
