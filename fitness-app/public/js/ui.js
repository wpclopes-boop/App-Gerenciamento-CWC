// Helpers de interface: escape, formatacao, toasts, modais e graficos.

export function esc(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export const num = (v, casas = 0) => (v === null || v === undefined || Number.isNaN(v)
  ? '—'
  : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));

export const hoje = () => new Date().toISOString().slice(0, 10);

export function dataCurta(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
}

export function toast(mensagem, tipo = 'ok') {
  const caixa = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = mensagem;
  caixa.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export const erroToast = (e) => toast(e?.message || 'Algo deu errado', 'erro');

// Modal com formulario simples: campos = [{nome, rotulo, tipo, valor, opcoes, obrigatorio, passo}]
export function modalFormulario({ titulo, campos, textoConfirmar = 'Salvar' }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <h3>${esc(titulo)}</h3>
        <form id="modal-form" class="auth-form">
          ${campos.map((campo) => {
            const comum = `name="${esc(campo.nome)}" ${campo.obrigatorio ? 'required' : ''}`;
            if (campo.tipo === 'select') {
              return `<label class="field">${esc(campo.rotulo)}
                <select ${comum}>${campo.opcoes.map((o) => `
                  <option value="${esc(o.valor)}" ${String(o.valor) === String(campo.valor ?? '') ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('')}
                </select></label>`;
            }
            if (campo.tipo === 'textarea') {
              return `<label class="field">${esc(campo.rotulo)}
                <textarea rows="3" ${comum}>${esc(campo.valor ?? '')}</textarea></label>`;
            }
            return `<label class="field">${esc(campo.rotulo)}
              <input type="${esc(campo.tipo || 'text')}" ${comum}
                ${campo.passo ? `step="${esc(campo.passo)}"` : ''}
                value="${esc(campo.valor ?? '')}"></label>`;
          }).join('')}
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="modal-cancelar">Cancelar</button>
            <button type="submit" class="btn btn-primary">${esc(textoConfirmar)}</button>
          </div>
        </form>
      </div>`;

    const fechar = (resultado) => { backdrop.remove(); resolve(resultado); };
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) fechar(null); });
    backdrop.querySelector('#modal-cancelar').addEventListener('click', () => fechar(null));
    backdrop.querySelector('#modal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      fechar(Object.fromEntries(new FormData(e.target).entries()));
    });
    document.body.appendChild(backdrop);
    backdrop.querySelector('input, select, textarea')?.focus();
  });
}

export function confirmar(mensagem) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <h3>Confirmar</h3>
        <p style="font-size:0.84rem;color:var(--text)">${esc(mensagem)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="nao">Cancelar</button>
          <button class="btn btn-danger" id="sim">Excluir</button>
        </div>
      </div>`;
    const fechar = (v) => { backdrop.remove(); resolve(v); };
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) fechar(false); });
    backdrop.querySelector('#nao').addEventListener('click', () => fechar(false));
    backdrop.querySelector('#sim').addEventListener('click', () => fechar(true));
    document.body.appendChild(backdrop);
  });
}

// Barra de meta x consumo.
export function barraMetrica({ rotulo, valor, meta, unidade = '', cor = '' }) {
  const pct = meta ? Math.min(100, Math.round((valor / meta) * 100)) : 0;
  const excedeu = meta && valor > meta;
  return `
    <div class="metric">
      <div class="metric-head">
        <span class="muted">${esc(rotulo)}</span>
        <span><b>${num(valor, unidade === 'g' ? 1 : 0)}</b>${esc(unidade)}
          <span class="muted"> / ${meta ? num(meta, 0) + esc(unidade) : '—'}</span></span>
      </div>
      <div class="bar ${esc(cor)} ${excedeu ? 'over' : ''}"><span style="width:${pct}%"></span></div>
    </div>`;
}

const graficos = new Map();

// Cria/atualiza um grafico Chart.js no canvas informado.
export function grafico(idCanvas, config) {
  const canvas = document.getElementById(idCanvas);
  if (!canvas || typeof Chart === 'undefined') return;
  graficos.get(idCanvas)?.destroy();
  Chart.defaults.color = 'rgba(240,237,228,0.5)';
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  graficos.set(idCanvas, new Chart(canvas, config));
}
