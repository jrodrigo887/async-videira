import type { EventBus, EventHandler } from "../../application/ports/index.ts";

/**
 * Bus em processo: entrega sequencial na ordem de inscrição. Falha de um assinante (ex.: disco cheio no log)
 * nunca interrompe a operação nem os demais assinantes.
 */
export function createEventBus(): EventBus {
  const handlers = new Set<EventHandler>();
  return {
    subscribe(handler) {
      handlers.add(handler);
      return () => { handlers.delete(handler); };
    },
    async publish(event) {
      for (const handler of [...handlers]) {
        try { await handler(event); } catch { /* assinantes só observam */ }
      }
    },
  };
}
