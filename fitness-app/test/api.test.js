import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { abrirBanco } from '../src/db.js';
import { criarServidor } from '../src/server.js';

// Cliente minimalista que guarda o cookie de sessao entre chamadas.
function criarCliente(base) {
  let cookie = null;
  return async function chamar(metodo, caminho, corpo) {
    const opcoes = { method: metodo, headers: {} };
    if (cookie) opcoes.headers.cookie = cookie;
    if (corpo !== undefined) {
      opcoes.headers['content-type'] = 'application/json';
      opcoes.body = JSON.stringify(corpo);
    }
    const resposta = await fetch(`${base}${caminho}`, opcoes);
    const setCookie = resposta.headers.getSetCookie?.()[0];
    if (setCookie) cookie = setCookie.split(';')[0];
    const texto = await resposta.text();
    return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
  };
}

async function subirServidor() {
  const db = abrirBanco(':memory:');
  const servidor = criarServidor(db);
  servidor.listen(0);
  await once(servidor, 'listening');
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return {
    chamar: criarCliente(base),
    novoCliente: () => criarCliente(base),
    fechar: () => { servidor.close(); db.close(); },
  };
}

async function comConta(chamar, email = 'atleta@teste.com') {
  const r = await chamar('POST', '/api/auth/cadastro', { nome: 'Atleta', email, senha: 'senha12345' });
  assert.equal(r.status, 201);
  return r.corpo.usuario;
}

test('cadastro cria conta com dados iniciais e mantem a sessao', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);

  const usuario = await comConta(app.chamar);
  assert.equal(usuario.email, 'atleta@teste.com');

  const eu = await app.chamar('GET', '/api/auth/eu');
  assert.equal(eu.corpo.usuario.id, usuario.id);

  const treinos = await app.chamar('GET', '/api/treinos');
  assert.equal(treinos.corpo.treinos.length, 3);
  assert.ok(treinos.corpo.treinos[0].itens.length > 0);

  const alimentos = await app.chamar('GET', '/api/alimentos');
  assert.ok(alimentos.corpo.alimentos.length >= 30);

  const planos = await app.chamar('GET', '/api/planos');
  assert.equal(planos.corpo.planos.length, 3);
  assert.ok(planos.corpo.planos[0].totais.kcal > 1000);
});

test('e-mail duplicado e senha curta sao rejeitados', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  const duplicado = await app.novoCliente()('POST', '/api/auth/cadastro', {
    nome: 'Outro', email: 'atleta@teste.com', senha: 'senha12345',
  });
  assert.equal(duplicado.status, 409);

  const curta = await app.novoCliente()('POST', '/api/auth/cadastro', {
    nome: 'Outro', email: 'outro@teste.com', senha: '123',
  });
  assert.equal(curta.status, 400);
});

test('login exige senha correta e logout encerra a sessao', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  const cliente = app.novoCliente();
  const errada = await cliente('POST', '/api/auth/login', { email: 'atleta@teste.com', senha: 'errada123' });
  assert.equal(errada.status, 401);

  const certa = await cliente('POST', '/api/auth/login', { email: 'atleta@teste.com', senha: 'senha12345' });
  assert.equal(certa.status, 200);

  await cliente('POST', '/api/auth/logout');
  const depois = await cliente('GET', '/api/painel');
  assert.equal(depois.status, 401);
});

test('rotas protegidas respondem 401 sem sessao', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  for (const rota of ['/api/painel', '/api/treinos', '/api/diario', '/api/medidas', '/api/perfil']) {
    assert.equal((await app.chamar('GET', rota)).status, 401, `esperado 401 em ${rota}`);
  }
});

test('perfil calcula metas e permite fixar valores personalizados', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  const salvo = await app.chamar('PUT', '/api/perfil', {
    sexo: 'masculino', data_nascimento: '1990-05-10', altura_cm: 178,
    peso_inicial: 85.5, peso_meta: 90, nivel_atividade: 'intenso', objetivo: 'bulking',
  });
  assert.equal(salvo.status, 200);
  assert.ok(salvo.corpo.calculado.tmb > 1500);
  assert.equal(salvo.corpo.metas.personalizadas, false);

  const fixadas = await app.chamar('PUT', '/api/metas', {
    kcal: 3200, proteina_g: 200, carbo_g: 380, gordura_g: 90, agua_ml: 3500,
  });
  assert.equal(fixadas.corpo.metas.kcal, 3200);
  assert.equal(fixadas.corpo.metas.personalizadas, true);

  const automaticas = await app.chamar('DELETE', '/api/metas');
  assert.equal(automaticas.corpo.metas.personalizadas, false);
  assert.notEqual(automaticas.corpo.metas.kcal, 3200);
});

test('aplicar plano preenche o diario e o painel soma o consumo', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  const { planos } = (await app.chamar('GET', '/api/planos')).corpo;
  const plano = planos[0];
  const aplicado = await app.chamar('POST', `/api/planos/${plano.id}/aplicar`, { data: '2026-03-10' });
  assert.equal(aplicado.corpo.itens_criados, plano.refeicoes.reduce((n, r) => n + r.itens.length, 0));

  const diario = (await app.chamar('GET', '/api/diario?data=2026-03-10')).corpo;
  assert.equal(diario.totais.kcal, plano.totais.kcal);
  assert.equal(diario.refeicoes.length, plano.refeicoes.length);

  // Reaplicar substitui, nao duplica.
  await app.chamar('POST', `/api/planos/${plano.id}/aplicar`, { data: '2026-03-10' });
  const novamente = (await app.chamar('GET', '/api/diario?data=2026-03-10')).corpo;
  assert.equal(novamente.totais.kcal, plano.totais.kcal);

  const painel = (await app.chamar('GET', '/api/painel?data=2026-03-10')).corpo;
  assert.equal(painel.consumo.kcal, plano.totais.kcal);
});

test('item do diario calcula macros pela quantidade e aceita item livre', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  const { alimentos } = (await app.chamar('GET', '/api/alimentos?busca=Frango')).corpo;
  const frango = alimentos[0];

  const registro = await app.chamar('POST', '/api/diario', {
    data: '2026-03-11', refeicao: 'Almoco', alimento_id: frango.id, quantidade: 200,
  });
  assert.equal(registro.status, 201);
  const dobro = 200 / frango.porcao_base;
  assert.equal(registro.corpo.entrada.kcal, Math.round(frango.kcal * dobro));

  const livre = await app.chamar('POST', '/api/diario', {
    data: '2026-03-11', refeicao: 'Extra', nome: 'Pizza', kcal: 600, proteina_g: 25, carbo_g: 70, gordura_g: 22,
  });
  assert.equal(livre.status, 201);

  const diario = (await app.chamar('GET', '/api/diario?data=2026-03-11')).corpo;
  assert.equal(diario.totais.kcal, registro.corpo.entrada.kcal + 600);

  await app.chamar('DELETE', `/api/diario/${livre.corpo.entrada.id}`);
  const depois = (await app.chamar('GET', '/api/diario?data=2026-03-11')).corpo;
  assert.equal(depois.totais.kcal, registro.corpo.entrada.kcal);

  const semDados = await app.chamar('POST', '/api/diario', { data: '2026-03-11', refeicao: 'Extra' });
  assert.equal(semDados.status, 400);
});

test('registro de cargas marca recorde e alimenta as estatisticas', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  const { treinos } = (await app.chamar('GET', '/api/treinos')).corpo;
  const item = treinos[0].itens[0];

  const primeira = await app.chamar('POST', '/api/series', {
    exercicio_id: item.exercicio_id, treino_id: treinos[0].id, data: '2026-03-10', peso: 80, repeticoes: 8,
  });
  assert.equal(primeira.corpo.novo_recorde, true);

  const menor = await app.chamar('POST', '/api/series', {
    exercicio_id: item.exercicio_id, data: '2026-03-12', peso: 75, repeticoes: 10,
  });
  assert.equal(menor.corpo.novo_recorde, false);

  const maior = await app.chamar('POST', '/api/series', {
    exercicio_id: item.exercicio_id, data: '2026-03-14', peso: 85, repeticoes: 6,
  });
  assert.equal(maior.corpo.novo_recorde, true);

  const atualizados = (await app.chamar('GET', '/api/treinos')).corpo.treinos[0].itens[0];
  assert.equal(atualizados.recorde.peso, 85);
  assert.equal(atualizados.total_series, 3);

  const estatisticas = (await app.chamar('GET', '/api/series/estatisticas')).corpo;
  assert.equal(estatisticas.por_exercicio[0].carga_maxima, 85);
  assert.ok(estatisticas.por_semana.length >= 1);

  const filtradas = (await app.chamar('GET', `/api/series?exercicio_id=${item.exercicio_id}&data=2026-03-12`)).corpo;
  assert.equal(filtradas.series.length, 1);
  assert.equal(filtradas.series[0].peso, 75);
});

test('medidas mantem um registro por dia e calculam a variacao', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);
  await app.chamar('PUT', '/api/perfil', {
    sexo: 'masculino', data_nascimento: '1990-05-10', altura_cm: 178, peso_meta: 90,
    nivel_atividade: 'moderado', objetivo: 'bulking',
  });

  await app.chamar('POST', '/api/medidas', { data: '2026-03-01', peso: 85.5, cintura_cm: 88 });
  await app.chamar('POST', '/api/medidas', { data: '2026-03-01', peso: 85.8 }); // mesma data: atualiza
  await app.chamar('POST', '/api/medidas', { data: '2026-03-15', peso: 87 });

  const { medidas, resumo } = (await app.chamar('GET', '/api/medidas')).corpo;
  assert.equal(medidas.length, 2);
  assert.equal(resumo.peso_inicial, 85.5); // definido na primeira pesagem
  assert.equal(resumo.peso_atual, 87);
  assert.equal(resumo.variacao, 1.5);
  assert.equal(resumo.restante, 3);
  assert.ok(medidas[0].imc > 0);

  const vazia = await app.chamar('POST', '/api/medidas', { data: '2026-03-20' });
  assert.equal(vazia.status, 400);
});

test('agua acumula por dia', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  await app.chamar('POST', '/api/agua', { data: '2026-03-10', ml: 500 });
  await app.chamar('POST', '/api/agua', { data: '2026-03-10', ml: 750 });
  const agua = (await app.chamar('GET', '/api/agua?data=2026-03-10')).corpo;
  assert.equal(agua.total_ml, 1250);

  const excesso = await app.chamar('POST', '/api/agua', { ml: 99999 });
  assert.equal(excesso.status, 400);
});

test('dados de um usuario nao vazam para outro', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);

  const cliente1 = app.novoCliente();
  await cliente1('POST', '/api/auth/cadastro', { nome: 'Um', email: 'um@teste.com', senha: 'senha12345' });
  const treinoDoUm = (await cliente1('GET', '/api/treinos')).corpo.treinos[0];
  await cliente1('POST', '/api/medidas', { data: '2026-03-01', peso: 80 });

  const cliente2 = app.novoCliente();
  await cliente2('POST', '/api/auth/cadastro', { nome: 'Dois', email: 'dois@teste.com', senha: 'senha12345' });

  assert.equal((await cliente2('GET', '/api/medidas')).corpo.medidas.length, 0);
  assert.equal((await cliente2('PUT', `/api/treinos/${treinoDoUm.id}`, { nome: 'Invadido' })).status, 404);
  assert.equal((await cliente2('DELETE', `/api/treinos/${treinoDoUm.id}`)).status, 404);
  assert.equal((await cliente2('DELETE', `/api/treino-itens/${treinoDoUm.itens[0].id}`)).status, 404);

  const aindaExiste = (await cliente1('GET', '/api/treinos')).corpo.treinos[0];
  assert.equal(aindaExiste.nome, treinoDoUm.nome);
});

test('validacoes de entrada retornam 400 com mensagem', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  const dataInvalida = await app.chamar('GET', '/api/diario?data=10-03-2026');
  assert.equal(dataInvalida.status, 400);
  assert.match(dataInvalida.corpo.erro, /AAAA-MM-DD/);

  const pesoAbsurdo = await app.chamar('POST', '/api/series', { exercicio_id: 1, peso: 5000, repeticoes: 5 });
  assert.equal(pesoAbsurdo.status, 400);

  const objetivoInvalido = await app.chamar('POST', '/api/calculadora', {
    sexo: 'masculino', idade: 30, peso_kg: 80, altura_cm: 180, nivel_atividade: 'intenso', objetivo: 'voar',
  });
  assert.equal(objetivoInvalido.status, 400);

  const rotaInexistente = await app.chamar('GET', '/api/nao-existe');
  assert.equal(rotaInexistente.status, 404);
});

test('planos aceitam edicao de refeicoes e itens', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  const novo = await app.chamar('POST', '/api/planos', { nome: 'Dia low carb', cor: 'blue' });
  assert.equal(novo.status, 201);
  const planoId = novo.corpo.plano.id;

  const comRefeicao = await app.chamar('POST', `/api/planos/${planoId}/refeicoes`, { nome: 'Ceia' });
  const refeicaoId = comRefeicao.corpo.plano.refeicoes[0].id;

  const { alimentos } = (await app.chamar('GET', '/api/alimentos?busca=Ovo')).corpo;
  const comItem = await app.chamar('POST', `/api/plano-refeicoes/${refeicaoId}/itens`, {
    alimento_id: alimentos[0].id, quantidade: 3,
  });
  const item = comItem.corpo.plano.refeicoes[0].itens[0];
  assert.equal(item.kcal, Math.round(alimentos[0].kcal * 3 / alimentos[0].porcao_base));

  const alterado = await app.chamar('PUT', `/api/plano-itens/${item.id}`, { quantidade: 6 });
  assert.equal(alterado.corpo.plano.refeicoes[0].itens[0].kcal, item.kcal * 2);

  await app.chamar('DELETE', `/api/plano-itens/${item.id}`);
  const semItens = (await app.chamar('GET', '/api/planos')).corpo.planos.find((p) => p.id === planoId);
  assert.equal(semItens.refeicoes[0].itens.length, 0);

  await app.chamar('DELETE', `/api/planos/${planoId}`);
  assert.equal((await app.chamar('GET', '/api/planos')).corpo.planos.length, 3);
});

test('fotos de progresso sao gravadas e servidas', async (t) => {
  const app = await subirServidor();
  t.after(app.fechar);
  await comConta(app.chamar);

  const pngMinimo = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const criada = await app.chamar('POST', '/api/fotos', {
    mime: 'image/png', conteudo_base64: pngMinimo, data: '2026-03-10', legenda: 'Semana 1',
  });
  assert.equal(criada.status, 201);

  const { fotos } = (await app.chamar('GET', '/api/fotos')).corpo;
  assert.equal(fotos.length, 1);
  assert.equal(fotos[0].legenda, 'Semana 1');

  const formatoInvalido = await app.chamar('POST', '/api/fotos', { mime: 'application/pdf', conteudo_base64: pngMinimo });
  assert.equal(formatoInvalido.status, 400);

  await app.chamar('DELETE', `/api/fotos/${fotos[0].id}`);
  assert.equal((await app.chamar('GET', '/api/fotos')).corpo.fotos.length, 0);
});
