import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Palabras y formas que no deben aparecer en textos visibles (voseo y regionalismos). */
const PROHIBIDAS = [
  /\bvos\b/i, /\bche\b/i, /\bacá\b/i, /\bturnos?\b/i, /\bseñas?\b/i, /\bmesero/i, /\bcamarer/i, /\bmozos?\b/i,
  /\bpibes?\b/i, /\bgüey\b/i, /\bpana\b/i, /\bchévere\b/i, /\bplata\b/i, /\bvale\b/i,
  // Voseo: tenés, querés, podés, reservá, llamá, elegí…
  /\b(tenés|querés|podés|sabés|reservá|llamá|elegí|probá|escribí|avisá|venís)\b/i,
];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

/** Solo los literales de texto (entre comillas o en JSX), no los identificadores del código. */
function textos(codigo: string): string[] {
  const literales = codigo.match(/(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g) ?? [];
  const jsx = codigo.match(/>[^<>{}]+</g) ?? [];
  return [...literales, ...jsx];
}

describe("español neutro", () => {
  const raiz = path.resolve(import.meta.dirname, "../src");
  for (const archivo of archivos(raiz)) {
    it(`sin voseo ni regionalismos: ${path.relative(raiz, archivo)}`, () => {
      const encontrados = textos(readFileSync(archivo, "utf8")).filter((t) => PROHIBIDAS.some((re) => re.test(t)));
      expect(encontrados).toEqual([]);
    });
  }

  it("el detector sí detecta voseo", () => {
    expect(textos('const a = "Che, ¿querés reservar un turno?";').some((t) => PROHIBIDAS.some((re) => re.test(t)))).toBe(true);
  });
});
