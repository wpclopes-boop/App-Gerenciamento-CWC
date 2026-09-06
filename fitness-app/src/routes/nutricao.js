// Alimentos, planos alimentares, diario de refeicoes e consumo de agua.
import { exigirUsuario } from '../auth.js';
import { todos, um, executar } from '../db.js';
import { notFound, conflict, badRequest } from '../lib/http.js';
import { str, num, int, umDe, data as validarData, hoje } from '../lib/validate.js';
import { metasEfetivas } from './perfil.js';

const UNIDADES = ['g', 'ml', 'un'];

const arredondar = (n) => Math.round(n * 10) / 10;

export function macrosDoItem(alimento, quantidade) {
  const fator = quantidade / (alimento.porcao_base || 100);
  return {
    kcal: Math.round(alimento.kcal * fator),
    proteina_g: arredondar(alimento.proteina_g * fator),
    carbo_g: arredondar(alimento.carbo_g * fator),
    gordura_g: arredondar(alimento.gordura_g * fator),
  };
}

export function somarMacros(itens) {
  return itens.reduce((acc, i) => ({
    kcal: Math.round(acc.kcal + (i.kcal || 0)),
    proteina_g: arredondar(acc.proteina_g + (i.proteina_g || 0)),
    carbo_g: arredondar(acc.carbo_g + (i.carbo_g || 0)),
    gordura_g: arredondar(acc.gordura_g + (i.gordura_g || 0)),
  }), { kcal: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0 });
}

function alimentoDoUsuario(db, usuarioId, id) {
  const alimento = um(db, 'SELECT * FROM alimentos WHERE id = ? AND usuario_id = ?', id, usuarioId);
  if (!alimento) throw notFound('Alimento nao encontrado');
  return alimento;
}

function planoDoUsuario(db, usuarioId, id) {
  const plano = um(db, 'SELECT * FROM planos_dia WHERE id = ? AND usuario_id = ?', id, usuarioId);
  if (!plano) throw notFound('Plano nao encontrado');
  return plano;
}

function refeicaoDoUsuario(db, usuarioId, id) {
  const refeicao = um(
    db,
    `SELECT r.* FROM plano_refeicoes r JOIN planos_dia p ON p.id = r.plano_id
      WHERE r.id = ? AND p.usuario_id = ?`,
    id, usuarioId,
  );
  if (!refeicao) throw notFound('Refeicao nao encontrada');
  return refeicao;
}

export function montarPlano(db, plano) {
  const refeicoes = todos(
    db,
    'SELECT * FROM plano_refeicoes WHERE plano_id = ? ORDER BY posicao, id',
    plano.id,
  ).map((refeicao) => {
    const itens = todos(
      db,
      `SELECT pi.id, pi.quantidade, pi.posicao, a.id AS alimento_id, a.nome, a.unidade,
              a.porcao_base, a.kcal, a.proteina_g, a.carbo_g, a.gordura_g
         FROM plano_itens pi JOIN alimentos a ON a.id = pi.alimento_id
        WHERE pi.refeicao_id = ? ORDER BY pi.posicao, pi.id`,
      refeicao.id,
    ).map((item) => ({
      id: item.id,
      alimento_id: item.alimento_id,
      nome: item.nome,
      unidade: item.unidade,
      quantidade: item.quantidade,
      ...macrosDoItem(item, item.quantidade),
    }));
    return { ...refeicao, itens, totais: somarMacros(itens) };
  });
  return { ...plano, refeicoes, totais: somarMacros(refeicoes.map((r) => r.totais)) };
}

export default function registrarRotasNutricao(router) {
  // ---------- Alimentos ----------
  router.get('/api/alimentos', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const busca = (ctx.query.get('busca') || '').trim();
    const lista = busca
      ? todos(
        ctx.db,
        'SELECT * FROM alimentos WHERE usuario_id = ? AND nome LIKE ? ORDER BY nome LIMIT 100',
        usuario.id, `%${busca}%`,
      )
      : todos(ctx.db, 'SELECT * FROM alimentos WHERE usuario_id = ? ORDER BY nome', usuario.id);
    return { alimentos: lista };
  });

  router.post('/api/alimentos', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    const nome = str(corpo.nome, 'nome', { max: 120 });
    if (um(ctx.db, 'SELECT id FROM alimentos WHERE usuario_id = ? AND nome = ?', usuario.id, nome)) {
      throw conflict('Ja existe um alimento com esse nome');
    }
    const { id } = executar(
      ctx.db,
      `INSERT INTO alimentos (usuario_id, nome, unidade, porcao_base, kcal, proteina_g, carbo_g, gordura_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      usuario.id, nome,
      umDe(corpo.unidade, 'unidade', UNIDADES, { obrigatorio: false, padrao: 'g' }),
      num(corpo.porcao_base, 'porcao_base', { obrigatorio: false, min: 0.1, max: 10000, padrao: 100 }),
      num(corpo.kcal, 'kcal', { min: 0, max: 10000 }),
      num(corpo.proteina_g, 'proteina_g', { obrigatorio: false, min: 0, max: 1000, padrao: 0 }),
      num(corpo.carbo_g, 'carbo_g', { obrigatorio: false, min: 0, max: 1000, padrao: 0 }),
      num(corpo.gordura_g, 'gordura_g', { obrigatorio: false, min: 0, max: 1000, padrao: 0 }),
    );
    return { status: 201, dados: { alimento: um(ctx.db, 'SELECT * FROM alimentos WHERE id = ?', id) } };
  });

  router.put('/api/alimentos/:id', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const atual = alimentoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    const corpo = await ctx.body();
    executar(
      ctx.db,
      `UPDATE alimentos SET nome = ?, unidade = ?, porcao_base = ?, kcal = ?, proteina_g = ?, carbo_g = ?, gordura_g = ?
        WHERE id = ?`,
      str(corpo.nome, 'nome', { obrigatorio: false, max: 120, padrao: atual.nome }),
      umDe(corpo.unidade, 'unidade', UNIDADES, { obrigatorio: false, padrao: atual.unidade }),
      num(corpo.porcao_base, 'porcao_base', { obrigatorio: false, min: 0.1, max: 10000, padrao: atual.porcao_base }),
      num(corpo.kcal, 'kcal', { obrigatorio: false, min: 0, max: 10000, padrao: atual.kcal }),
      num(corpo.proteina_g, 'proteina_g', { obrigatorio: false, min: 0, max: 1000, padrao: atual.proteina_g }),
      num(corpo.carbo_g, 'carbo_g', { obrigatorio: false, min: 0, max: 1000, padrao: atual.carbo_g }),
      num(corpo.gordura_g, 'gordura_g', { obrigatorio: false, min: 0, max: 1000, padrao: atual.gordura_g }),
      atual.id,
    );
    return { alimento: um(ctx.db, 'SELECT * FROM alimentos WHERE id = ?', atual.id) };
  });

  router.delete('/api/alimentos/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const atual = alimentoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    executar(ctx.db, 'DELETE FROM alimentos WHERE id = ?', atual.id);
    return { ok: true };
  });

  // ---------- Planos alimentares ----------
  router.get('/api/planos', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const planos = todos(ctx.db, 'SELECT * FROM planos_dia WHERE usuario_id = ? ORDER BY posicao, id', usuario.id);
    return { planos: planos.map((p) => montarPlano(ctx.db, p)) };
  });

  router.post('/api/planos', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    const maxPos = um(ctx.db, 'SELECT COALESCE(MAX(posicao), -1) AS p FROM planos_dia WHERE usuario_id = ?', usuario.id);
    const { id } = executar(
      ctx.db,
      'INSERT INTO planos_dia (usuario_id, nome, descricao, cor, posicao) VALUES (?, ?, ?, ?, ?)',
      usuario.id,
      str(corpo.nome, 'nome', { max: 120 }),
      str(corpo.descricao, 'descricao', { obrigatorio: false, max: 300 }),
      str(corpo.cor, 'cor', { obrigatorio: false, max: 20, padrao: 'fire' }),
      (maxPos?.p ?? -1) + 1,
    );
    return { status: 201, dados: { plano: montarPlano(ctx.db, um(ctx.db, 'SELECT * FROM planos_dia WHERE id = ?', id)) } };
  });

  router.put('/api/planos/:id', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const atual = planoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    const corpo = await ctx.body();
    executar(
      ctx.db,
      'UPDATE planos_dia SET nome = ?, descricao = ?, cor = ?, posicao = ? WHERE id = ?',
      str(corpo.nome, 'nome', { obrigatorio: false, max: 120, padrao: atual.nome }),
      str(corpo.descricao, 'descricao', { obrigatorio: false, max: 300, padrao: atual.descricao }),
      str(corpo.cor, 'cor', { obrigatorio: false, max: 20, padrao: atual.cor }),
      int(corpo.posicao, 'posicao', { obrigatorio: false, min: 0, max: 999, padrao: atual.posicao }),
      atual.id,
    );
    return { plano: montarPlano(ctx.db, um(ctx.db, 'SELECT * FROM planos_dia WHERE id = ?', atual.id)) };
  });

  router.delete('/api/planos/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const atual = planoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    executar(ctx.db, 'DELETE FROM planos_dia WHERE id = ?', atual.id);
    return { ok: true };
  });

  router.post('/api/planos/:id/refeicoes', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const plano = planoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    const corpo = await ctx.body();
    const maxPos = um(ctx.db, 'SELECT COALESCE(MAX(posicao), -1) AS p FROM plano_refeicoes WHERE plano_id = ?', plano.id);
    executar(
      ctx.db,
      'INSERT INTO plano_refeicoes (plano_id, nome, dica, posicao) VALUES (?, ?, ?, ?)',
      plano.id,
      str(corpo.nome, 'nome', { max: 80 }),
      str(corpo.dica, 'dica', { obrigatorio: false, max: 200 }),
      (maxPos?.p ?? -1) + 1,
    );
    return { status: 201, dados: { plano: montarPlano(ctx.db, plano) } };
  });

  router.put('/api/plano-refeicoes/:id', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const refeicao = refeicaoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    const corpo = await ctx.body();
    executar(
      ctx.db,
      'UPDATE plano_refeicoes SET nome = ?, dica = ?, posicao = ? WHERE id = ?',
      str(corpo.nome, 'nome', { obrigatorio: false, max: 80, padrao: refeicao.nome }),
      str(corpo.dica, 'dica', { obrigatorio: false, max: 200, padrao: refeicao.dica }),
      int(corpo.posicao, 'posicao', { obrigatorio: false, min: 0, max: 999, padrao: refeicao.posicao }),
      refeicao.id,
    );
    const plano = um(ctx.db, 'SELECT * FROM planos_dia WHERE id = ?', refeicao.plano_id);
    return { plano: montarPlano(ctx.db, plano) };
  });

  router.delete('/api/plano-refeicoes/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const refeicao = refeicaoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    executar(ctx.db, 'DELETE FROM plano_refeicoes WHERE id = ?', refeicao.id);
    return { ok: true };
  });

  router.post('/api/plano-refeicoes/:id/itens', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const refeicao = refeicaoDoUsuario(ctx.db, usuario.id, ctx.params.id);
    const corpo = await ctx.body();
    const alimento = alimentoDoUsuario(ctx.db, usuario.id, int(corpo.alimento_id, 'alimento_id', { min: 1 }));
    const maxPos = um(ctx.db, 'SELECT COALESCE(MAX(posicao), -1) AS p FROM plano_itens WHERE refeicao_id = ?', refeicao.id);
    executar(
      ctx.db,
      'INSERT INTO plano_itens (refeicao_id, alimento_id, quantidade, posicao) VALUES (?, ?, ?, ?)',
      refeicao.id, alimento.id,
      num(corpo.quantidade, 'quantidade', { min: 0.1, max: 10000 }),
      (maxPos?.p ?? -1) + 1,
    );
    const plano = um(ctx.db, 'SELECT * FROM planos_dia WHERE id = ?', refeicao.plano_id);
    return { status: 201, dados: { plano: montarPlano(ctx.db, plano) } };
  });

  router.put('/api/plano-itens/:id', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const item = um(
      ctx.db,
      `SELECT pi.*, p.id AS plano_id FROM plano_itens pi
         JOIN plano_refeicoes r ON r.id = pi.refeicao_id
         JOIN planos_dia p ON p.id = r.plano_id
        WHERE pi.id = ? AND p.usuario_id = ?`,
      ctx.params.id, usuario.id,
    );
    if (!item) throw notFound('Item do plano nao encontrado');
    const corpo = await ctx.body();
    executar(
      ctx.db, 'UPDATE plano_itens SET quantidade = ? WHERE id = ?',
      num(corpo.quantidade, 'quantidade', { min: 0.1, max: 10000 }), item.id,
    );
    return { plano: montarPlano(ctx.db, um(ctx.db, 'SELECT * FROM planos_dia WHERE id = ?', item.plano_id)) };
  });

  router.delete('/api/plano-itens/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const item = um(
      ctx.db,
      `SELECT pi.id FROM plano_itens pi
         JOIN plano_refeicoes r ON r.id = pi.refeicao_id
         JOIN planos_dia p ON p.id = r.plano_id
        WHERE pi.id = ? AND p.usuario_id = ?`,
      ctx.params.id, usuario.id,
    );
    if (!item) throw notFound('Item do plano nao encontrado');
    executar(ctx.db, 'DELETE FROM plano_itens WHERE id = ?', item.id);
    return { ok: true };
  });

  // Copia todas as refeicoes do plano para o diario de uma data.
  router.post('/api/planos/:id/aplicar', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const plano = montarPlano(ctx.db, planoDoUsuario(ctx.db, usuario.id, ctx.params.id));
    const corpo = await ctx.body();
    const dia = validarData(corpo.data, 'data', { obrigatorio: false, padrao: hoje() });
    const substituir = corpo.substituir !== false;
    const agora = new Date().toISOString();

    if (substituir) executar(ctx.db, 'DELETE FROM diario_refeicoes WHERE usuario_id = ? AND data = ?', usuario.id, dia);

    let total = 0;
    for (const refeicao of plano.refeicoes) {
      for (const item of refeicao.itens) {
        executar(
          ctx.db,
          `INSERT INTO diario_refeicoes
             (usuario_id, data, refeicao, alimento_id, nome, quantidade, unidade, kcal, proteina_g, carbo_g, gordura_g, criado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          usuario.id, dia, refeicao.nome, item.alimento_id, item.nome, item.quantidade, item.unidade,
          item.kcal, item.proteina_g, item.carbo_g, item.gordura_g, agora,
        );
        total += 1;
      }
    }
    return { ok: true, itens_criados: total, data: dia };
  });

  // ---------- Diario ----------
  router.get('/api/diario', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const dia = validarData(ctx.query.get('data'), 'data', { obrigatorio: false, padrao: hoje() });
    const entradas = todos(
      ctx.db,
      'SELECT * FROM diario_refeicoes WHERE usuario_id = ? AND data = ? ORDER BY id',
      usuario.id, dia,
    );
    const porRefeicao = new Map();
    for (const entrada of entradas) {
      if (!porRefeicao.has(entrada.refeicao)) porRefeicao.set(entrada.refeicao, []);
      porRefeicao.get(entrada.refeicao).push(entrada);
    }
    const agua = um(
      ctx.db, 'SELECT COALESCE(SUM(ml), 0) AS total FROM agua WHERE usuario_id = ? AND data = ?', usuario.id, dia,
    );
    return {
      data: dia,
      refeicoes: [...porRefeicao.entries()].map(([nome, itens]) => ({ nome, itens, totais: somarMacros(itens) })),
      totais: somarMacros(entradas),
      agua_ml: agua?.total ?? 0,
      metas: metasEfetivas(ctx.db, usuario.id),
    };
  });

  router.post('/api/diario', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    const dia = validarData(corpo.data, 'data', { obrigatorio: false, padrao: hoje() });
    const refeicao = str(corpo.refeicao, 'refeicao', { max: 80 });
    let registro;

    if (corpo.alimento_id) {
      const alimento = alimentoDoUsuario(ctx.db, usuario.id, int(corpo.alimento_id, 'alimento_id', { min: 1 }));
      const quantidade = num(corpo.quantidade, 'quantidade', { min: 0.1, max: 10000 });
      registro = {
        alimento_id: alimento.id,
        nome: alimento.nome,
        quantidade,
        unidade: alimento.unidade,
        ...macrosDoItem(alimento, quantidade),
      };
    } else if (corpo.nome) {
      registro = {
        alimento_id: null,
        nome: str(corpo.nome, 'nome', { max: 120 }),
        quantidade: num(corpo.quantidade, 'quantidade', { obrigatorio: false, min: 0, max: 10000, padrao: 1 }),
        unidade: umDe(corpo.unidade, 'unidade', UNIDADES, { obrigatorio: false, padrao: 'un' }),
        kcal: num(corpo.kcal, 'kcal', { min: 0, max: 20000 }),
        proteina_g: num(corpo.proteina_g, 'proteina_g', { obrigatorio: false, min: 0, max: 2000, padrao: 0 }),
        carbo_g: num(corpo.carbo_g, 'carbo_g', { obrigatorio: false, min: 0, max: 2000, padrao: 0 }),
        gordura_g: num(corpo.gordura_g, 'gordura_g', { obrigatorio: false, min: 0, max: 2000, padrao: 0 }),
      };
    } else {
      throw badRequest('Informe "alimento_id" ou "nome" com os macros do item');
    }

    const { id } = executar(
      ctx.db,
      `INSERT INTO diario_refeicoes
         (usuario_id, data, refeicao, alimento_id, nome, quantidade, unidade, kcal, proteina_g, carbo_g, gordura_g, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      usuario.id, dia, refeicao, registro.alimento_id, registro.nome, registro.quantidade, registro.unidade,
      registro.kcal, registro.proteina_g, registro.carbo_g, registro.gordura_g, new Date().toISOString(),
    );
    return { status: 201, dados: { entrada: um(ctx.db, 'SELECT * FROM diario_refeicoes WHERE id = ?', id) } };
  });

  router.delete('/api/diario/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const entrada = um(
      ctx.db, 'SELECT id FROM diario_refeicoes WHERE id = ? AND usuario_id = ?', ctx.params.id, usuario.id,
    );
    if (!entrada) throw notFound('Registro do diario nao encontrado');
    executar(ctx.db, 'DELETE FROM diario_refeicoes WHERE id = ?', entrada.id);
    return { ok: true };
  });

  // ---------- Agua ----------
  router.get('/api/agua', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const dia = validarData(ctx.query.get('data'), 'data', { obrigatorio: false, padrao: hoje() });
    const registros = todos(ctx.db, 'SELECT * FROM agua WHERE usuario_id = ? AND data = ? ORDER BY id', usuario.id, dia);
    const total = registros.reduce((acc, r) => acc + r.ml, 0);
    return { data: dia, registros, total_ml: total, meta_ml: metasEfetivas(ctx.db, usuario.id).agua_ml };
  });

  router.post('/api/agua', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    executar(
      ctx.db, 'INSERT INTO agua (usuario_id, data, ml, criado_em) VALUES (?, ?, ?, ?)',
      usuario.id,
      validarData(corpo.data, 'data', { obrigatorio: false, padrao: hoje() }),
      num(corpo.ml, 'ml', { min: 1, max: 5000 }),
      new Date().toISOString(),
    );
    return { status: 201, dados: { ok: true } };
  });

  router.delete('/api/agua/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const registro = um(ctx.db, 'SELECT id FROM agua WHERE id = ? AND usuario_id = ?', ctx.params.id, usuario.id);
    if (!registro) throw notFound('Registro de agua nao encontrado');
    executar(ctx.db, 'DELETE FROM agua WHERE id = ?', registro.id);
    return { ok: true };
  });
}
