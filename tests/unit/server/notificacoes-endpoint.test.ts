/**
 * @vitest-environment node
 *
 * Para onde um aviso de push pode ir (#356).
 *
 * O endereço vem do navegador de quem se inscreveu, e o servidor faz uma
 * requisição para ele. A regra é a lista de serviços de push; o que se
 * cobra aqui é que nenhum destino fora dela passe, por mais que se pareça.
 */
import { describe, expect, it } from "vitest";
import { endpointDePushPermitido } from "@/server/notificacoes/endpoint";

describe("endpoint de push", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QXl0abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("aceita %s", (endpoint) => {
    expect(endpointDePushPermitido(endpoint)).toBe(true);
  });

  it.each([
    ["http://fcm.googleapis.com/fcm/send/abc", "sem TLS"],
    ["https://evil.example/fcm.googleapis.com", "o serviço só no caminho"],
    ["https://fcm.googleapis.com.evil.example/x", "o serviço como prefixo"],
    ["https://evilfcm.googleapis.com/x", "outro host que termina igual"],
    ["https://evil-push.apple.com.evil.example/x", "apple como prefixo"],
    ["https://user:pass@fcm.googleapis.com/x", "com credenciais"],
    ["https://fcm.googleapis.com:8443/x", "com porta"],
    ["https://fcm.googleapis.com./x", "ponto final no host"],
    ["https://127.0.0.1/x", "loopback"],
    ["https://169.254.169.254/latest/meta-data", "metadados de nuvem"],
    ["https://localhost/x", "localhost"],
    ["https://[::1]/x", "loopback IPv6"],
    ["https://push.exemplo/abc", "serviço desconhecido"],
    ["javascript:alert(1)", "esquema que não é http"],
    ["texto solto", "não é URL"],
    ["", "vazio"],
  ])("recusa %s (%s)", (endpoint) => {
    expect(endpointDePushPermitido(endpoint)).toBe(false);
  });
});
