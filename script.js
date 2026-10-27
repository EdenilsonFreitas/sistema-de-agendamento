// ---------- Dados ----------
const SERVICOS = [
  { id: "corte",  nome: "Corte",          preco: 40, min: 30 },
  { id: "barba",  nome: "Barba",          preco: 30, min: 30 },
  { id: "combo",  nome: "Corte + barba",  preco: 65, min: 60 },
  { id: "sobrancelha", nome: "Sobrancelha", preco: 15, min: 30 },
];
const BARBEIROS = ["Rafael", "Diego", "Marcos"];
const ABRE = 9, FECHA = 19;      // horário de funcionamento
const CHAVE = "barbearia:agendamentos";

// ---------- Estado ----------
let agendamentos = carregar();
let horaEscolhida = null;

const $ = (id) => document.getElementById(id);
const el = {
  form: $("form"), servicos: $("servicos"), barbeiros: $("barbeiros"),
  data: $("data"), horarios: $("horarios"), nome: $("nome"),
  telefone: $("telefone"), erro: $("erro"), lista: $("lista"), aviso: $("aviso"),
};

// ---------- Armazenamento ----------
function carregar() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || []; }
  catch { return []; }
}
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(agendamentos)); }
  catch { /* sem armazenamento: os dados valem só nesta sessão */ }
}

// ---------- Utilidades ----------
const minutos = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso) => iso.split("-").reverse().join("/");
const servicoPorId = (id) => SERVICOS.find((s) => s.id === id);
const valor = (nome) => (el.form.querySelector(`input[name="${nome}"]:checked`) || {}).value;

function hojeISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function ehDomingo(iso) {
  return new Date(iso + "T12:00:00").getDay() === 0;
}
function mostrarAviso(texto) {
  el.aviso.textContent = texto;
  el.aviso.hidden = false;
  clearTimeout(mostrarAviso.t);
  mostrarAviso.t = setTimeout(() => (el.aviso.hidden = true), 3500);
}

// ---------- Renderização do formulário ----------
function criarOpcoes(container, nome, itens) {
  container.innerHTML = itens.map((i, idx) => `
    <label class="opcao">
      <input type="radio" name="${nome}" value="${i.valor}" ${idx === 0 ? "" : ""}>
      <span>${i.titulo}${i.detalhe ? `<small>${i.detalhe}</small>` : ""}</span>
    </label>`).join("");
}

criarOpcoes(el.servicos, "servico", SERVICOS.map((s) => ({
  valor: s.id, titulo: s.nome, detalhe: `${brl(s.preco)} · ${s.min} min`,
})));
criarOpcoes(el.barbeiros, "barbeiro", BARBEIROS.map((b) => ({ valor: b, titulo: b })));

el.data.min = hojeISO();

// ---------- Horários ----------
// Um horário está livre se o intervalo do serviço não colide com outro agendamento do barbeiro.
function horarioLivre(barbeiro, data, inicio, duracao) {
  return !agendamentos.some((a) => {
    if (a.barbeiro !== barbeiro || a.data !== data) return false;
    const ini = minutos(a.hora);
    const fim = ini + servicoPorId(a.servico).min;
    return inicio < fim && ini < inicio + duracao;
  });
}

function atualizarHorarios() {
  const servico = servicoPorId(valor("servico"));
  const barbeiro = valor("barbeiro");
  const data = el.data.value;
  horaEscolhida = null;

  if (!servico || !barbeiro || !data) {
    el.horarios.innerHTML = `<p class="dica">Escolha serviço, barbeiro e data para ver os horários.</p>`;
    return;
  }
  if (ehDomingo(data)) {
    el.horarios.innerHTML = `<p class="dica">Fechado aos domingos. Escolha outra data.</p>`;
    return;
  }

  const agora = new Date();
  const hoje = data === hojeISO();
  const botoes = [];
  for (let m = ABRE * 60; m + servico.min <= FECHA * 60; m += 30) {
    const passou = hoje && m <= agora.getHours() * 60 + agora.getMinutes();
    const livre = !passou && horarioLivre(barbeiro, data, m, servico.min);
    botoes.push(`<button type="button" class="horario" data-hora="${hhmm(m)}" aria-pressed="false" ${livre ? "" : "disabled"}>${hhmm(m)}</button>`);
  }
  el.horarios.innerHTML = botoes.join("");
}

el.horarios.addEventListener("click", (e) => {
  const b = e.target.closest(".horario");
  if (!b || b.disabled) return;
  horaEscolhida = b.dataset.hora;
  el.horarios.querySelectorAll(".horario").forEach((x) =>
    x.setAttribute("aria-pressed", String(x === b)));
});

el.form.addEventListener("change", (e) => {
  if (e.target.name === "servico" || e.target.name === "barbeiro" || e.target.id === "data") {
    atualizarHorarios();
  }
});

// ---------- Máscara de telefone ----------
el.telefone.addEventListener("input", () => {
  const n = el.telefone.value.replace(/\D/g, "").slice(0, 11);
  el.telefone.value = n
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
});

// ---------- Envio ----------
function validar() {
  if (!valor("servico")) return "Escolha um serviço.";
  if (!valor("barbeiro")) return "Escolha um barbeiro.";
  if (!el.data.value) return "Escolha uma data.";
  if (el.data.value < hojeISO()) return "Escolha uma data de hoje em diante.";
  if (ehDomingo(el.data.value)) return "A barbearia não abre aos domingos.";
  if (!horaEscolhida) return "Escolha um horário.";
  if (el.nome.value.trim().length < 2) return "Informe seu nome.";
  if (el.telefone.value.replace(/\D/g, "").length < 10) return "Informe um WhatsApp com DDD.";
  return "";
}

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = validar();
  el.erro.hidden = !msg;
  el.erro.textContent = msg;
  if (msg) return;

  const servico = servicoPorId(valor("servico"));
  // Confere de novo: outro agendamento pode ter ocupado o horário
  if (!horarioLivre(valor("barbeiro"), el.data.value, minutos(horaEscolhida), servico.min)) {
    el.erro.hidden = false;
    el.erro.textContent = "Esse horário acabou de ser ocupado. Escolha outro.";
    atualizarHorarios();
    return;
  }

  agendamentos.push({
    id: Date.now().toString(36),
    servico: servico.id,
    barbeiro: valor("barbeiro"),
    data: el.data.value,
    hora: horaEscolhida,
    nome: el.nome.value.trim(),
    telefone: el.telefone.value,
  });
  salvar();
  mostrarAviso(`Agendado: ${servico.nome} em ${dataBR(el.data.value)} às ${horaEscolhida}.`);
  el.form.reset();
  el.data.min = hojeISO();
  atualizarHorarios();
  renderLista();
});

// ---------- Lista de agendamentos ----------
function renderLista() {
  const ordenados = [...agendamentos].sort((a, b) =>
    (a.data + a.hora).localeCompare(b.data + b.hora));

  if (!ordenados.length) {
    el.lista.innerHTML = `<li class="vazio">Nenhum agendamento ainda. Preencha o formulário para criar o primeiro.</li>`;
    return;
  }
  el.lista.innerHTML = ordenados.map((a) => {
    const s = servicoPorId(a.servico);
    return `
      <li>
        <div>
          <strong>${dataBR(a.data)} às ${a.hora}</strong>
          <span>${s.nome} com ${a.barbeiro} · ${brl(s.preco)}</span><br>
          <span>${escapar(a.nome)} · ${escapar(a.telefone)}</span>
        </div>
        <button class="cancelar" data-id="${a.id}" aria-label="Cancelar agendamento de ${escapar(a.nome)}">Cancelar</button>
      </li>`;
  }).join("");
}

function escapar(t) {
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML;
}

el.lista.addEventListener("click", (e) => {
  const b = e.target.closest(".cancelar");
  if (!b) return;
  agendamentos = agendamentos.filter((a) => a.id !== b.dataset.id);
  salvar();
  renderLista();
  atualizarHorarios();
  mostrarAviso("Agendamento cancelado.");
});

renderLista();