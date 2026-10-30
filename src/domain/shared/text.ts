/** Chave textual comparável: sem diacríticos, caixa e espaços normalizados. Pontuação é preservada. */
export function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ")
    : "";
}
