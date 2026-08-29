// Ícono por dimensión para la tarjeta de acción — decorativo, no vive en el
// catálogo (Intervention no tiene campo de ícono propio): se deriva del
// code de la dimensión, igual que ya se hace con las traducciones
// (tDim(dimension.code)). No es parte de la auditoría de valores
// hardcodeados: las dimensiones ya son un catálogo versionado propio
// (Methodology/Dimension), no una lista suelta. Separado de
// commitment-triggers.ts a propósito: ese archivo ahora toca Prisma (server
// -only) y action-card.tsx, que sí importa este archivo, es un Client
// Component — mezclarlos rompía el bundle del cliente (node:async_hooks).
export const DIMENSION_ICON: Record<string, string> = {
  CONTROL: '🧭',
  RESILIENCE: '🛟',
  DEBT: '⚖️',
  SAVING: '🌱',
  PLANNING: '🎯'
};

export const DEFAULT_DIMENSION_ICON = '⭐';
