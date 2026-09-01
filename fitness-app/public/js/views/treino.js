// Treino: fichas, exercicios e registro de cargas com PR.
import { api, qs } from '../api.js';
import { esc, num, dataCurta, toast, erroToast, modalFormulario, confirmar } from '../ui.js';

let abaAtiva = null; // id da ficha ou 'biblioteca'
let exerciciosCache = [];

export async function render(container) {
  const [{ treinos }, { exercicios }, { series }] = await Promise.all([
    api.get('/api/treinos'),
    api.get('/api/exercicios'),
    api.get(`/api/series${qs({ limite: 500 })}`),
  ]);
  exerciciosCache = exercicios;

  if (abaAtiva === null) abaAtiva = treinos[0]?.id ?? 'biblioteca';
  const existe = abaAtiva === 'biblioteca' || treinos.some((t) => t.id === abaAtiva);
  if (!existe) abaAtiva = treinos[0]?.id ?? 'biblioteca';

  const porExercicio = new Map();
  for (const serie of series) {
    if (!porExercicio.has(serie.exercicio_id)) porExercicio.set(serie.exercicio_id, []);
    porExercicio.get(serie.exercicio_id).push(serie);
  }

  container.innerHTML = `
    <div class="shdr">
      <h2>Treino</h2>
      <p>Suas fichas, cargas e recordes</p>
    </div>
    <div class="dtabs">
      ${treinos.map((t) => `
        <div class="dtab ${t.cor === 'blue' ? 'blue' : t.cor === 'purple' ? 'purple' : ''} ${abaAtiva === t.id ? 'on' : ''}"
             data-ficha="${t.id}">
          ${t.letra ? `${esc(t.letra)} · ` : ''}${esc(t.nome)}
          <small>${t.itens.length} exercícios</small>
        </div>`).join('')}
      <div class="dtab green ${abaAtiva === 'biblioteca' ? 'on' : ''}" data-ficha="biblioteca">
        📚 Biblioteca<small>${exercicios.length} exercícios</small>
      </div>
    </div>
    <div class="row" style="margin-bottom:14px">
      <button class="btn btn-primary btn-sm" id="btn-nova-ficha">+ Nova ficha</button>
      ${abaAtiva !== 'biblioteca' ? `
        <button class="btn btn-sm" id="btn-add-exercicio">+ Exercício nesta ficha</button>
        <div class="spacer"></div>
        <button class="btn btn-sm btn-ghost" id="btn-editar-ficha">Editar ficha</button>
        <button class="btn btn-sm btn-danger" id="btn-excluir-ficha">Excluir ficha</button>` : ''}
    </div>
    <div id="treino-conteudo"></div>`;

  const recarregar = () => render(container).catch(erroToast);

  container.querySelectorAll('[data-ficha]').forEach((el) => el.addEventListener('click', () => {
    abaAtiva = el.dataset.ficha === 'biblioteca' ? 'biblioteca' : Number(el.dataset.ficha);
    recarregar();
  }));

  container.querySelector('#btn-nova-ficha').addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: 'Nova ficha de treino',
      campos: [
        { nome: 'nome', rotulo: 'Nome', tipo: 'text', obrigatorio: true, valor: 'Treino D' },
        { nome: 'letra', rotulo: 'Letra', tipo: 'text', valor: 'D' },
        { nome: 'cor', rotulo: 'Cor', tipo: 'select', valor: 'fire', opcoes: [
          { valor: 'fire', rotulo: 'Laranja' }, { valor: 'blue', rotulo: 'Azul' }, { valor: 'purple', rotulo: 'Roxo' },
        ] },
      ],
    });
    if (!dados) return;
    try {
      const r = await api.post('/api/treinos', dados);
      abaAtiva = r.treino.id;
      toast('Ficha criada');
      recarregar();
    } catch (e) { erroToast(e); }
  });

  const conteudo = container.querySelector('#treino-conteudo');
  if (abaAtiva === 'biblioteca') {
    renderBiblioteca(conteudo, exercicios, recarregar);
    return;
  }

  const ficha = treinos.find((t) => t.id === abaAtiva);
  renderFicha(conteudo, ficha, porExercicio, recarregar);

  container.querySelector('#btn-add-exercicio').addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: `Adicionar exercício em ${ficha.nome}`,
      campos: [
        { nome: 'exercicio_id', rotulo: 'Exercício', tipo: 'select', obrigatorio: true,
          opcoes: exercicios.map((e) => ({ valor: e.id, rotulo: `${e.nome} — ${e.grupo_muscular || ''}` })) },
        { nome: 'series', rotulo: 'Séries', tipo: 'text', valor: '3' },
        { nome: 'repeticoes', rotulo: 'Repetições', tipo: 'text', valor: '10-12' },
        { nome: 'descanso', rotulo: 'Descanso', tipo: 'text', valor: '60s' },
      ],
    });
    if (!dados) return;
    try {
      await api.post(`/api/treinos/${ficha.id}/itens`, { ...dados, exercicio_id: Number(dados.exercicio_id) });
      toast('Exercício adicionado');
      recarregar();
    } catch (e) { erroToast(e); }
  });

  container.querySelector('#btn-editar-ficha').addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: 'Editar ficha',
      campos: [
        { nome: 'nome', rotulo: 'Nome', tipo: 'text', valor: ficha.nome, obrigatorio: true },
        { nome: 'letra', rotulo: 'Letra', tipo: 'text', valor: ficha.letra },
        { nome: 'cor', rotulo: 'Cor', tipo: 'select', valor: ficha.cor, opcoes: [
          { valor: 'fire', rotulo: 'Laranja' }, { valor: 'blue', rotulo: 'Azul' }, { valor: 'purple', rotulo: 'Roxo' },
        ] },
        { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', valor: ficha.observacoes },
      ],
    });
    if (!dados) return;
    try { await api.put(`/api/treinos/${ficha.id}`, dados); toast('Ficha atualizada'); recarregar(); } catch (e) { erroToast(e); }
  });

  container.querySelector('#btn-excluir-ficha').addEventListener('click', async () => {
    if (!(await confirmar(`Excluir a ficha "${ficha.nome}"? Os registros de carga são mantidos.`))) return;
    try { await api.del(`/api/treinos/${ficha.id}`); abaAtiva = null; toast('Ficha excluída'); recarregar(); } catch (e) { erroToast(e); }
  });
}

function renderFicha(alvo, ficha, porExercicio, recarregar) {
  if (!ficha) { alvo.innerHTML = '<div class="card"><div class="empty">Crie uma ficha para começar.</div></div>'; return; }

  alvo.innerHTML = `
    ${ficha.observacoes ? `<div class="card"><div class="muted">${esc(ficha.observacoes)}</div></div>` : ''}
    <div class="ex-grid">
      ${ficha.itens.map((item) => {
        const registros = porExercicio.get(item.exercicio_id) || [];
        const recorde = item.recorde;
        return `
        <div class="ex-card">
          <div class="ex-head">
            <div class="ex-name">${esc(item.exercicio_nome)}</div>
            <div class="ex-muscle">${esc(item.grupo_muscular || '—')}</div>
          </div>
          <div class="ex-body">
            <div class="ex-chips">
              <span class="chip s">${esc(item.series)} séries</span>
              <span class="chip r">${esc(item.repeticoes)} reps</span>
              <span class="chip d">${esc(item.descanso)}</span>
            </div>
            <div class="prog-log">
              <div class="prog-log-title">
                📈 Registro de carga
                ${recorde ? `<span class="pr-badge">PR ${num(recorde.peso, 1)}kg</span>` : ''}
              </div>
              <div class="prog-entries">
                ${registros.length ? registros.slice(0, 8).map((s) => `
                  <div class="prog-entry">
                    <span class="pe-date">${dataCurta(s.data)}</span>
                    <span class="pe-val">${num(s.peso, 1)}kg × ${num(s.repeticoes)}${recorde && s.peso === recorde.peso ? ' 🏆' : ''}</span>
                    <button class="icon-del" data-del-serie="${s.id}">✕</button>
                  </div>`).join('') : '<div class="empty">Nenhum registro ainda</div>'}
              </div>
              <form class="prog-form" data-registrar="${item.exercicio_id}" data-treino="${ficha.id}">
                <input type="number" step="0.5" min="0" name="peso" placeholder="Peso (kg)" required>
                <input type="number" min="1" name="repeticoes" placeholder="Reps" required>
                <button class="btn btn-primary btn-sm" type="submit">+ Log</button>
              </form>
              <div class="row" style="margin-top:6px">
                <button class="btn btn-sm btn-ghost" data-edit-item="${item.id}"
                  data-series="${esc(item.series)}" data-reps="${esc(item.repeticoes)}" data-descanso="${esc(item.descanso)}">editar</button>
                <button class="btn btn-sm btn-danger" data-del-item="${item.id}">remover</button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('') || '<div class="card"><div class="empty">Nenhum exercício nesta ficha.</div></div>'}
    </div>`;

  alvo.querySelectorAll('[data-registrar]').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form).entries());
    try {
      const r = await api.post('/api/series', {
        exercicio_id: Number(form.dataset.registrar),
        treino_id: Number(form.dataset.treino),
        peso: Number(dados.peso),
        repeticoes: Number(dados.repeticoes),
      });
      toast(r.novo_recorde ? '🏆 Novo recorde!' : 'Carga registrada');
      recarregar();
    } catch (erro) { erroToast(erro); }
  }));

  alvo.querySelectorAll('[data-del-serie]').forEach((botao) => botao.addEventListener('click', async () => {
    try { await api.del(`/api/series/${botao.dataset.delSerie}`); recarregar(); } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-edit-item]').forEach((botao) => botao.addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: 'Editar exercício da ficha',
      campos: [
        { nome: 'series', rotulo: 'Séries', tipo: 'text', valor: botao.dataset.series },
        { nome: 'repeticoes', rotulo: 'Repetições', tipo: 'text', valor: botao.dataset.reps },
        { nome: 'descanso', rotulo: 'Descanso', tipo: 'text', valor: botao.dataset.descanso },
      ],
    });
    if (!dados) return;
    try { await api.put(`/api/treino-itens/${botao.dataset.editItem}`, dados); recarregar(); } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-del-item]').forEach((botao) => botao.addEventListener('click', async () => {
    if (!(await confirmar('Remover este exercício da ficha?'))) return;
    try { await api.del(`/api/treino-itens/${botao.dataset.delItem}`); recarregar(); } catch (e) { erroToast(e); }
  }));
}

function renderBiblioteca(alvo, exercicios, recarregar) {
  alvo.innerHTML = `
    <div class="row" style="margin-bottom:12px">
      <label class="field" style="max-width:260px">Buscar
        <input type="search" id="busca-exercicio" placeholder="Ex.: supino, agachamento…">
      </label>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-sm" id="btn-novo-exercicio">+ Novo exercício</button>
    </div>
    <div class="card">
      <div class="table-scroll">
      <table class="data" id="tabela-exercicios">
        <thead><tr><th>Exercício</th><th>Grupo</th><th>Equipamento</th><th>Recorde</th><th>Séries feitas</th><th></th></tr></thead>
        <tbody>
          ${exercicios.map((e) => `
            <tr data-nome="${esc(e.nome.toLowerCase())}">
              <td>${esc(e.nome)}</td>
              <td>${esc(e.grupo_muscular || '—')}</td>
              <td>${esc(e.equipamento || '—')}</td>
              <td class="gd">${e.recorde ? `${num(e.recorde.peso, 1)}kg × ${num(e.recorde.repeticoes)}` : '—'}</td>
              <td>${num(e.total_series || 0)}</td>
              <td class="row" style="justify-content:flex-end;flex-wrap:nowrap">
                <button class="btn btn-sm btn-ghost" data-edit-exercicio="${e.id}">editar</button>
                <button class="icon-del" data-del-exercicio="${e.id}">✕</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>`;

  alvo.querySelector('#busca-exercicio').addEventListener('input', (e) => {
    const termo = e.target.value.trim().toLowerCase();
    alvo.querySelectorAll('#tabela-exercicios tbody tr').forEach((linha) => {
      linha.classList.toggle('hidden', termo && !linha.dataset.nome.includes(termo));
    });
  });

  const campos = (ex = {}) => [
    { nome: 'nome', rotulo: 'Nome', tipo: 'text', valor: ex.nome, obrigatorio: true },
    { nome: 'grupo_muscular', rotulo: 'Grupo muscular', tipo: 'text', valor: ex.grupo_muscular },
    { nome: 'equipamento', rotulo: 'Equipamento', tipo: 'text', valor: ex.equipamento },
  ];

  alvo.querySelector('#btn-novo-exercicio').addEventListener('click', async () => {
    const dados = await modalFormulario({ titulo: 'Novo exercício', campos: campos() });
    if (!dados) return;
    try { await api.post('/api/exercicios', dados); toast('Exercício criado'); recarregar(); } catch (e) { erroToast(e); }
  });

  alvo.querySelectorAll('[data-edit-exercicio]').forEach((botao) => botao.addEventListener('click', async () => {
    const exercicio = exerciciosCache.find((e) => e.id === Number(botao.dataset.editExercicio));
    const dados = await modalFormulario({ titulo: 'Editar exercício', campos: campos(exercicio) });
    if (!dados) return;
    try { await api.put(`/api/exercicios/${exercicio.id}`, dados); recarregar(); } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-del-exercicio]').forEach((botao) => botao.addEventListener('click', async () => {
    if (!(await confirmar('Excluir o exercício? Os registros de carga dele também serão apagados.'))) return;
    try { await api.del(`/api/exercicios/${botao.dataset.delExercicio}`); recarregar(); } catch (e) { erroToast(e); }
  }));
}
