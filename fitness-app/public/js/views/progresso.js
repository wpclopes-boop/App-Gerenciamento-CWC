// Progresso: peso, medidas corporais, graficos e fotos.
import { api } from '../api.js';
import { esc, num, hoje, dataCurta, toast, erroToast, confirmar, grafico } from '../ui.js';

export async function render(container) {
  const [{ medidas, resumo }, { fotos }, estatisticas] = await Promise.all([
    api.get('/api/medidas'),
    api.get('/api/fotos'),
    api.get('/api/series/estatisticas'),
  ]);

  const ultima = medidas[0];

  container.innerHTML = `
    <div class="shdr">
      <h2>Progresso</h2>
      <p>Peso, medidas, força e fotos ao longo do tempo</p>
    </div>

    <div class="stat-grid" style="margin-bottom:16px">
      <div class="stat"><div class="lbl">Peso inicial</div>
        <div class="val kc">${resumo.peso_inicial != null ? num(resumo.peso_inicial, 1) : '—'}</div><div class="sub">kg</div></div>
      <div class="stat"><div class="lbl">Peso atual</div>
        <div class="val gd">${resumo.peso_atual != null ? num(resumo.peso_atual, 1) : '—'}</div><div class="sub">kg</div></div>
      <div class="stat"><div class="lbl">Variação</div>
        <div class="val ${resumo.variacao > 0 ? 'pr' : 'ft'}">${resumo.variacao != null ? `${resumo.variacao > 0 ? '+' : ''}${num(resumo.variacao, 1)}` : '—'}</div><div class="sub">kg</div></div>
      <div class="stat"><div class="lbl">Falta para a meta</div>
        <div class="val cb">${resumo.restante != null ? num(resumo.restante, 1) : '—'}</div>
        <div class="sub">${resumo.peso_meta != null ? `meta ${num(resumo.peso_meta, 1)} kg` : 'defina em Metas'}</div></div>
    </div>

    <div class="card">
      <div class="card-title green">⚖️ Registrar peso e medidas</div>
      <form id="form-medida">
        <div class="row">
          <label class="field">Data<input type="date" name="data" value="${esc(hoje())}" required></label>
          <label class="field">Peso (kg)<input type="number" step="0.1" name="peso" value="${esc(ultima?.peso ?? '')}"></label>
          <label class="field">Gordura (%)<input type="number" step="0.1" name="gordura_pct" value="${esc(ultima?.gordura_pct ?? '')}"></label>
        </div>
        <div class="row" style="margin-top:8px">
          <label class="field">Peito (cm)<input type="number" step="0.1" name="peito_cm" value="${esc(ultima?.peito_cm ?? '')}"></label>
          <label class="field">Cintura (cm)<input type="number" step="0.1" name="cintura_cm" value="${esc(ultima?.cintura_cm ?? '')}"></label>
          <label class="field">Quadril (cm)<input type="number" step="0.1" name="quadril_cm" value="${esc(ultima?.quadril_cm ?? '')}"></label>
          <label class="field">Braço (cm)<input type="number" step="0.1" name="braco_cm" value="${esc(ultima?.braco_cm ?? '')}"></label>
          <label class="field">Coxa (cm)<input type="number" step="0.1" name="coxa_cm" value="${esc(ultima?.coxa_cm ?? '')}"></label>
        </div>
        <div class="row" style="margin-top:10px">
          <label class="field">Observações<input type="text" name="observacoes" maxlength="300" placeholder="Ex.: medida em jejum"></label>
          <button class="btn btn-primary" type="submit" style="align-self:flex-end">Salvar</button>
        </div>
      </form>
      <div class="muted" style="margin-top:6px">Um registro por dia — salvar de novo na mesma data atualiza os valores.</div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title green">📉 Peso ao longo do tempo</div>
        <div class="chart-box"><canvas id="g-peso-hist"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title blue">🏋️ Volume semanal de treino</div>
        <div class="chart-box"><canvas id="g-volume"></canvas></div>
        <div class="muted">Volume = carga × repetições somadas na semana.</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📋 Histórico de medidas</div>
      <div class="table-scroll">
      <table class="data">
        <thead><tr><th>Data</th><th>Peso</th><th>IMC</th><th>Gordura</th><th>Peito</th><th>Cintura</th><th>Quadril</th><th>Braço</th><th>Coxa</th><th></th></tr></thead>
        <tbody>
          ${medidas.length ? medidas.map((m, i) => {
            const anterior = medidas[i + 1];
            const dif = anterior && m.peso != null && anterior.peso != null ? m.peso - anterior.peso : null;
            return `<tr>
              <td>${dataCurta(m.data)}</td>
              <td class="gd">${m.peso != null ? `${num(m.peso, 1)} kg` : '—'}
                ${dif != null ? `<span class="${dif > 0 ? 'pr' : 'ft'}" style="font-size:0.66rem"> ${dif > 0 ? '+' : ''}${num(dif, 1)}</span>` : ''}</td>
              <td>${m.imc != null ? num(m.imc, 1) : '—'}</td>
              <td>${m.gordura_pct != null ? `${num(m.gordura_pct, 1)}%` : '—'}</td>
              <td>${m.peito_cm != null ? num(m.peito_cm, 1) : '—'}</td>
              <td>${m.cintura_cm != null ? num(m.cintura_cm, 1) : '—'}</td>
              <td>${m.quadril_cm != null ? num(m.quadril_cm, 1) : '—'}</td>
              <td>${m.braco_cm != null ? num(m.braco_cm, 1) : '—'}</td>
              <td>${m.coxa_cm != null ? num(m.coxa_cm, 1) : '—'}</td>
              <td><button class="icon-del" data-del-medida="${m.id}">✕</button></td>
            </tr>`;
          }).join('') : '<tr><td colspan="10" class="muted">Nenhuma medida registrada ainda.</td></tr>'}
        </tbody>
      </table>
      </div>
    </div>

    <div class="card">
      <div class="card-title purple">
        <span>📸 Fotos de progresso</span>
        <span class="row">
          <input type="file" id="foto-arquivo" accept="image/jpeg,image/png,image/webp" style="max-width:230px">
          <button class="btn btn-sm" id="btn-enviar-foto">Enviar</button>
        </span>
      </div>
      ${fotos.length ? `<div class="foto-grid">
        ${fotos.map((f) => `
          <div class="foto">
            <img src="/api/fotos/${f.id}/arquivo" alt="Foto de ${dataCurta(f.data)}" loading="lazy">
            <div class="foto-info">
              <span>${dataCurta(f.data)}${f.legenda ? ` · ${esc(f.legenda)}` : ''}</span>
              <button class="icon-del" data-del-foto="${f.id}">✕</button>
            </div>
          </div>`).join('')}
      </div>` : '<div class="empty">Nenhuma foto ainda. Envie uma a cada 15 dias para comparar.</div>'}
    </div>`;

  const recarregar = () => render(container).catch(erroToast);

  container.querySelector('#form-medida').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target).entries());
    const corpo = { data: dados.data, observacoes: dados.observacoes || undefined };
    for (const campo of ['peso', 'gordura_pct', 'peito_cm', 'cintura_cm', 'quadril_cm', 'braco_cm', 'coxa_cm']) {
      if (dados[campo] !== '') corpo[campo] = Number(dados[campo]);
    }
    try { await api.post('/api/medidas', corpo); toast('Medidas salvas'); recarregar(); } catch (erro) { erroToast(erro); }
  });

  container.querySelectorAll('[data-del-medida]').forEach((botao) => botao.addEventListener('click', async () => {
    if (!(await confirmar('Excluir este registro de medidas?'))) return;
    try { await api.del(`/api/medidas/${botao.dataset.delMedida}`); recarregar(); } catch (e) { erroToast(e); }
  }));

  container.querySelector('#btn-enviar-foto').addEventListener('click', async () => {
    const input = container.querySelector('#foto-arquivo');
    const arquivo = input.files?.[0];
    if (!arquivo) return toast('Escolha uma imagem primeiro', 'erro');
    if (arquivo.size > 5 * 1024 * 1024) return toast('Imagem acima de 5MB', 'erro');
    try {
      const base64 = await lerComoBase64(arquivo);
      await api.post('/api/fotos', { mime: arquivo.type, conteudo_base64: base64, data: hoje() });
      toast('Foto enviada 📸');
      recarregar();
    } catch (e) { erroToast(e); }
  });

  container.querySelectorAll('[data-del-foto]').forEach((botao) => botao.addEventListener('click', async () => {
    if (!(await confirmar('Excluir esta foto?'))) return;
    try { await api.del(`/api/fotos/${botao.dataset.delFoto}`); recarregar(); } catch (e) { erroToast(e); }
  }));

  grafico('g-peso-hist', {
    type: 'line',
    data: {
      labels: [...medidas].reverse().filter((m) => m.peso != null).map((m) => dataCurta(m.data)),
      datasets: [{
        data: [...medidas].reverse().filter((m) => m.peso != null).map((m) => m.peso),
        borderColor: '#6fcf97', backgroundColor: 'rgba(111,207,151,0.15)',
        fill: true, tension: 0.3, pointRadius: 3,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  grafico('g-volume', {
    type: 'bar',
    data: {
      labels: estatisticas.por_semana.map((s) => dataCurta(s.inicio)),
      datasets: [{
        data: estatisticas.por_semana.map((s) => s.volume),
        backgroundColor: 'rgba(86,204,242,0.5)', borderColor: '#56ccf2', borderWidth: 1, borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function lerComoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1]);
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem'));
    leitor.readAsDataURL(arquivo);
  });
}
