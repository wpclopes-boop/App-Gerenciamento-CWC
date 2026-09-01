// Evolucao corporal: medidas, peso e fotos de progresso.
import { exigirUsuario } from '../auth.js';
import { todos, um, executar } from '../db.js';
import { notFound, badRequest } from '../lib/http.js';
import { str, num, data as validarData, hoje } from '../lib/validate.js';
import { calcularIMC, classificarIMC } from '../lib/calc.js';
import { carregarPerfil } from './perfil.js';

const MIMES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAX_FOTO = 5 * 1024 * 1024;

export default function registrarRotasCorpo(router) {
  router.get('/api/medidas', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const perfil = carregarPerfil(ctx.db, usuario.id);
    const medidas = todos(ctx.db, 'SELECT * FROM medidas WHERE usuario_id = ? ORDER BY data DESC', usuario.id);
    const comImc = medidas.map((m) => ({
      ...m,
      imc: calcularIMC(m.peso, perfil.altura_cm),
      imc_classificacao: classificarIMC(calcularIMC(m.peso, perfil.altura_cm)),
    }));
    const pesos = medidas.filter((m) => m.peso != null);
    const atual = pesos[0]?.peso ?? null;
    const inicial = perfil.peso_inicial ?? pesos[pesos.length - 1]?.peso ?? null;
    return {
      medidas: comImc,
      resumo: {
        peso_inicial: inicial,
        peso_atual: atual,
        peso_meta: perfil.peso_meta,
        variacao: atual != null && inicial != null ? Math.round((atual - inicial) * 10) / 10 : null,
        restante: atual != null && perfil.peso_meta != null
          ? Math.round((perfil.peso_meta - atual) * 10) / 10
          : null,
      },
    };
  });

  // Uma medida por dia: nova gravacao no mesmo dia substitui a anterior.
  router.post('/api/medidas', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    const dia = validarData(corpo.data, 'data', { obrigatorio: false, padrao: hoje() });
    const campos = {
      peso: num(corpo.peso, 'peso', { obrigatorio: false, min: 20, max: 400 }),
      gordura_pct: num(corpo.gordura_pct, 'gordura_pct', { obrigatorio: false, min: 1, max: 70 }),
      peito_cm: num(corpo.peito_cm, 'peito_cm', { obrigatorio: false, min: 10, max: 300 }),
      cintura_cm: num(corpo.cintura_cm, 'cintura_cm', { obrigatorio: false, min: 10, max: 300 }),
      quadril_cm: num(corpo.quadril_cm, 'quadril_cm', { obrigatorio: false, min: 10, max: 300 }),
      braco_cm: num(corpo.braco_cm, 'braco_cm', { obrigatorio: false, min: 10, max: 150 }),
      coxa_cm: num(corpo.coxa_cm, 'coxa_cm', { obrigatorio: false, min: 10, max: 200 }),
      observacoes: str(corpo.observacoes, 'observacoes', { obrigatorio: false, max: 300 }),
    };
    if (Object.values(campos).every((v) => v == null)) {
      throw badRequest('Informe ao menos o peso ou uma medida');
    }

    executar(
      ctx.db,
      `INSERT INTO medidas (usuario_id, data, peso, gordura_pct, peito_cm, cintura_cm, quadril_cm, braco_cm, coxa_cm, observacoes, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (usuario_id, data) DO UPDATE SET
         peso = excluded.peso, gordura_pct = excluded.gordura_pct, peito_cm = excluded.peito_cm,
         cintura_cm = excluded.cintura_cm, quadril_cm = excluded.quadril_cm, braco_cm = excluded.braco_cm,
         coxa_cm = excluded.coxa_cm, observacoes = excluded.observacoes`,
      usuario.id, dia, campos.peso, campos.gordura_pct, campos.peito_cm, campos.cintura_cm,
      campos.quadril_cm, campos.braco_cm, campos.coxa_cm, campos.observacoes, new Date().toISOString(),
    );

    // Primeira pesagem tambem define o peso inicial do perfil, se ainda vazio.
    const perfil = um(ctx.db, 'SELECT peso_inicial FROM perfis WHERE usuario_id = ?', usuario.id);
    if (campos.peso != null && perfil && perfil.peso_inicial == null) {
      executar(ctx.db, 'UPDATE perfis SET peso_inicial = ? WHERE usuario_id = ?', campos.peso, usuario.id);
    }

    return {
      status: 201,
      dados: { medida: um(ctx.db, 'SELECT * FROM medidas WHERE usuario_id = ? AND data = ?', usuario.id, dia) },
    };
  });

  router.delete('/api/medidas/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const medida = um(ctx.db, 'SELECT id FROM medidas WHERE id = ? AND usuario_id = ?', ctx.params.id, usuario.id);
    if (!medida) throw notFound('Medida nao encontrada');
    executar(ctx.db, 'DELETE FROM medidas WHERE id = ?', medida.id);
    return { ok: true };
  });

  // ---------- Fotos de progresso ----------
  router.get('/api/fotos', (ctx) => {
    const usuario = exigirUsuario(ctx);
    return {
      fotos: todos(
        ctx.db,
        'SELECT id, data, mime, legenda, LENGTH(conteudo) AS bytes FROM fotos WHERE usuario_id = ? ORDER BY data DESC, id DESC',
        usuario.id,
      ),
    };
  });

  router.post('/api/fotos', async (ctx) => {
    const usuario = exigirUsuario(ctx);
    const corpo = await ctx.body();
    const mime = str(corpo.mime, 'mime', { max: 40 });
    if (!MIMES_PERMITIDOS.includes(mime)) throw badRequest('Formato aceito: JPEG, PNG ou WebP');
    const base64 = str(corpo.conteudo_base64, 'conteudo_base64', { max: 12_000_000 });
    const buffer = Buffer.from(base64.replace(/^data:[^,]+,/, ''), 'base64');
    if (!buffer.length) throw badRequest('Imagem vazia ou invalida');
    if (buffer.length > TAMANHO_MAX_FOTO) throw badRequest('Imagem acima de 5MB');

    const { id } = executar(
      ctx.db,
      'INSERT INTO fotos (usuario_id, data, mime, conteudo, legenda, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
      usuario.id,
      validarData(corpo.data, 'data', { obrigatorio: false, padrao: hoje() }),
      mime, buffer,
      str(corpo.legenda, 'legenda', { obrigatorio: false, max: 200 }),
      new Date().toISOString(),
    );
    return { status: 201, dados: { foto: { id, bytes: buffer.length } } };
  });

  router.get('/api/fotos/:id/arquivo', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const foto = um(ctx.db, 'SELECT mime, conteudo FROM fotos WHERE id = ? AND usuario_id = ?', ctx.params.id, usuario.id);
    if (!foto) throw notFound('Foto nao encontrada');
    const buffer = Buffer.from(foto.conteudo);
    ctx.res.writeHead(200, {
      'Content-Type': foto.mime,
      'Content-Length': buffer.length,
      'Cache-Control': 'private, max-age=86400',
    });
    ctx.res.end(buffer);
    return null; // resposta ja enviada
  });

  router.delete('/api/fotos/:id', (ctx) => {
    const usuario = exigirUsuario(ctx);
    const foto = um(ctx.db, 'SELECT id FROM fotos WHERE id = ? AND usuario_id = ?', ctx.params.id, usuario.id);
    if (!foto) throw notFound('Foto nao encontrada');
    executar(ctx.db, 'DELETE FROM fotos WHERE id = ?', foto.id);
    return { ok: true };
  });
}
