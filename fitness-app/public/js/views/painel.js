// Painel: resumo do dia, semana e evolucao.
import { api, qs } from '../api.js';
import { esc, num, hoje, dataCurta, toast, erroToast, barraMetrica, grafico } from '../ui.js';

let dataSelecionada = hoje();

export async function render(container) {
  const painel = await api.get(`/api/painel${qs({ data: dataSelecionada })}`);
  const { consumo, metas, restante, agua, semana, peso, recordes } = painel;

  const progressoPeso = peso.inicial != null && peso.meta != null && peso.atual != null && peso.meta !== peso.inicial
    ? Math.max(0, Math.min(100, Math.round(((peso.atual - peso.inicial) / (peso.meta - peso.inicial)) * 100)))
    : 0;

  container.innerHTML = `
    <div class="shdr">
      <h2>Painel</h2>
      <p>Resumo do dia, da semana e da sua evolução</p>
    </div>

    <div class="row" style="justify-content:center;margin-bottom:18px">
      <label class="field" style="max-width:200px">Dia
        <input type="date" id="painel-data" value="${esc(dataSelecionada)}">
      </label>
    </div>

    <div class="stat-grid" style="margin-bottom:16px">
      <div class="stat">
        <div class="lbl">Calorias no dia</div>
        <div class="val kc">${num(consumo.kcal)}</div>
        <div class="sub">meta ${metas.kcal ? num(metas.kcal) : '—'} kcal · restam ${restante.kcal != null ? num(restante.kcal) : '—'}</div>
      </div>
      <div class="stat">
        <div class="lbl">Proteína</div>
        <div class="val pr">${num(consumo.proteina_g, 0)}g</div>
        <div class="sub">meta ${metas.proteina_g ? num(metas.proteina_g) + 'g' : '—'}</div>
      </div>
      <div class="stat">
        <div class="lbl">Peso atual</div>
        <div class="val gd">${peso.atual != null ? num(peso.atual, 1) + ' kg' : '—'}</div>
        <div class="sub">${peso.variacao != null ? `${peso.variacao > 0 ? '+' : ''}${num(peso.variacao, 1)} kg desde o início` : 'registre seu peso'}</div>
      </div>
      <div class="stat">
        <div class="lbl">Treinos na semana</div>
        <div class="val cb">${num(semana.dias_treinados)}</div>
        <div class="sub">${dataCurta(semana.inicio)} a ${dataCurta(semana.fim)}</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">🎯 Metas do dia</div>
        ${barraMetrica({ rotulo: 'Calorias', valor: consumo.kcal, meta: metas.kcal, unidade: ' kcal' })}
        ${barraMetrica({ rotulo: 'Proteína', valor: consumo.proteina_g, meta: metas.proteina_g, unidade: 'g', cor: 'green' })}
        ${barraMetrica({ rotulo: 'Carboidrato', valor: consumo.carbo_g, meta: metas.carbo_g, unidade: 'g', cor: 'blue' })}
        ${barraMetrica({ rotulo: 'Gordura', valor: consumo.gordura_g, meta: metas.gordura_g, unidade: 'g', cor: 'red' })}
      </div>

      <div class="card">
        <div class="card-title blue">💧 Água</div>
        ${barraMetrica({ rotulo: 'Consumo', valor: agua.consumido_ml, meta: agua.meta_ml, unidade: ' ml', cor: 'blue' })}
        <div class="row" style="margin-top:10px">
          <button class="btn btn-blue btn-sm" data-agua="250">+250 ml</button>
          <button class="btn btn-blue btn-sm" data-agua="500">+500 ml</button>
          <button class="btn btn-blue btn-sm" data-agua="750">+750 ml</button>
        </div>
        <div class="card-title" style="margin-top:16px">🏆 Recordes recentes</div>
        ${recordes.length ? recordes.map((r) => `
          <div class="sum-row">
            <span class="lbl">${esc(r.nome)}</span>
            <span class="val gd">${num(r.peso, 1)} kg × ${num(r.repeticoes)}</span>
          </div>`).join('') : '<div class="empty">Registre cargas na aba Treino para ver seus PRs.</div>'}
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">📈 Calorias — últimos 7 dias</div>
        <div class="chart-box"><canvas id="g-kcal"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title green">⚖️ Evolução do peso</div>
        <div class="chart-box"><canvas id="g-peso"></canvas></div>
        ${peso.meta != null ? `
          <div class="metric" style="margin-top:10px">
            <div class="metric-head">
              <span class="muted">Rumo à meta de ${num(peso.meta, 1)} kg</span>
              <span><b>${progressoPeso}%</b></span>
            </div>
            <div class="bar green"><span style="width:${progressoPeso}%"></span></div>
          </div>` : ''}
      </div>
    </div>`;

  container.querySelector('#painel-data').addEventListener('change', (e) => {
    dataSelecionada = e.target.value || hoje();
    render(container).catch(erroToast);
  });

  container.querySelectorAll('[data-agua]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      try {
        await api.post('/api/agua', { ml: Number(botao.dataset.agua), data: dataSelecionada });
        toast('Água registrada 💧');
        await render(container);
      } catch (e) { erroToast(e); }
    });
  });

  desenharGraficos(semana, peso);
}

function desenharGraficos(semana, peso) {
  const dias = semana.kcal_por_dia;
  grafico('g-kcal', {
    type: 'bar',
    data: {
      labels: dias.map((d) => dataCurta(d.data)),
      datasets: [{
        label: 'kcal',
        data: dias.map((d) => d.kcal),
        backgroundColor: 'rgba(245,166,35,0.55)',
        borderColor: '#f5a623',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });

  grafico('g-peso', {
    type: 'line',
    data: {
      labels: peso.historico.map((p) => dataCurta(p.data)),
      datasets: [{
        label: 'Peso (kg)',
        data: peso.historico.map((p) => p.peso),
        borderColor: '#6fcf97',
        backgroundColor: 'rgba(111,207,151,0.15)',
        fill: true, tension: 0.3, pointRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: false } },
    },
  });
}
