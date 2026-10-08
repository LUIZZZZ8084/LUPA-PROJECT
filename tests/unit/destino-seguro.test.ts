/**
 * @vitest-environment node
 *
 * O `?destino=` do login só pode levar de volta para dentro da Lupa (#345).
 *
 * A versão antiga olhava prefixos à mão e barrava `//evil.com`, mas deixava
 * passar `/\evil.com`: o navegador trata `\` como `/` em http(s), e o valor
 * resolvia para `https://evil.com`. O teste trava justamente essa classe de
 * escape — barra invertida, protocolo relativo e URL absoluta.
 */
import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/destino";

const ORIGEM = "https://lupapp.com.br";

describe("destinoSeguro", () => {
  it("aceita caminho interno e devolve ele relativo", () => {
    expect(destinoSeguro("/perfil", ORIGEM)).toBe("/perfil");
    expect(destinoSeguro("/empresa?x=1", ORIGEM)).toBe("/empresa?x=1");
    expect(destinoSeguro("/vagas#topo", ORIGEM)).toBe("/vagas#topo");
  });

  it("devolve só o caminho mesmo quando recebe URL absoluta da própria origem", () => {
    expect(destinoSeguro(`${ORIGEM}/perfil/editar`, ORIGEM)).toBe(
      "/perfil/editar",
    );
  });

  it.each([
    ["//evil.com", "protocolo relativo"],
    ["/\\evil.com", "barra invertida vira // no navegador"],
    ["/\\/evil.com", "barra invertida com barra"],
    ["https://evil.com", "URL absoluta externa"],
    ["https://evil.com/perfil", "externa com caminho que imita o nosso"],
    ["javascript:alert(1)", "esquema que não é http"],
  ])("recusa %s (%s)", (entrada) => {
    expect(destinoSeguro(entrada, ORIGEM)).toBeNull();
  });

  it("recusa vazio e ausente", () => {
    expect(destinoSeguro(undefined, ORIGEM)).toBeNull();
    expect(destinoSeguro(null, ORIGEM)).toBeNull();
    expect(destinoSeguro("", ORIGEM)).toBeNull();
  });
});
