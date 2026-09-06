// Perfil, metas e calculadoras (TMB / GET / macros / agua).
import { exigirUsuario } from '../auth.js';
import { um, executar, todos } from '../db.js';
import { num, data, umDe, bool } from '../lib/validate.js';
import {
  resumoMetas, ACTIVITY_FACTORS, GOAL_LABELS, calcularTMB, calcularGET,
  calcularMetaCalorica, calcularMacros, calcularAgua, idadeEmAnos,
} from '../lib/calc.js';

const NIVEIS = Object.keys(ACTIVITY_FACTORS);
const OBJETIVOS = Object.keys(GOAL_LABELS);
const SEXOS = ['masculino', 'feminino'];

export function carregarPerfil(db, usuarioId) {
  const perfil = um(db, 'SELECT * FROM perfis WHERE usuario_id = ?', usuarioId);
  const ultima = um(
    db,
    'SELECT peso FROM medidas WHERE usuario_id = ? AND peso IS NOT NULL ORDER BY data DESC LIMIT 1',
    usuarioId,
  );
  return { ...perfil, peso_atual: ultima?.peso ?? perfil?.peso_inicial ?? null };
}

// Metas efetivas: personalizadas quando definidas, senao as calculadas.
export function metasEfetivas(db, usuarioId) {
  const perfil = carregarPerfil(db, usuarioId);
  const calculado = resumoMetas(perfil);
  const usarPersonalizadas = perfil.metas_personalizadas === 1;
  return {
    kcal: (usarPersonalizadas ? perfil.meta_kcal : null) ?? calculado.meta_kcal_sugerida,
    proteina_g: (usarPersonalizadas ? perfil.meta_proteina_g : null) ?? calculado.macros_sugeridos?.proteina_g ?? null,
    carbo_g: (usarPersonalizadas ? perfil.meta_carbo_g : null) ?? calculado.macros_sugeridos?.carbo_g ?? null,
    gordura_g: (usarPersonalizadas ? perfil.meta_gordura_g : null) ?? calculado.macros_sugeridos?.gordura_g ?? null,
    agua_ml: (usarPersonalizadas ? perfil.meta_agua_ml : null) ?? calculado.agua_ml_sugerida,
    personalizadas: usarPersonalizadas,
  };
}

export default function registrarRotasPerfil(router) {
  router.get('/api/perfil', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const perfil = carregarPerfil(ctx.db, usuario.id);
    return {
      perfil,
      calculado: resumoMetas(perfil),
      metas: metasEfetivas(ctx.db, usuario.id),
      opcoes: { niveis: NIVEIS, objetivos: GOAL_LABELS, sexos: SEXOS },
    };
  });

  router.put('/api/perfil', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    const campos = {
      sexo: umDe(corpo.sexo, 'sexo', SEXOS, { obrigatorio: false }),
      data_nascimento: data(corpo.data_nascimento, 'data_nascimento', { obrigatorio: false }),
      altura_cm: num(corpo.altura_cm, 'altura_cm', { obrigatorio: false, min: 80, max: 260 }),
      peso_inicial: num(corpo.peso_inicial, 'peso_inicial', { obrigatorio: false, min: 20, max: 400 }),
      peso_meta: num(corpo.peso_meta, 'peso_meta', { obrigatorio: false, min: 20, max: 400 }),
      nivel_atividade: umDe(corpo.nivel_atividade, 'nivel_atividade', NIVEIS, { obrigatorio: false, padrao: 'moderado' }),
      objetivo: umDe(corpo.objetivo, 'objetivo', OBJETIVOS, { obrigatorio: false, padrao: 'manutencao' }),
      metas_personalizadas: bool(corpo.metas_personalizadas) ? 1 : 0,
      meta_kcal: num(corpo.meta_kcal, 'meta_kcal', { obrigatorio: false, min: 0, max: 20000 }),
      meta_proteina_g: num(corpo.meta_proteina_g, 'meta_proteina_g', { obrigatorio: false, min: 0, max: 2000 }),
      meta_carbo_g: num(corpo.meta_carbo_g, 'meta_carbo_g', { obrigatorio: false, min: 0, max: 2000 }),
      meta_gordura_g: num(corpo.meta_gordura_g, 'meta_gordura_g', { obrigatorio: false, min: 0, max: 2000 }),
      meta_agua_ml: num(corpo.meta_agua_ml, 'meta_agua_ml', { obrigatorio: false, min: 0, max: 20000 }),
    };

    executar(
      ctx.db,
      `UPDATE perfis SET sexo = ?, data_nascimento = ?, altura_cm = ?, peso_inicial = ?, peso_meta = ?,
              nivel_atividade = ?, objetivo = ?, metas_personalizadas = ?, meta_kcal = ?, meta_proteina_g = ?,
              meta_carbo_g = ?, meta_gordura_g = ?, meta_agua_ml = ?, atualizado_em = ?
        WHERE usuario_id = ?`,
      campos.sexo, campos.data_nascimento, campos.altura_cm, campos.peso_inicial, campos.peso_meta,
      campos.nivel_atividade, campos.objetivo, campos.metas_personalizadas, campos.meta_kcal,
      campos.meta_proteina_g, campos.meta_carbo_g, campos.meta_gordura_g, campos.meta_agua_ml,
      new Date().toISOString(), usuario.id,
    );

    const perfil = carregarPerfil(ctx.db, usuario.id);
    return { perfil, calculado: resumoMetas(perfil), metas: metasEfetivas(ctx.db, usuario.id) };
  });

  // Calculadora avulsa: simula metas sem salvar no perfil.
  router.post('/api/calculadora', async (ctx) => {
    exigirUsuario(ctx);
    const corpo = await ctx.body();
    const sexo = umDe(corpo.sexo, 'sexo', SEXOS);
    const peso = num(corpo.peso_kg, 'peso_kg', { min: 20, max: 400 });
    const altura = num(corpo.altura_cm, 'altura_cm', { min: 80, max: 260 });
    const nivel = umDe(corpo.nivel_atividade, 'nivel_atividade', NIVEIS);
    const objetivo = umDe(corpo.objetivo, 'objetivo', OBJETIVOS);
    const idade = corpo.idade != null
      ? num(corpo.idade, 'idade', { min: 10, max: 120 })
      : idadeEmAnos(data(corpo.data_nascimento, 'data_nascimento'));

    const tmb = calcularTMB({ sexo, pesoKg: peso, alturaCm: altura, idade });
    const get = calcularGET(tmb, nivel);
    const metaKcal = calcularMetaCalorica(get, objetivo);
    return {
      idade,
      tmb,
      get,
      meta_kcal: metaKcal,
      macros: calcularMacros({ kcal: metaKcal, pesoKg: peso, objetivo }),
      agua_ml: calcularAgua(peso, nivel),
    };
  });

  router.get('/api/perfil/historico-metas', (ctx) => {
    const usuario = exigirUsuario(ctx);
    return {
      medidas: todos(
        ctx.db,
        'SELECT data, peso FROM medidas WHERE usuario_id = ? AND peso IS NOT NULL ORDER BY data',
        usuario.id,
      ),
    };
  });

  // Alias em portugues para leitura direta das metas.
  router.get('/api/metas', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const perfil = carregarPerfil(ctx.db, usuario.id);
    return { metas: metasEfetivas(ctx.db, usuario.id), calculado: resumoMetas(perfil), perfil };
  });

  router.put('/api/metas', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    executar(
      ctx.db,
      `UPDATE perfis SET metas_personalizadas = 1, meta_kcal = ?, meta_proteina_g = ?, meta_carbo_g = ?,
              meta_gordura_g = ?, meta_agua_ml = ?, atualizado_em = ? WHERE usuario_id = ?`,
      num(corpo.kcal, 'kcal', { min: 0, max: 20000 }),
      num(corpo.proteina_g, 'proteina_g', { min: 0, max: 2000 }),
      num(corpo.carbo_g, 'carbo_g', { min: 0, max: 2000 }),
      num(corpo.gordura_g, 'gordura_g', { min: 0, max: 2000 }),
      num(corpo.agua_ml, 'agua_ml', { obrigatorio: false, min: 0, max: 20000, padrao: null }),
      new Date().toISOString(), usuario.id,
    );
    return { metas: metasEfetivas(ctx.db, usuario.id) };
  });

  // Volta a usar as metas calculadas automaticamente.
  router.delete('/api/metas', (ctx) => {
    const usuario = exigirUsuario(ctx);
    executar(ctx.db, 'UPDATE perfis SET metas_personalizadas = 0 WHERE usuario_id = ?', usuario.id);
    return { metas: metasEfetivas(ctx.db, usuario.id) };
  });
}
