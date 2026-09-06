// Metas: perfil, calculadoras (TMB/GET/macros/agua) e metas personalizadas.
import { api } from '../api.js';
import { esc, num, toast, erroToast, confirmar } from '../ui.js';

const ROTULO_NIVEL = {
  sedentario: 'Sedentário (pouco ou nenhum exercício)',
  leve: 'Leve (1 a 3 treinos por semana)',
  moderado: 'Moderado (3 a 5 treinos por semana)',
  intenso: 'Intenso (6 a 7 treinos por semana)',
  atleta: 'Atleta (2 treinos por dia)',
};

export async function render(container) {
  const { perfil, calculado, metas, opcoes } = await api.get('/api/perfil');

  container.innerHTML = `
    <div class="shdr">
      <h2>Metas</h2>
      <p>Seu perfil define TMB, gasto diário, calorias e macros</p>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">👤 Perfil</div>
        <form id="form-perfil">
          <div class="row">
            <label class="field">Sexo
              <select name="sexo">
                <option value="">—</option>
                ${opcoes.sexos.map((s) => `<option value="${s}" ${perfil.sexo === s ? 'selected' : ''}>${s === 'masculino' ? 'Masculino' : 'Feminino'}</option>`).join('')}
              </select>
            </label>
            <label class="field">Nascimento
              <input type="date" name="data_nascimento" value="${esc(perfil.data_nascimento ?? '')}">
            </label>
          </div>
          <div class="row" style="margin-top:8px">
            <label class="field">Altura (cm)<input type="number" step="0.1" name="altura_cm" value="${esc(perfil.altura_cm ?? '')}"></label>
            <label class="field">Peso inicial (kg)<input type="number" step="0.1" name="peso_inicial" value="${esc(perfil.peso_inicial ?? '')}"></label>
            <label class="field">Meta de peso (kg)<input type="number" step="0.1" name="peso_meta" value="${esc(perfil.peso_meta ?? '')}"></label>
          </div>
          <div class="row" style="margin-top:8px">
            <label class="field">Nível de atividade
              <select name="nivel_atividade">
                ${opcoes.niveis.map((n) => `<option value="${n}" ${perfil.nivel_atividade === n ? 'selected' : ''}>${esc(ROTULO_NIVEL[n] || n)}</option>`).join('')}
              </select>
            </label>
            <label class="field">Objetivo
              <select name="objetivo">
                ${Object.entries(opcoes.objetivos).map(([valor, rotulo]) => `<option value="${valor}" ${perfil.objetivo === valor ? 'selected' : ''}>${esc(rotulo)}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="row" style="margin-top:12px">
            <button class="btn btn-primary" type="submit">Salvar perfil</button>
            <span class="muted">Peso atual usado nos cálculos: ${perfil.peso_atual != null ? `${num(perfil.peso_atual, 1)} kg` : '—'}</span>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="card-title green">🧮 Cálculo automático</div>
        <div class="sum-row"><span class="lbl">Idade</span><span class="val">${calculado.idade != null ? `${calculado.idade} anos` : '—'}</span></div>
        <div class="sum-row"><span class="lbl">TMB (metabolismo basal)</span><span class="val kc">${calculado.tmb ? `${num(calculado.tmb)} kcal` : '—'}</span></div>
        <div class="sum-row"><span class="lbl">GET (gasto total diário)</span><span class="val kc">${calculado.get ? `${num(calculado.get)} kcal` : '—'}</span></div>
        <div class="sum-row"><span class="lbl">Meta calórica sugerida</span><span class="val gd">${calculado.meta_kcal_sugerida ? `${num(calculado.meta_kcal_sugerida)} kcal` : '—'}</span></div>
        <div class="sum-row"><span class="lbl">Proteína</span><span class="val pr">${calculado.macros_sugeridos ? `${num(calculado.macros_sugeridos.proteina_g)} g` : '—'}</span></div>
        <div class="sum-row"><span class="lbl">Carboidrato</span><span class="val cb">${calculado.macros_sugeridos ? `${num(calculado.macros_sugeridos.carbo_g)} g` : '—'}</span></div>
        <div class="sum-row"><span class="lbl">Gordura</span><span class="val ft">${calculado.macros_sugeridos ? `${num(calculado.macros_sugeridos.gordura_g)} g` : '—'}</span></div>
        <div class="sum-row"><span class="lbl">Água</span><span class="val cb">${calculado.agua_ml_sugerida ? `${num(calculado.agua_ml_sugerida)} ml` : '—'}</span></div>
        <div class="sum-row"><span class="lbl">IMC</span><span class="val">${calculado.imc != null ? `${num(calculado.imc, 1)} · ${esc(calculado.imc_classificacao)}` : '—'}</span></div>
        ${calculado.tmb == null ? '<div class="empty">Preencha sexo, nascimento, altura e peso para calcular.</div>' : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-title blue">
        <span>🎯 Metas em uso ${metas.personalizadas ? '(personalizadas)' : '(automáticas)'}</span>
        ${metas.personalizadas ? '<button class="btn btn-sm btn-ghost" id="btn-voltar-auto">Voltar ao automático</button>' : ''}
      </div>
      <form id="form-metas">
        <div class="row">
          <label class="field">Calorias<input type="number" name="kcal" value="${esc(metas.kcal ?? '')}" required></label>
          <label class="field">Proteína (g)<input type="number" step="0.1" name="proteina_g" value="${esc(metas.proteina_g ?? '')}" required></label>
          <label class="field">Carboidrato (g)<input type="number" step="0.1" name="carbo_g" value="${esc(metas.carbo_g ?? '')}" required></label>
          <label class="field">Gordura (g)<input type="number" step="0.1" name="gordura_g" value="${esc(metas.gordura_g ?? '')}" required></label>
          <label class="field">Água (ml)<input type="number" name="agua_ml" value="${esc(metas.agua_ml ?? '')}"></label>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn btn-primary" type="submit">Fixar estas metas</button>
          <span class="muted">Fixar substitui o cálculo automático até você voltar atrás.</span>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card-title purple">🔬 Simulador (não altera seu perfil)</div>
      <form id="form-simulador">
        <div class="row">
          <label class="field">Sexo
            <select name="sexo">
              <option value="masculino" ${perfil.sexo !== 'feminino' ? 'selected' : ''}>Masculino</option>
              <option value="feminino" ${perfil.sexo === 'feminino' ? 'selected' : ''}>Feminino</option>
            </select>
          </label>
          <label class="field">Idade<input type="number" name="idade" value="${esc(calculado.idade ?? 30)}" required></label>
          <label class="field">Peso (kg)<input type="number" step="0.1" name="peso_kg" value="${esc(perfil.peso_atual ?? 75)}" required></label>
          <label class="field">Altura (cm)<input type="number" step="0.1" name="altura_cm" value="${esc(perfil.altura_cm ?? 175)}" required></label>
        </div>
        <div class="row" style="margin-top:8px">
          <label class="field">Nível
            <select name="nivel_atividade">
              ${opcoes.niveis.map((n) => `<option value="${n}" ${perfil.nivel_atividade === n ? 'selected' : ''}>${esc(ROTULO_NIVEL[n] || n)}</option>`).join('')}
            </select>
          </label>
          <label class="field">Objetivo
            <select name="objetivo">
              ${Object.entries(opcoes.objetivos).map(([valor, rotulo]) => `<option value="${valor}" ${perfil.objetivo === valor ? 'selected' : ''}>${esc(rotulo)}</option>`).join('')}
            </select>
          </label>
          <button class="btn" type="submit" style="align-self:flex-end">Calcular</button>
        </div>
      </form>
      <div id="resultado-simulador" style="margin-top:12px"></div>
    </div>`;

  const recarregar = () => render(container).catch(erroToast);

  container.querySelector('#form-perfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target).entries());
    const corpo = {
      sexo: dados.sexo || undefined,
      data_nascimento: dados.data_nascimento || undefined,
      nivel_atividade: dados.nivel_atividade,
      objetivo: dados.objetivo,
      metas_personalizadas: perfil.metas_personalizadas === 1,
      meta_kcal: perfil.meta_kcal ?? undefined,
      meta_proteina_g: perfil.meta_proteina_g ?? undefined,
      meta_carbo_g: perfil.meta_carbo_g ?? undefined,
      meta_gordura_g: perfil.meta_gordura_g ?? undefined,
      meta_agua_ml: perfil.meta_agua_ml ?? undefined,
    };
    for (const campo of ['altura_cm', 'peso_inicial', 'peso_meta']) {
      if (dados[campo] !== '') corpo[campo] = Number(dados[campo]);
    }
    try { await api.put('/api/perfil', corpo); toast('Perfil salvo'); recarregar(); } catch (erro) { erroToast(erro); }
  });

  container.querySelector('#form-metas').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.put('/api/metas', {
        kcal: Number(dados.kcal),
        proteina_g: Number(dados.proteina_g),
        carbo_g: Number(dados.carbo_g),
        gordura_g: Number(dados.gordura_g),
        agua_ml: dados.agua_ml === '' ? undefined : Number(dados.agua_ml),
      });
      toast('Metas fixadas');
      recarregar();
    } catch (erro) { erroToast(erro); }
  });

  container.querySelector('#btn-voltar-auto')?.addEventListener('click', async () => {
    if (!(await confirmar('Voltar a usar as metas calculadas automaticamente?'))) return;
    try { await api.del('/api/metas'); toast('Metas automáticas ativadas'); recarregar(); } catch (e) { erroToast(e); }
  });

  container.querySelector('#form-simulador').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target).entries());
    try {
      const r = await api.post('/api/calculadora', {
        sexo: dados.sexo,
        idade: Number(dados.idade),
        peso_kg: Number(dados.peso_kg),
        altura_cm: Number(dados.altura_cm),
        nivel_atividade: dados.nivel_atividade,
        objetivo: dados.objetivo,
      });
      container.querySelector('#resultado-simulador').innerHTML = `
        <div class="stat-grid">
          <div class="stat"><div class="lbl">TMB</div><div class="val kc">${num(r.tmb)}</div><div class="sub">kcal</div></div>
          <div class="stat"><div class="lbl">GET</div><div class="val kc">${num(r.get)}</div><div class="sub">kcal</div></div>
          <div class="stat"><div class="lbl">Meta</div><div class="val gd">${num(r.meta_kcal)}</div><div class="sub">kcal/dia</div></div>
          <div class="stat"><div class="lbl">Macros</div>
            <div class="val" style="font-size:1.0rem">
              <span class="pr">${num(r.macros.proteina_g)}P</span> ·
              <span class="cb">${num(r.macros.carbo_g)}C</span> ·
              <span class="ft">${num(r.macros.gordura_g)}G</span>
            </div>
            <div class="sub">água ${num(r.agua_ml)} ml</div>
          </div>
        </div>`;
    } catch (erro) { erroToast(erro); }
  });
}
