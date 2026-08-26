/**
 * O chevron da marca repetido (brief §34): `<` `<<` `<<<` comunica seguir,
 * mover e progredir. Usado nos vazios e nos carregamentos, no lugar de
 * ilustracao de banco de imagem.
 */
export function ChevronMotif({ className }: { className?: string }) {
  return (
    <svg
      width="72"
      height="34"
      viewBox="0 0 72 34"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${10 + i * 22} 6 L${25 + i * 22} 17 L${10 + i * 22} 28`}
          stroke="var(--color-konvo-500)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.25 + i * 0.32}
        />
      ))}
    </svg>
  );
}
