// Painel: visao consolidada do dia, da semana e da evolucao.
import { exigirUsuario } from '../auth.js';
import { todos, um } from '../db.js';
import { data as validarData, hoje } from '../lib/validate.js';
import { metasEfetivas, carregarPerfil } from './perfil.js';
import { resumoMetas } from '../lib/calc.js';
import { somarMacros } from './nutricao.js';

function diasAtras(dias, base = new Date()) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function registrarRotasPainel(router) {
  router.get('/api/painel', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const dia = validarData(ctx.query.get('data'), 'data', { obrigatorio: false, padrao: hoje() });
    const metas = metasEfetivas(ctx.db, usuario.id);
    const perfil = carregarPerfil(ctx.db, usuario.id);

    const entradas = todos(
      ctx.db, 'SELECT * FROM diario_refeicoes WHERE usuario_id = ? AND data = ?', usuario.id, dia,
    );
    const consumo = somarMacros(entradas);
    const agua = um(
      ctx.db, 'SELECT COALESCE(SUM(ml), 0) AS total FROM agua WHERE usuario_id = ? AND data = ?', usuario.id, dia,
    );

    const inicioSemana = diasAtras(6, new Date(`${dia}T00:00:00Z`));
    const treinosSemana = todos(
      ctx.db,
      `SELECT data, COUNT(*) AS series, SUM(peso * repeticoes) AS volume
         FROM series_registradas WHERE usuario_id = ? AND data BETWEEN ? AND ?
        GROUP BY data ORDER BY data`,
      usuario.id, inicioSemana, dia,
    );

    const kcalSemana = todos(
      ctx.db,
      `SELECT data, SUM(kcal) AS kcal, SUM(proteina_g) AS proteina_g
         FROM diario_refeicoes WHERE usuario_id = ? AND data BETWEEN ? AND ?
        GROUP BY data ORDER BY data`,
      usuario.id, inicioSemana, dia,
    );

    const pesos = todos(
      ctx.db,
      'SELECT data, peso FROM medidas WHERE usuario_id = ? AND peso IS NOT NULL ORDER BY data',
      usuario.id,
    );
    const pesoAtual = pesos.length ? pesos[pesos.length - 1].peso : null;
    const pesoInicial = perfil.peso_inicial ?? (pesos.length ? pesos[0].peso : null);

    const recordes = todos(
      ctx.db,
      `SELECT e.nome, s.peso, s.repeticoes, s.data
         FROM series_registradas s JOIN exercicios e ON e.id = s.exercicio_id
        WHERE s.usuario_id = ? AND s.peso = (
          SELECT MAX(s2.peso) FROM series_registradas s2
           WHERE s2.usuario_id = s.usuario_id AND s2.exercicio_id = s.exercicio_id)
        GROUP BY s.exercicio_id ORDER BY s.data DESC LIMIT 6`,
      usuario.id,
    );

    return {
      data: dia,
      metas,
      consumo,
      restante: {
        kcal: metas.kcal != null ? Math.round(metas.kcal - consumo.kcal) : null,
        proteina_g: metas.proteina_g != null ? Math.round((metas.proteina_g - consumo.proteina_g) * 10) / 10 : null,
        carbo_g: metas.carbo_g != null ? Math.round((metas.carbo_g - consumo.carbo_g) * 10) / 10 : null,
        gordura_g: metas.gordura_g != null ? Math.round((metas.gordura_g - consumo.gordura_g) * 10) / 10 : null,
      },
      agua: { consumido_ml: agua?.total ?? 0, meta_ml: metas.agua_ml },
      semana: {
        inicio: inicioSemana,
        fim: dia,
        treinos: treinosSemana,
        dias_treinados: treinosSemana.length,
        kcal_por_dia: kcalSemana,
      },
      peso: {
        historico: pesos,
        inicial: pesoInicial,
        atual: pesoAtual,
        meta: perfil.peso_meta,
        variacao: pesoAtual != null && pesoInicial != null ? Math.round((pesoAtual - pesoInicial) * 10) / 10 : null,
        restante: pesoAtual != null && perfil.peso_meta != null
          ? Math.round((perfil.peso_meta - pesoAtual) * 10) / 10
          : null,
      },
      recordes,
      calculado: resumoMetas(perfil),
    };
  });
}
