import { Drawer } from "vaul";

import { cn } from "@/lib/utils";

/**
 * Bottom sheet do Konvo (brief §28).
 *
 * Sobre o vaul, com os tokens do produto. O `snapPoints` e o `modal={false}`
 * existem para o Live Konvo: la a folha convive com o mapa, sem escurecer nem
 * bloquear o que esta atras.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** texto de apoio abaixo do titulo */
  description?: string;
  children: React.ReactNode;
  /** sem overlay e sem bloquear o fundo — usado sobre o mapa */
  nonModal?: boolean;
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  nonModal = false,
  className,
}: Props) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} modal={!nonModal}>
      <Drawer.Portal>
        {!nonModal && <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/35" />}
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] flex-col",
            "rounded-t-sheet border-t border-hairline bg-surface shadow-sheet",
            "outline-none",
            className,
          )}
        >
          {/* alca: alvo de toque generoso, tracinho discreto */}
          <div className="flex h-6 shrink-0 items-center justify-center pt-2">
            <div className="h-1 w-9 rounded-full bg-surface-3" />
          </div>

          {(title || description) && (
            <div className="shrink-0 px-5 pb-1 pt-2">
              {title && (
                <Drawer.Title className="text-[22px] font-extrabold leading-tight tracking-[-0.01em]">
                  {title}
                </Drawer.Title>
              )}
              {description && (
                <Drawer.Description className="mt-1 text-[14px] font-semibold text-ink-50">
                  {description}
                </Drawer.Description>
              )}
            </div>
          )}

          {/* Sem titulo o Radix/vaul reclama de acessibilidade no console. */}
          {!title && <Drawer.Title className="sr-only">Konvo</Drawer.Title>}

          <div className="safe-bottom min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
