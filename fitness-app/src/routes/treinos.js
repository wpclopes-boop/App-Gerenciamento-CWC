// Exercicios, fichas de treino e registro de cargas (series).
import { exigirUsuario } from '../auth.js';
import { todos, um, executar } from '../db.js';
import { notFound, conflict } from '../lib/http.js';
import { str, num, int, data as validarData, hoje } from '../lib/validate.js';
import { estimar1RM } from '../lib/calc.js';

function exercicioDoUsuario(db, usuarioId, id) {
  const ex = um(db, 'SELECT * FROM exercicios WHERE id = ? AND usuario_id = ?', id, usuarioId);
  if (!ex) throw notFound('Exercicio nao encontrado');
  return ex;
}

function treinoDoUsuario(db, usuarioId, id) {
  const treino = um(db, 'SELECT * FROM treinos WHERE id = ? AND usuario_id = ?', id, usuarioId);
  if (!treino) throw notFound('Treino nao encontrado');
  return treino;
}

function itensDoTreino(db, treinoId) {
  return todos(
    db,
    `SELECT ti.*, e.nome AS exercicio_nome, e.grupo_muscular, e.equipamento
       FROM treino_itens ti JOIN exercicios e ON e.id = ti.exercicio_id
      WHERE ti.treino_id = ? ORDER BY ti.posicao, ti.id`,
    treinoId,
  );
}

// Recorde (maior carga) e ultimo registro de cada exercicio do usuario.
function recordesPorExercicio(db, usuarioId) {
  const linhas = todos(
    db,
    `SELECT exercicio_id,
            MAX(peso) AS peso_max,
            COUNT(*) AS total_series,
            MAX(data) AS ultima_data
       FROM series_registradas WHERE usuario_id = ? GROUP BY exercicio_id`,
    usuarioId,
  );
  const mapa = new Map();
  for (const linha of linhas) {
    const melhor = um(
      db,
      `SELECT peso, repeticoes, data FROM series_registradas
        WHERE usuario_id = ? AND exercicio_id = ? ORDER BY peso DESC, repeticoes DESC LIMIT 1`,
      usuarioId, linha.exercicio_id,
    );
    mapa.set(linha.exercicio_id, {
      recorde: melhor ? { ...melhor, rm_estimado: estimar1RM(melhor.peso, melhor.repeticoes) } : null,
      total_series: linha.total_series,
      ultima_data: linha.ultima_data,
    });
  }
  return mapa;
}

export default function registrarRotasTreinos(router) {
  // ---------- Exercicios ----------
  router.get('/api/exercicios', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const recordes = recordesPorExercicio(ctx.db, usuario.id);
    const lista = todos(
      ctx.db,
      'SELECT * FROM exercicios WHERE usuario_id = ? ORDER BY grupo_muscular, nome',
      usuario.id,
    );
    return { exercicios: lista.map((e) => ({ ...e, ...(recordes.get(e.id) ?? { recorde: null, total_series: 0 }) })) };
  });

  router.post('/api/exercicios', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    const nome = str(corpo.nome, 'nome', { max: 120 });
    if (um(ctx.db, 'SELECT id FROM exercicios WHERE usuario_id = ? AND nome = ?', usuario.id, nome)) {
      throw conflict('Ja existe um exercicio com esse nome');
    }
    const { id } = executar(
      ctx.db,
      'INSERT INTO exercicios (usuario_id, nome, grupo_muscular, equipamento) VALUES (?, ?, ?, ?)',
      usuario.id, nome,
      str(corpo.grupo_muscular, 'grupo_muscular', { obrigatorio: false, max: 80 }),
      str(corpo.equipamento, 'equipamento', { obrigatorio: false, max: 80 }),
    );
    return { status: 201, dados: { exercicio: um(ctx.db, 'SELECT * FROM exercicios WHERE id = ?', id) } };
  });

  router.put('/api/exercicios/:id', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const atual = exercicioDoUsuario(ctx.db, usuario.id, ctx.params.id);
    const corpo = await ctx.body();
    executar(
      ctx.db,
      'UPDATE exercicios SET nome = ?, grupo_muscular = ?, equipamento = ? WHERE id = ?',
      str(corpo.nome, 'nome', { obrigatorio: false, max: 120, padrao: atual.nome }),
      str(corpo.grupo_muscular, 'grupo_muscular', { obrigatorio: false, max: 80 }),
      str(corpo.equipamento, 'equipamento', { obrigatorio: false, max: 80 }),
      atual.id,
    );
    return { exercicio: um(ctx.db, 'SELECT * FROM exercicios WHERE id = ?', atual.id) };
  });

  router.delete('/api/exercicios/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const atual = exercicioDoUsuario(ctx.db, usuario.id, ctx.params.id);
    executar(ctx.db, 'DELETE FROM exercicios WHERE id = ?', atual.id);
    return { ok: true };
  });

  // ---------- Fichas de treino ----------
  router.get('/api/treinos', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const recordes = recordesPorExercicio(ctx.db, usuario.id);
    const treinos = todos(
      ctx.db,
      'SELECT * FROM treinos WHERE usuario_id = ? ORDER BY posicao, id',
      usuario.id,
    );
    return {
      treinos: treinos.map((t) => ({
        ...t,
        itens: itensDoTreino(ctx.db, t.id).map((item) => ({
          ...item,
          ...(recordes.get(item.exercicio_id) ?? { recorde: null, total_series: 0 }),
        })),
      })),
    };
  });

  router.post('/api/treinos', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    const maxPos = um(ctx.db, 'SELECT COALESCE(MAX(posicao), -1) AS p FROM treinos WHERE usuario_id = ?', usuario.id);
    const { id } = executar(
      ctx.db,
      'INSERT INTO treinos (usuario_id, nome, letra, cor, observacoes, posicao) VALUES (?, ?, ?, ?, ?, ?)',
      usuario.id,
      str(corpo.nome, 'nome', { max: 120 }),
      str(corpo.letra, 'letra', { obrigatorio: false, max: 4 }),
      str(corpo.cor, 'cor', { obrigatorio: false, max: 20, padrao: 'fire' }),
      str(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 500 }),
      (maxPos?.p ?? -1) + 1,
    );
    return { status: 201, dados: { treino: { ...um(ctx.db, 'SELECT * FROM treinos WHERE id = ?', id), itens: [] } } };
  });

  router.put('/api/treinos/:id', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const atual = treinoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    const corpo = await ctx.body();
    executar(
      ctx.db,
      'UPDATE treinos SET nome = ?, letra = ?, cor = ?, observacoes = ?, posicao = ? WHERE id = ?',
      str(corpo.nome, 'nome', { obrigatorio: false, max: 120, padrao: atual.nome }),
      str(corpo.letra, 'letra', { obrigatorio: false, max: 4 }),
      str(corpo.cor, 'cor', { obrigatorio: false, max: 20, padrao: atual.cor }),
      str(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 500 }),
      int(corpo.posicao, 'posicao', { obrigatorio: false, min: 0, max: 999, padrao: atual.posicao }),
      atual.id,
    );
    const treino = um(ctx.db, 'SELECT * FROM treinos WHERE id = ?', atual.id);
    return { treino: { ...treino, itens: itensDoTreino(ctx.db, atual.id) } };
  });

  router.delete('/api/treinos/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const atual = treinoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    executar(ctx.db, 'DELETE FROM treinos WHERE id = ?', atual.id);
    return { ok: true };
  });

  router.post('/api/treinos/:id/itens', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const treino = treinoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    const corpo = await ctx.body();
    const exercicio = exercicioDoUsuario(ctx.db, usuario.id, int(corpo.exercicio_id, 'exercicio_id', { min: 1 }));
    const maxPos = um(ctx.db, 'SELECT COALESCE(MAX(posicao), -1) AS p FROM treino_itens WHERE treino_id = ?', treino.id);
    const { id } = executar(
      ctx.db,
      `INSERT INTO treino_itens (treino_id, exercicio_id, series, repeticoes, descanso, observacoes, posicao)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      treino.id, exercicio.id,
      str(corpo.series, 'series', { obrigatorio: false, max: 20, padrao: '3' }),
      str(corpo.repeticoes, 'repeticoes', { obrigatorio: false, max: 30, padrao: '10-12' }),
      str(corpo.descanso, 'descanso', { obrigatorio: false, max: 20, padrao: '60s' }),
      str(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 300 }),
      (maxPos?.p ?? -1) + 1,
    );
    return { status: 201, dados: { item: um(ctx.db, 'SELECT * FROM treino_itens WHERE id = ?', id) } };
  });

  router.put('/api/treino-itens/:id', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const item = um(
      ctx.db,
      `SELECT ti.* FROM treino_itens ti JOIN treinos t ON t.id = ti.treino_id
        WHERE ti.id = ? AND t.usuario_id = ?`,
      ctx.params.id, usuario.id,
    );
    if (!item) throw notFound('Item de treino nao encontrado');
    const corpo = await ctx.body();
    executar(
      ctx.db,
      'UPDATE treino_itens SET series = ?, repeticoes = ?, descanso = ?, observacoes = ?, posicao = ? WHERE id = ?',
      str(corpo.series, 'series', { obrigatorio: false, max: 20, padrao: item.series }),
      str(corpo.repeticoes, 'repeticoes', { obrigatorio: false, max: 30, padrao: item.repeticoes }),
      str(corpo.descanso, 'descanso', { obrigatorio: false, max: 20, padrao: item.descanso }),
      str(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 300, padrao: item.observacoes }),
      int(corpo.posicao, 'posicao', { obrigatorio: false, min: 0, max: 999, padrao: item.posicao }),
      item.id,
    );
    return { item: um(ctx.db, 'SELECT * FROM treino_itens WHERE id = ?', item.id) };
  });

  router.delete('/api/treino-itens/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const item = um(
      ctx.db,
      `SELECT ti.id FROM treino_itens ti JOIN treinos t ON t.id = ti.treino_id
        WHERE ti.id = ? AND t.usuario_id = ?`,
      ctx.params.id, usuario.id,
    );
    if (!item) throw notFound('Item de treino nao encontrado');
    executar(ctx.db, 'DELETE FROM treino_itens WHERE id = ?', item.id);
    return { ok: true };
  });

  // ---------- Registro de cargas ----------
  router.get('/api/series', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const exercicioId = ctx.query.get('exercicio_id');
    const limite = Math.min(Number(ctx.query.get('limite')) || 50, 500);
    const filtros = ['s.usuario_id = ?'];
    const params = [usuario.id];
    if (exercicioId) {
      filtros.push('s.exercicio_id = ?');
      params.push(Number(exercicioId));
    }
    if (ctx.query.get('data')) {
      filtros.push('s.data = ?');
      params.push(validarData(ctx.query.get('data'), 'data'));
    }
    const series = todos(
      ctx.db,
      `SELECT s.*, e.nome AS exercicio_nome FROM series_registradas s
         JOIN exercicios e ON e.id = s.exercicio_id
        WHERE ${filtros.join(' AND ')}
        ORDER BY s.data DESC, s.id DESC LIMIT ${limite}`,
      ...params,
    );
    return { series: series.map((s) => ({ ...s, rm_estimado: estimar1RM(s.peso, s.repeticoes) })) };
  });

  router.post('/api/series', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    const exercicio = exercicioDoUsuario(ctx.db, usuario.id, int(corpo.exercicio_id, 'exercicio_id', { min: 1 }));
    const treinoId = corpo.treino_id ? treinoDoUsuario(ctx.db, usuario.id, int(corpo.treino_id, 'treino_id')).id : null;
    const { id } = executar(
      ctx.db,
      `INSERT INTO series_registradas (usuario_id, exercicio_id, treino_id, data, peso, repeticoes, observacoes, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      usuario.id, exercicio.id, treinoId,
      validarData(corpo.data, 'data', { obrigatorio: false, padrao: hoje() }),
      num(corpo.peso, 'peso', { min: 0, max: 1000 }),
      int(corpo.repeticoes, 'repeticoes', { min: 1, max: 1000 }),
      str(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 300 }),
      new Date().toISOString(),
    );
    const serie = um(ctx.db, 'SELECT * FROM series_registradas WHERE id = ?', id);
    const recorde = um(
      ctx.db,
      `SELECT MAX(peso) AS peso_max FROM series_registradas WHERE usuario_id = ? AND exercicio_id = ?`,
      usuario.id, exercicio.id,
    );
    return {
      status: 201,
      dados: {
        serie: { ...serie, rm_estimado: estimar1RM(serie.peso, serie.repeticoes) },
        novo_recorde: recorde?.peso_max === serie.peso,
      },
    };
  });

  router.delete('/api/series/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const serie = um(
      ctx.db, 'SELECT id FROM series_registradas WHERE id = ? AND usuario_id = ?', ctx.params.id, usuario.id,
    );
    if (!serie) throw notFound('Registro nao encontrado');
    executar(ctx.db, 'DELETE FROM series_registradas WHERE id = ?', serie.id);
    return { ok: true };
  });

  // Volume semanal (carga x reps) para o grafico de evolucao de forca.
  router.get('/api/series/estatisticas', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const porSemana = todos(
      ctx.db,
      `SELECT strftime('%Y-%W', data) AS semana,
              MIN(data) AS inicio,
              SUM(peso * repeticoes) AS volume,
              COUNT(*) AS series
         FROM series_registradas WHERE usuario_id = ?
        GROUP BY semana ORDER BY semana DESC LIMIT 12`,
      usuario.id,
    );
    const porExercicio = todos(
      ctx.db,
      `SELECT e.id, e.nome, MAX(s.peso) AS carga_maxima, COUNT(*) AS series, MAX(s.data) AS ultima_data
         FROM series_registradas s JOIN exercicios e ON e.id = s.exercicio_id
        WHERE s.usuario_id = ? GROUP BY e.id ORDER BY carga_maxima DESC`,
      usuario.id,
    );
    return { por_semana: porSemana.reverse(), por_exercicio: porExercicio };
  });
}
