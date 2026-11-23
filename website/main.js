import { createDemoMachine } from "./demo-machine.mjs";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileNavigation = window.matchMedia("(max-width: 760px)");
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");

if (menuButton && navigation) {
  const closeMenu = (restoreFocus = false) => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.querySelector(".menu-label").textContent = "Menu";
    navigation.classList.remove("is-open");
    navigation.inert = mobileNavigation.matches;
    if (restoreFocus) menuButton.focus();
  };
  const syncMenu = () => {
    menuButton.hidden = !mobileNavigation.matches;
    closeMenu();
  };
  document.documentElement.classList.add("navigation-ready");
  syncMenu();
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    if (!open) return closeMenu();
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.querySelector(".menu-label").textContent = "Fechar";
    navigation.inert = false;
    navigation.classList.add("is-open");
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menuButton.getAttribute("aria-expanded") === "true"
    )
      closeMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (
      !navigation.contains(event.target) &&
      !menuButton.contains(event.target)
    )
      closeMenu();
  });
  document.addEventListener("focusin", (event) => {
    if (
      !navigation.contains(event.target) &&
      !menuButton.contains(event.target)
    )
      closeMenu();
  });
  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });
  mobileNavigation.addEventListener("change", syncMenu);
}

// Anchors work without JS; enhancement moves focus to the destination.
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", () => {
    const target = document.querySelector(anchor.getAttribute("href"));
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
  });
});

const hero = document.querySelector(".hero");
const replay = document.querySelector("#replay-hero");
let heroTimers = [];
const heroFrames = [
  [
    "Vamos começar?",
    "Aproxime seu cartão para continuar.",
    "Apresentar cartão",
    "Aguardando cartão",
    "Uma sequência ilustrativa.",
  ],
  [
    "Cartão apresentado",
    "Verificando o cartão de exemplo…",
    "Verificando…",
    "Cartão reconhecido",
    "A confirmação ainda é necessária.",
  ],
  [
    "Confirme seu acesso",
    "Use o PIN de exemplo: 1234.",
    "Confirmar PIN",
    "Confirmação adicional",
    "Seu PIN é uma etapa separada.",
  ],
  [
    "Tudo pronto.",
    "Agora você pode conhecer o perfil de exemplo.",
    "Perfil de exemplo",
    "Etapas concluídas",
    "Resultado ilustrativo. Sem login real.",
  ],
];
const setHeroFrame = (index) => {
  const [heading, copy, action, notice, detail] = heroFrames[index];
  hero.querySelector(".app-title").textContent = heading;
  hero.querySelector(".app-description").textContent = copy;
  hero.querySelector(".app-action span").textContent = action;
  hero.querySelector(".scene-notification strong").textContent = notice;
  hero.querySelector(".scene-notification div > span").textContent = detail;
  hero.dataset.frame = String(index);
};
const finishHero = () => {
  heroTimers.forEach(clearTimeout);
  heroTimers = [];
  hero.classList.remove("is-animating");
  setHeroFrame(3);
  replay.disabled = false;
  replay.textContent = "Rever animação";
};
const playHero = () => {
  if (reducedMotion.matches) return finishHero();
  finishHero();
  setHeroFrame(0);
  void hero.offsetWidth;
  hero.classList.add("is-animating");
  replay.disabled = true;
  replay.textContent = "Animação em andamento";
  heroTimers = [
    window.setTimeout(() => setHeroFrame(1), 1500),
    window.setTimeout(() => setHeroFrame(2), 2400),
    window.setTimeout(() => setHeroFrame(3), 3500),
    window.setTimeout(finishHero, 4400),
  ];
};
if (hero && replay) {
  replay.hidden = reducedMotion.matches;
  replay.addEventListener("click", playHero);
  playHero();
  reducedMotion.addEventListener("change", () => {
    replay.hidden = reducedMotion.matches;
    if (reducedMotion.matches) finishHero();
  });
}

const diagram = document.querySelector(".architecture-flow");
if (diagram && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        if (!reducedMotion.matches) diagram.classList.add("diagram-arrived");
        observer.disconnect();
      }
    },
    { threshold: 0.25 },
  );
  observer.observe(diagram);
}

const textToggle = document.querySelector("#type-preview-toggle");
if (textToggle) {
  textToggle.hidden = false;
  textToggle.addEventListener("click", () => {
    const enlarged = textToggle.getAttribute("aria-pressed") !== "true";
    textToggle.setAttribute("aria-pressed", String(enlarged));
    textToggle.querySelector("[aria-hidden]").textContent = enlarged
      ? "A−"
      : "A+";
    textToggle.querySelector(".sr-only").textContent = enlarged
      ? "Restaurar texto do exemplo"
      : "Aumentar texto do exemplo";
    document
      .querySelector("#type-preview-text")
      .classList.toggle("enlarged", enlarged);
  });
}

const panel = document.querySelector("#demo-panel");
if (panel) {
  const primary = document.querySelector("#demo-primary");
  const reset = document.querySelector("#demo-reset");
  const invalid = document.querySelector("#demo-invalid");
  const fill = document.querySelector("#demo-fill-pin");
  const title = document.querySelector("#demo-status-title");
  const description = document.querySelector("#demo-status-description");
  const kicker = document.querySelector("#demo-status-kicker");
  const views = ["card", "pin", "success"].map((name) =>
    document.querySelector(`#demo-${name}-view`),
  );
  const messages = {
    waiting: [
      "PASSO 01 DE 03",
      "Vamos apresentar seu cartão?",
      "Toque no botão abaixo para iniciar a experiência fictícia.",
      "Apresentar cartão fictício",
    ],
    presented: [
      "PASSO 01 DE 03",
      "Cartão de exemplo apresentado.",
      "Agora vamos simular a verificação do cartão.",
      "Cartão apresentado",
    ],
    processing: [
      "PASSO 01 DE 03",
      "Simulando a verificação…",
      "Esta animação representa uma etapa. Nenhum dado é enviado.",
      "Verificando exemplo…",
    ],
    invalid: [
      "VAMOS TENTAR DE NOVO",
      "Este cartão fictício não é válido.",
      "No aplicativo, um cartão inválido não permite continuar. Experimente agora o cartão válido.",
      "Usar cartão válido",
    ],
    pin: [
      "PASSO 02 DE 03",
      "Uma confirmação antes de continuar.",
      "Digite 1234 no teclado de exemplo e confirme.",
      "Confirmar PIN fictício",
    ],
    "pin-error": [
      "TENTE NOVAMENTE",
      "O PIN de exemplo não corresponde.",
      "Tudo bem. Use 1234 para continuar esta demonstração.",
      "Confirmar PIN fictício",
    ],
    confirming: [
      "PASSO 02 DE 03",
      "Conferindo o exemplo…",
      "A confirmação é simulada, somente nesta página.",
      "Conferindo…",
    ],
    success: [
      "PASSO 03 DE 03",
      "Você completou a demonstração.",
      "No aplicativo, a confirmação permite seguir para os recursos disponíveis.",
      "Experimentar novamente",
    ],
  };
  let previousState = "waiting";
  const render = ({ state, digits }) => {
    const changed = previousState !== state;
    const pinVisible = ["pin", "pin-error", "confirming"].includes(state);
    const busy = ["presented", "processing", "confirming"].includes(state);
    const view = state === "success" ? 2 : pinVisible ? 1 : 0;
    const activeBefore = document.activeElement;
    panel.dataset.state = state;
    views.forEach((element, index) => {
      element.hidden = index !== view;
    });
    const message = messages[state];
    if (changed || state === "waiting") {
      kicker.textContent = message[0];
      title.textContent = message[1];
      description.textContent = message[2];
    }
    primary.textContent = message[3];
    primary.disabled = busy || (pinVisible && digits.length !== 4);
    reset.hidden = state === "waiting" || state === "success";
    invalid.hidden = state !== "waiting";
    fill.hidden = !pinVisible || busy;
    document.querySelectorAll(".pin-keypad button").forEach((button) => {
      button.disabled = busy;
    });
    document.querySelectorAll("#pin-digits i").forEach((slot, index) => {
      slot.classList.toggle("filled", index < digits.length);
    });
    document.querySelector("#pin-count").textContent =
      `${digits.length} de 4 números preenchidos.`;
    const step = state === "success" ? "success" : pinVisible ? "pin" : "card";
    const order = ["card", "pin", "success"];
    document.querySelectorAll("[data-progress]").forEach((item) => {
      const current = item.dataset.progress === step;
      if (current) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
      item.classList.toggle(
        "is-complete",
        order.indexOf(item.dataset.progress) < order.indexOf(step),
      );
    });
    if (changed && busy && panel.contains(activeBefore)) {
      // Disabling the active action otherwise drops keyboard focus to the body.
      reset.focus({ preventScroll: true });
    } else if (changed && !busy && panel.contains(activeBefore)) {
      if (state === "pin" && previousState === "processing")
        document
          .querySelector('[data-digit="1"]')
          .focus({ preventScroll: true });
      else if (state === "pin-error")
        document
          .querySelector('[data-digit="1"]')
          .focus({ preventScroll: true });
      else if (["waiting", "invalid", "success"].includes(state))
        primary.focus({ preventScroll: true });
    }
    previousState = state;
  };
  const machine = createDemoMachine({ onChange: render });
  primary.addEventListener("click", () => {
    const { state } = machine.snapshot();
    if (state === "success") machine.reset();
    else if (["waiting", "invalid"].includes(state)) machine.present();
    else machine.confirm();
  });
  reset.addEventListener("click", machine.reset);
  invalid.addEventListener("click", () => machine.present(false));
  fill.addEventListener("click", machine.fillExample);
  document
    .querySelectorAll("[data-digit]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        machine.digit(button.dataset.digit),
      ),
    );
  document
    .querySelector("#pin-delete")
    .addEventListener("click", machine.erase);
  document.querySelector("#pin-clear").addEventListener("click", machine.clear);
  document.querySelector(".pin-keypad").addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      machine.digit(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      machine.erase();
    } else if (event.key === "Delete") {
      event.preventDefault();
      machine.clear();
    }
  });
  window.addEventListener("pagehide", () => machine.reset());
  render(machine.snapshot());
  document.querySelector("#demo-controls").hidden = false;
  document.querySelector("#demo-js-fallback").hidden = true;
}
