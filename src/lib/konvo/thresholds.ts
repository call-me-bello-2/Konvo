/**
 * Todos os numeros que decidem o que o Konvo diz ao grupo.
 *
 * Em um so lugar de proposito: sao eles que definem se o app alarma demais ou
 * de menos, e vao ser calibrados com as trilhas GPS dos testes de campo.
 *
 * NOTA DE PROJETO — por que tempo, e nao distancia:
 * o brief §13 media a dispersao do grupo em km. 2 km na Marginal e longe; 2 km
 * na Rio-Santos a 100 km/h e um minuto. Limiar fixo em metro gera alarme falso
 * na estrada e silencio na cidade. Tempo se auto-ajusta a velocidade e e o que
 * a pessoa quer saber. A distancia continua sendo exibida, como informacao
 * secundaria.
 */

export const THRESHOLDS = {
  /** Dispersao do grupo (segundos entre o primeiro e o ultimo). */
  group: {
    /** ate aqui: "todo mundo junto" */
    togetherS: 120,
    /** ate aqui: "esticando" — alguem esta ficando pra tras */
    stretchingS: 360,
    /** lacuna entre dois membros consecutivos que caracteriza divisao */
    splitGapS: 360,
  },

  /** Estado individual. */
  member: {
    /** abaixo desta velocidade, por `stoppedForMs`, a pessoa esta parada */
    stoppedSpeedMps: 0.85, // ~3 km/h
    stoppedForMs: 120_000,
    /** distancia perpendicular a rota que caracteriza saida de rota */
    offRouteM: 500,
    /** sem posicao nova por mais que isso: offline */
    offlineAfterMs: 90_000,
    /** dentro deste raio do destino, considera-se chegada */
    arrivedRadiusM: 300,
    /** faltando menos que isto para o destino: "chegando" */
    arrivingS: 300,
    /** fix com accuracy pior que isto e ignorado — GPS urbano delira */
    maxAccuracyM: 100,
  },

  /** Escrita de posicao: equilibrio entre precisao, bateria e dados. */
  publish: {
    /** so publica se andou mais que isso... */
    minMoveM: 50,
    /** ...ou se passou mais tempo que isso desde a ultima publicacao */
    maxIntervalMs: 10_000,
    /** gravacao durável no Postgres (o ao vivo vai por broadcast) */
    dbUpsertIntervalMs: 15_000,
    /** trilha para o recap */
    historyIntervalMs: 30_000,
  },

  /** Velocidade de referencia quando nao da para medir a real. */
  fallback: {
    /** usada para converter distancia em tempo antes de haver leitura de velocidade */
    speedMps: 22, // ~80 km/h
    /** piso: abaixo disso o ETA vira absurdo (transito parado) */
    minSpeedMps: 4, // ~15 km/h
  },
} as const;
