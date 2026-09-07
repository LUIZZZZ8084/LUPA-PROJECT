/**
 * Service worker da Lupa.
 *
 * Existe por duas razões que compartilham o mesmo arquivo: receber
 * notificação push (#48) e ser o requisito de instalação do app no
 * iPhone, que é o que o APK/TWA depende.
 *
 * **Não faz cache.** É deliberado: o app é todo atrás de login e servido
 * pela Vercel, e um cache mal desenhado aqui é como se mostra a alguém a
 * vaga de ontem como se fosse a de hoje — ou pior, o conteúdo da sessão de
 * outra pessoa no mesmo aparelho. Se um dia o offline valer a pena, é
 * decisão à parte, com regra escrita sobre o que pode ser guardado.
 */

self.addEventListener("install", () => {
  // Assume o controle sem esperar a aba antiga fechar. Sem isto, a primeira
  // inscrição depois de instalar falharia por não haver worker ativo.
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("push", (evento) => {
  if (!evento.data) return;

  let aviso;
  try {
    aviso = evento.data.json();
  } catch {
    // Payload que não é JSON não vira notificação vazia: melhor nada do
    // que um balão em branco no telefone de alguém.
    return;
  }

  const { titulo, corpo, url } = aviso;
  if (!titulo) return;

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo ?? "",
      icon: "/icon",
      badge: "/icon",
      // Agrupa por destino: dez vagas novas não viram dez balões
      // empilhados, viram um que a pessoa toca uma vez.
      tag: url ?? "/",
      data: { url: url ?? "/" },
      lang: "pt-BR",
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();

  const destino = evento.notification.data?.url ?? "/";

  /*
   * Reaproveita a aba já aberta em vez de abrir outra.
   *
   * Quem está com a Lupa aberta e toca no aviso espera ir para a vaga, não
   * ganhar uma segunda janela do mesmo app — e em celular antigo cada aba a
   * mais custa memória.
   */
  evento.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((abas) => {
        for (const aba of abas) {
          if (new URL(aba.url).origin === self.location.origin) {
            return aba.navigate(destino).then((a) => a?.focus());
          }
        }
        return self.clients.openWindow(destino);
      }),
  );
});
