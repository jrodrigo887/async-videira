/** Linhas por slide no data show; acima disso o Holyrics encolhe a fonte ou corta o texto. */
export const MAX_LINES_PER_SLIDE = 4;

/**
 * Prepara a letra para o editor do Holyrics, onde uma linha em branco abre um slide novo.
 * Os blocos já separados por linha em branco são respeitados; os maiores que o limite são
 * repartidos em slides de tamanho parecido (6 linhas viram 3+3, não 4+2).
 */
export function toHolyricsSlides(lyrics: string, maxLines = MAX_LINES_PER_SLIDE): string {
  const blocks = lyrics
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

  return blocks
    .flatMap((lines) => {
      const slides = Math.ceil(lines.length / maxLines);
      const size = Math.ceil(lines.length / slides);
      return Array.from({ length: slides }, (_, index) => lines.slice(index * size, (index + 1) * size).join("\n"));
    })
    .join("\n\n");
}
