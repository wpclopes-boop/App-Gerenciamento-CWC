// Dieta: diario do dia, planos alimentares e tabela de alimentos.
import { api, qs } from '../api.js';
import { esc, num, hoje, toast, erroToast, modalFormulario, confirmar, barraMetrica } from '../ui.js';

let aba = 'diario';
let dataSelecionada = hoje();
let alimentosCache = [];

const opcoesAlimentos = () => alimentosCache.map((a) => ({
  valor: a.id,
  rotulo: `${a.nome} (${a.kcal} kcal / ${num(a.porcao_base, 0)}${a.unidade})`,
}));

async function carregarAlimentos() {
  alimentosCache = (await api.get('/api/alimentos')).alimentos;
  return alimentosCache;
}

export async function render(container) {
  await carregarAlimentos();
  container.innerHTML = `
    <div class="shdr">
      <h2>Dieta</h2>
      <p>Registre o que comeu, siga seus planos e controle os macros</p>
    </div>
    <div class="dtabs">
      <div class="dtab ${aba === 'diario' ? 'on' : ''}" data-aba="diario">🍽️ Diário<small>o que você comeu</small></div>
      <div class="dtab blue ${aba === 'planos' ? 'on' : ''}" data-aba="planos">📋 Planos<small>dias modelo</small></div>
      <div class="dtab purple ${aba === 'alimentos' ? 'on' : ''}" data-aba="alimentos">🥗 Alimentos<small>tabela de macros</small></div>
    </div>
    <div id="dieta-conteudo"></div>`;

  container.querySelectorAll('[data-aba]').forEach((el) => {
    el.addEventListener('click', () => { aba = el.dataset.aba; render(container).catch(erroToast); });
  });

  const conteudo = container.querySelector('#dieta-conteudo');
  if (aba === 'diario') await renderDiario(conteudo, container);
  else if (aba === 'planos') await renderPlanos(conteudo, container);
  else await renderAlimentos(conteudo, container);
}

// ---------------- Diario ----------------
async function renderDiario(alvo, raiz) {
  const [diario, { planos }] = await Promise.all([
    api.get(`/api/diario${qs({ data: dataSelecionada })}`),
    api.get('/api/planos'),
  ]);
  const { totais, metas, refeicoes, agua_ml: aguaMl } = diario;

  alvo.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <label class="field" style="max-width:180px">Dia
        <input type="date" id="diario-data" value="${esc(dataSelecionada)}">
      </label>
      <label class="field" style="max-width:240px">Aplicar plano ao dia
        <select id="diario-plano">
          <option value="">Selecione um plano…</option>
          ${planos.map((p) => `<option value="${p.id}">${esc(p.nome)} — ${num(p.totais.kcal)} kcal</option>`).join('')}
        </select>
      </label>
      <button class="btn btn-sm" id="btn-aplicar-plano">Aplicar</button>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-sm" id="btn-add-item">+ Adicionar alimento</button>
      <button class="btn btn-ghost btn-sm" id="btn-add-livre">+ Item livre</button>
    </div>

    <div class="pills">
      <span class="pill k">⚡ ${num(totais.kcal)} kcal</span>
      <span class="pill p">💪 ${num(totais.proteina_g, 0)}g prot</span>
      <span class="pill c">🌾 ${num(totais.carbo_g, 0)}g carb</span>
      <span class="pill g">🧈 ${num(totais.gordura_g, 0)}g gord</span>
      <span class="pill c">💧 ${num(aguaMl)} ml</span>
    </div>

    ${refeicoes.length ? refeicoes.map((refeicao) => `
      <div class="meal">
        <div class="meal-hd">
          <div class="meal-name">${esc(refeicao.nome)}</div>
          <div class="meal-kcal">${num(refeicao.totais.kcal)} kcal</div>
        </div>
        <div class="table-scroll">
        <table class="data">
          <thead><tr><th>Alimento</th><th>Qtd</th><th>Kcal</th><th>Prot</th><th>Carb</th><th>Gord</th><th></th></tr></thead>
          <tbody>
            ${refeicao.itens.map((item) => `
              <tr>
                <td>${esc(item.nome)}</td>
                <td>${num(item.quantidade, item.quantidade % 1 ? 1 : 0)}${esc(item.unidade)}</td>
                <td class="kc">${num(item.kcal)}</td>
                <td class="pr">${num(item.proteina_g, 1)}g</td>
                <td class="cb">${num(item.carbo_g, 1)}g</td>
                <td class="ft">${num(item.gordura_g, 1)}g</td>
                <td><button class="icon-del" data-remover-entrada="${item.id}" title="Remover">✕</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
        </div>
      </div>`).join('') : '<div class="card"><div class="empty">Nenhum alimento registrado neste dia. Aplique um plano ou adicione itens.</div></div>'}

    <div class="tot">
      <span class="tot-l">TOTAL DO DIA</span>
      <div class="tot-m">
        <span class="kc">⚡ ${num(totais.kcal)}</span>
        <span class="pr">💪 ${num(totais.proteina_g, 0)}g</span>
        <span class="cb">🌾 ${num(totais.carbo_g, 0)}g</span>
        <span class="ft">🧈 ${num(totais.gordura_g, 0)}g</span>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-title">🎯 Comparativo com as metas</div>
      ${barraMetrica({ rotulo: 'Calorias', valor: totais.kcal, meta: metas.kcal, unidade: ' kcal' })}
      ${barraMetrica({ rotulo: 'Proteína', valor: totais.proteina_g, meta: metas.proteina_g, unidade: 'g', cor: 'green' })}
      ${barraMetrica({ rotulo: 'Carboidrato', valor: totais.carbo_g, meta: metas.carbo_g, unidade: 'g', cor: 'blue' })}
      ${barraMetrica({ rotulo: 'Gordura', valor: totais.gordura_g, meta: metas.gordura_g, unidade: 'g', cor: 'red' })}
    </div>`;

  const recarregar = () => render(raiz).catch(erroToast);

  alvo.querySelector('#diario-data').addEventListener('change', (e) => {
    dataSelecionada = e.target.value || hoje();
    recarregar();
  });

  alvo.querySelector('#btn-aplicar-plano').addEventListener('click', async () => {
    const planoId = alvo.querySelector('#diario-plano').value;
    if (!planoId) return toast('Escolha um plano primeiro', 'erro');
    if (refeicoes.length && !(await confirmar('Isso substitui o que já está registrado neste dia. Continuar?'))) return;
    try {
      const r = await api.post(`/api/planos/${planoId}/aplicar`, { data: dataSelecionada, substituir: true });
      toast(`${r.itens_criados} itens adicionados ao dia`);
      recarregar();
    } catch (e) { erroToast(e); }
  });

  alvo.querySelector('#btn-add-item').addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: 'Adicionar alimento',
      campos: [
        { nome: 'refeicao', rotulo: 'Refeição', tipo: 'text', valor: refeicoes.at(-1)?.nome || 'Café da manhã', obrigatorio: true },
        { nome: 'alimento_id', rotulo: 'Alimento', tipo: 'select', opcoes: opcoesAlimentos(), obrigatorio: true },
        { nome: 'quantidade', rotulo: 'Quantidade (g / ml / un)', tipo: 'number', passo: '0.1', valor: 100, obrigatorio: true },
      ],
    });
    if (!dados) return;
    try {
      await api.post('/api/diario', {
        data: dataSelecionada,
        refeicao: dados.refeicao,
        alimento_id: Number(dados.alimento_id),
        quantidade: Number(dados.quantidade),
      });
      toast('Alimento registrado');
      recarregar();
    } catch (e) { erroToast(e); }
  });

  alvo.querySelector('#btn-add-livre').addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: 'Item livre (fora da tabela)',
      campos: [
        { nome: 'refeicao', rotulo: 'Refeição', tipo: 'text', valor: 'Extra', obrigatorio: true },
        { nome: 'nome', rotulo: 'Descrição', tipo: 'text', obrigatorio: true },
        { nome: 'kcal', rotulo: 'Calorias', tipo: 'number', valor: 0, obrigatorio: true },
        { nome: 'proteina_g', rotulo: 'Proteína (g)', tipo: 'number', passo: '0.1', valor: 0 },
        { nome: 'carbo_g', rotulo: 'Carboidrato (g)', tipo: 'number', passo: '0.1', valor: 0 },
        { nome: 'gordura_g', rotulo: 'Gordura (g)', tipo: 'number', passo: '0.1', valor: 0 },
      ],
    });
    if (!dados) return;
    try {
      await api.post('/api/diario', {
        data: dataSelecionada,
        refeicao: dados.refeicao,
        nome: dados.nome,
        kcal: Number(dados.kcal),
        proteina_g: Number(dados.proteina_g || 0),
        carbo_g: Number(dados.carbo_g || 0),
        gordura_g: Number(dados.gordura_g || 0),
      });
      toast('Item adicionado');
      recarregar();
    } catch (e) { erroToast(e); }
  });

  alvo.querySelectorAll('[data-remover-entrada]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      try {
        await api.del(`/api/diario/${botao.dataset.removerEntrada}`);
        recarregar();
      } catch (e) { erroToast(e); }
    });
  });
}

// ---------------- Planos ----------------
async function renderPlanos(alvo, raiz) {
  const { planos } = await api.get('/api/planos');

  alvo.innerHTML = `
    <div class="row" style="margin-bottom:12px">
      <span class="muted">Planos são dias modelo (treino, descanso…) que você aplica ao diário com um clique.</span>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-sm" id="btn-novo-plano">+ Novo plano</button>
    </div>

    ${planos.map((plano) => `
      <div class="card">
        <div class="card-title ${plano.cor === 'blue' ? 'blue' : plano.cor === 'purple' ? 'purple' : ''}">
          <span>${esc(plano.nome)}</span>
          <span class="row">
            <span class="pill k">⚡ ${num(plano.totais.kcal)}</span>
            <span class="pill p">💪 ${num(plano.totais.proteina_g, 0)}g</span>
            <span class="pill c">🌾 ${num(plano.totais.carbo_g, 0)}g</span>
            <span class="pill g">🧈 ${num(plano.totais.gordura_g, 0)}g</span>
          </span>
        </div>
        ${plano.descricao ? `<div class="muted" style="margin-bottom:8px">${esc(plano.descricao)}</div>` : ''}

        ${plano.refeicoes.map((refeicao) => `
          <div class="meal">
            <div class="meal-hd">
              <div class="meal-name">${esc(refeicao.nome)}</div>
              <div class="row">
                <span class="meal-kcal">${num(refeicao.totais.kcal)} kcal</span>
                <button class="btn btn-sm btn-ghost" data-add-item-refeicao="${refeicao.id}">+ item</button>
                <button class="icon-del" data-del-refeicao="${refeicao.id}">✕</button>
              </div>
            </div>
            <div class="table-scroll">
            <table class="data">
              <thead><tr><th>Alimento</th><th>Qtd</th><th>Kcal</th><th>Prot</th><th>Carb</th><th>Gord</th><th></th></tr></thead>
              <tbody>
                ${refeicao.itens.map((item) => `
                  <tr>
                    <td>${esc(item.nome)}</td>
                    <td><button class="btn btn-sm btn-ghost" data-edit-item="${item.id}" data-qtd="${item.quantidade}">${num(item.quantidade, item.quantidade % 1 ? 1 : 0)}${esc(item.unidade)}</button></td>
                    <td class="kc">${num(item.kcal)}</td>
                    <td class="pr">${num(item.proteina_g, 1)}g</td>
                    <td class="cb">${num(item.carbo_g, 1)}g</td>
                    <td class="ft">${num(item.gordura_g, 1)}g</td>
                    <td><button class="icon-del" data-del-item="${item.id}">✕</button></td>
                  </tr>`).join('') || '<tr><td colspan="7" class="muted">Sem itens</td></tr>'}
              </tbody>
            </table>
            </div>
            ${refeicao.dica ? `<div class="meal-tip">💡 ${esc(refeicao.dica)}</div>` : ''}
          </div>`).join('')}

        <div class="row" style="margin-top:10px">
          <button class="btn btn-sm" data-add-refeicao="${plano.id}">+ Refeição</button>
          <button class="btn btn-sm btn-green" data-aplicar="${plano.id}">Aplicar ao dia de hoje</button>
          <div class="spacer"></div>
          <button class="btn btn-sm btn-danger" data-del-plano="${plano.id}">Excluir plano</button>
        </div>
      </div>`).join('') || '<div class="card"><div class="empty">Nenhum plano ainda.</div></div>'}`;

  const recarregar = () => render(raiz).catch(erroToast);

  alvo.querySelector('#btn-novo-plano').addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: 'Novo plano de dia',
      campos: [
        { nome: 'nome', rotulo: 'Nome', tipo: 'text', obrigatorio: true, valor: 'Dia de treino' },
        { nome: 'descricao', rotulo: 'Descrição', tipo: 'text' },
        { nome: 'cor', rotulo: 'Cor', tipo: 'select', valor: 'fire', opcoes: [
          { valor: 'fire', rotulo: 'Laranja' }, { valor: 'blue', rotulo: 'Azul' }, { valor: 'purple', rotulo: 'Roxo' },
        ] },
      ],
    });
    if (!dados) return;
    try { await api.post('/api/planos', dados); toast('Plano criado'); recarregar(); } catch (e) { erroToast(e); }
  });

  alvo.querySelectorAll('[data-add-refeicao]').forEach((botao) => botao.addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: 'Nova refeição',
      campos: [
        { nome: 'nome', rotulo: 'Nome', tipo: 'text', obrigatorio: true, valor: 'Lanche' },
        { nome: 'dica', rotulo: 'Dica (opcional)', tipo: 'text' },
      ],
    });
    if (!dados) return;
    try { await api.post(`/api/planos/${botao.dataset.addRefeicao}/refeicoes`, dados); recarregar(); } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-add-item-refeicao]').forEach((botao) => botao.addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: 'Adicionar alimento à refeição',
      campos: [
        { nome: 'alimento_id', rotulo: 'Alimento', tipo: 'select', opcoes: opcoesAlimentos(), obrigatorio: true },
        { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'number', passo: '0.1', valor: 100, obrigatorio: true },
      ],
    });
    if (!dados) return;
    try {
      await api.post(`/api/plano-refeicoes/${botao.dataset.addItemRefeicao}/itens`, {
        alimento_id: Number(dados.alimento_id), quantidade: Number(dados.quantidade),
      });
      recarregar();
    } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-edit-item]').forEach((botao) => botao.addEventListener('click', async () => {
    const dados = await modalFormulario({
      titulo: 'Alterar quantidade',
      campos: [{ nome: 'quantidade', rotulo: 'Quantidade', tipo: 'number', passo: '0.1', valor: botao.dataset.qtd, obrigatorio: true }],
    });
    if (!dados) return;
    try {
      await api.put(`/api/plano-itens/${botao.dataset.editItem}`, { quantidade: Number(dados.quantidade) });
      recarregar();
    } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-del-item]').forEach((botao) => botao.addEventListener('click', async () => {
    try { await api.del(`/api/plano-itens/${botao.dataset.delItem}`); recarregar(); } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-del-refeicao]').forEach((botao) => botao.addEventListener('click', async () => {
    if (!(await confirmar('Excluir esta refeição do plano?'))) return;
    try { await api.del(`/api/plano-refeicoes/${botao.dataset.delRefeicao}`); recarregar(); } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-del-plano]').forEach((botao) => botao.addEventListener('click', async () => {
    if (!(await confirmar('Excluir o plano inteiro?'))) return;
    try { await api.del(`/api/planos/${botao.dataset.delPlano}`); toast('Plano excluído'); recarregar(); } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-aplicar]').forEach((botao) => botao.addEventListener('click', async () => {
    if (!(await confirmar('Aplicar este plano ao dia de hoje? O que já estiver registrado hoje será substituído.'))) return;
    try {
      const r = await api.post(`/api/planos/${botao.dataset.aplicar}/aplicar`, { data: hoje(), substituir: true });
      toast(`${r.itens_criados} itens aplicados a hoje`);
      aba = 'diario';
      dataSelecionada = hoje();
      recarregar();
    } catch (e) { erroToast(e); }
  }));
}

// ---------------- Alimentos ----------------
async function renderAlimentos(alvo, raiz) {
  const lista = alimentosCache;

  alvo.innerHTML = `
    <div class="row" style="margin-bottom:12px">
      <label class="field" style="max-width:260px">Buscar
        <input type="search" id="busca-alimento" placeholder="Ex.: frango, aveia…">
      </label>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-sm" id="btn-novo-alimento">+ Novo alimento</button>
    </div>
    <div class="card">
      <div class="table-scroll">
      <table class="data" id="tabela-alimentos">
        <thead><tr><th>Alimento</th><th>Porção</th><th>Kcal</th><th>Prot</th><th>Carb</th><th>Gord</th><th></th></tr></thead>
        <tbody>
          ${lista.map((a) => `
            <tr data-nome="${esc(a.nome.toLowerCase())}">
              <td>${esc(a.nome)}</td>
              <td>${num(a.porcao_base, 0)}${esc(a.unidade)}</td>
              <td class="kc">${num(a.kcal)}</td>
              <td class="pr">${num(a.proteina_g, 1)}g</td>
              <td class="cb">${num(a.carbo_g, 1)}g</td>
              <td class="ft">${num(a.gordura_g, 1)}g</td>
              <td class="row" style="justify-content:flex-end;flex-wrap:nowrap">
                <button class="btn btn-sm btn-ghost" data-edit-alimento="${a.id}">editar</button>
                <button class="icon-del" data-del-alimento="${a.id}">✕</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>`;

  const recarregar = () => render(raiz).catch(erroToast);

  alvo.querySelector('#busca-alimento').addEventListener('input', (e) => {
    const termo = e.target.value.trim().toLowerCase();
    alvo.querySelectorAll('#tabela-alimentos tbody tr').forEach((linha) => {
      linha.classList.toggle('hidden', termo && !linha.dataset.nome.includes(termo));
    });
  });

  const camposAlimento = (a = {}) => [
    { nome: 'nome', rotulo: 'Nome', tipo: 'text', valor: a.nome, obrigatorio: true },
    { nome: 'unidade', rotulo: 'Unidade', tipo: 'select', valor: a.unidade || 'g', opcoes: [
      { valor: 'g', rotulo: 'gramas (g)' }, { valor: 'ml', rotulo: 'mililitros (ml)' }, { valor: 'un', rotulo: 'unidade' },
    ] },
    { nome: 'porcao_base', rotulo: 'Porção de referência', tipo: 'number', passo: '0.1', valor: a.porcao_base ?? 100, obrigatorio: true },
    { nome: 'kcal', rotulo: 'Calorias na porção', tipo: 'number', passo: '0.1', valor: a.kcal ?? 0, obrigatorio: true },
    { nome: 'proteina_g', rotulo: 'Proteína (g)', tipo: 'number', passo: '0.1', valor: a.proteina_g ?? 0 },
    { nome: 'carbo_g', rotulo: 'Carboidrato (g)', tipo: 'number', passo: '0.1', valor: a.carbo_g ?? 0 },
    { nome: 'gordura_g', rotulo: 'Gordura (g)', tipo: 'number', passo: '0.1', valor: a.gordura_g ?? 0 },
  ];

  const paraNumeros = (d) => ({
    ...d,
    porcao_base: Number(d.porcao_base),
    kcal: Number(d.kcal),
    proteina_g: Number(d.proteina_g || 0),
    carbo_g: Number(d.carbo_g || 0),
    gordura_g: Number(d.gordura_g || 0),
  });

  alvo.querySelector('#btn-novo-alimento').addEventListener('click', async () => {
    const dados = await modalFormulario({ titulo: 'Novo alimento', campos: camposAlimento() });
    if (!dados) return;
    try { await api.post('/api/alimentos', paraNumeros(dados)); toast('Alimento criado'); recarregar(); } catch (e) { erroToast(e); }
  });

  alvo.querySelectorAll('[data-edit-alimento]').forEach((botao) => botao.addEventListener('click', async () => {
    const alimento = lista.find((a) => a.id === Number(botao.dataset.editAlimento));
    const dados = await modalFormulario({ titulo: 'Editar alimento', campos: camposAlimento(alimento) });
    if (!dados) return;
    try { await api.put(`/api/alimentos/${alimento.id}`, paraNumeros(dados)); toast('Alimento atualizado'); recarregar(); } catch (e) { erroToast(e); }
  }));

  alvo.querySelectorAll('[data-del-alimento]').forEach((botao) => botao.addEventListener('click', async () => {
    if (!(await confirmar('Excluir este alimento? Ele será removido dos planos que o utilizam.'))) return;
    try { await api.del(`/api/alimentos/${botao.dataset.delAlimento}`); recarregar(); } catch (e) { erroToast(e); }
  }));
}
