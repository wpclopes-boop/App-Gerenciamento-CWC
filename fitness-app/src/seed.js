// Dados iniciais criados para cada usuario novo: biblioteca de exercicios,
// tabela de alimentos (valores por 100 g/ml ou por unidade) e os planos base.
import { executar, um } from './db.js';

// [nome, grupo muscular, equipamento]
const EXERCICIOS = [
  ['Supino Reto - Barra', 'Peitoral maior', 'Barra'],
  ['Supino Inclinado - Halteres', 'Peitoral superior', 'Halteres'],
  ['Crossover - Cabo', 'Peitoral interno', 'Cabo'],
  ['Peck Deck', 'Peitoral isolado', 'Maquina'],
  ['Flexao de Braco', 'Peitoral', 'Peso corporal'],
  ['Triceps Testa - Barra EZ', 'Triceps cabeca longa', 'Barra EZ'],
  ['Triceps Corda - Cabo', 'Triceps lateral', 'Cabo'],
  ['Mergulho Entre Bancos', 'Triceps completo', 'Peso corporal'],
  ['Puxada Frente - Barra Larga', 'Grande dorsal', 'Maquina'],
  ['Remada Curvada - Barra', 'Dorsais e romboides', 'Barra'],
  ['Remada Unilateral - Halter', 'Dorsal e biceps', 'Halteres'],
  ['Remada Baixa - Cabo', 'Dorsais', 'Cabo'],
  ['Pullover - Halter', 'Dorsal e serratil', 'Halteres'],
  ['Barra Fixa', 'Dorsais', 'Peso corporal'],
  ['Rosca Direta - Barra', 'Biceps braquial', 'Barra'],
  ['Rosca Martelo - Halteres', 'Braquial', 'Halteres'],
  ['Rosca Concentrada', 'Biceps', 'Halteres'],
  ['Encolhimento - Barra', 'Trapezio', 'Barra'],
  ['Desenvolvimento - Halteres', 'Deltoide anterior', 'Halteres'],
  ['Elevacao Lateral', 'Deltoide medial', 'Halteres'],
  ['Elevacao Frontal', 'Deltoide anterior', 'Halteres'],
  ['Crucifixo Inverso', 'Deltoide posterior', 'Halteres'],
  ['Agachamento Livre', 'Quadriceps e gluteos', 'Peso corporal'],
  ['Agachamento com Barra', 'Quadriceps e gluteos', 'Barra'],
  ['Leg Press', 'Quadriceps', 'Maquina'],
  ['Cadeira Extensora', 'Quadriceps', 'Maquina'],
  ['Mesa Flexora', 'Posteriores de coxa', 'Maquina'],
  ['Stiff - Barra', 'Posteriores e gluteos', 'Barra'],
  ['Afundo Alternado', 'Quadriceps', 'Peso corporal'],
  ['Agachamento Bulgaro', 'Gluteos e quadriceps', 'Peso corporal'],
  ['Ponte de Gluteos', 'Gluteos e posteriores', 'Peso corporal'],
  ['Panturrilha em Pe', 'Panturrilhas', 'Maquina'],
  ['Prancha', 'Core', 'Peso corporal'],
  ['Elevacao de Pernas', 'Abdomen inferior', 'Peso corporal'],
  ['Abdominal Supra', 'Abdomen superior', 'Peso corporal'],
  ['Russian Twist', 'Obliquos', 'Peso corporal'],
  ['Mountain Climbers', 'Core e cardio', 'Peso corporal'],
  ['Esteira / Caminhada', 'Cardio', 'Esteira'],
];

// [nome, unidade, porcao_base, kcal, proteina, carbo, gordura]
const ALIMENTOS = [
  ['Leite semidesnatado', 'ml', 100, 46, 3.5, 4.5, 1.5],
  ['Leite desnatado', 'ml', 100, 35, 3.4, 5, 0.2],
  ['Aveia em flocos', 'g', 100, 380, 12.5, 67.5, 7.5],
  ['Whey / Proteina vegana', 'g', 100, 400, 80, 10, 7.5],
  ['Whey isolado', 'g', 100, 370, 90, 2, 1],
  ['Amendoim', 'g', 100, 585, 25, 17.5, 50],
  ['Pasta de amendoim', 'g', 100, 588, 25, 20, 50],
  ['Castanha de caju', 'g', 100, 570, 18, 30, 44],
  ['Banana', 'g', 100, 89, 1.3, 21, 0.3],
  ['Maca', 'un', 1, 95, 0.5, 25, 0.3],
  ['Laranja', 'un', 1, 62, 1.2, 15, 0.2],
  ['Abacate', 'g', 100, 160, 2, 8.5, 14.7],
  ['Frango grelhado (peito)', 'g', 100, 150, 30, 0, 3.2],
  ['Patinho moido grelhado', 'g', 100, 219, 35.9, 0, 7.3],
  ['Tilapia grelhada', 'g', 100, 128, 26.2, 0, 2.3],
  ['Salmao grelhado', 'g', 100, 208, 20, 0, 13],
  ['Atum em agua (lata)', 'g', 100, 116, 25.5, 0, 1],
  ['Ovo cozido', 'un', 1, 72, 6, 0.3, 5],
  ['Clara de ovo', 'un', 1, 17, 3.6, 0.2, 0.1],
  ['Presunto magro', 'g', 100, 110, 18, 1.5, 3.5],
  ['Queijo cottage', 'g', 100, 98, 11, 3.4, 4.3],
  ['Queijo minas frescal', 'g', 100, 264, 17, 3, 20],
  ['Iogurte natural integral', 'g', 100, 61, 3.5, 4.7, 3.3],
  ['Requeijao light', 'g', 100, 150, 9, 4, 11],
  ['Arroz branco cozido', 'g', 100, 128, 2.5, 28, 0.2],
  ['Arroz integral cozido', 'g', 100, 124, 2.6, 25.8, 1],
  ['Feijao carioca cozido', 'g', 100, 76, 4.8, 13.6, 0.5],
  ['Macarrao cozido', 'g', 100, 158, 5.8, 30.9, 0.9],
  ['Batata doce cozida', 'g', 100, 77, 0.6, 18.4, 0.1],
  ['Batata inglesa cozida', 'g', 100, 86, 1.7, 20, 0.1],
  ['Mandioca cozida', 'g', 100, 125, 0.6, 30, 0.3],
  ['Tapioca (goma)', 'g', 100, 240, 0, 58, 0],
  ['Pao integral (fatia)', 'un', 1, 70, 3.5, 12, 1],
  ['Cenoura', 'g', 100, 34, 0.9, 8, 0.2],
  ['Brocolis', 'g', 100, 34, 2.8, 7, 0.4],
  ['Alface', 'g', 100, 15, 1.4, 2.9, 0.2],
  ['Tomate', 'g', 100, 18, 0.9, 3.9, 0.2],
  ['Azeite de oliva', 'ml', 100, 884, 0, 0, 100],
  ['Chocolate 70%', 'g', 100, 546, 7.8, 45.9, 31.3],
  ['Pizza (fatia)', 'un', 1, 285, 12, 36, 10],
];

// Treinos base: [nome, letra, cor, [[exercicio, series, reps, descanso], ...]]
const TREINOS = [
  ['Peito + Triceps', 'A', 'fire', [
    ['Supino Reto - Barra', '4', '8-10', '90s'],
    ['Supino Inclinado - Halteres', '3', '10-12', '75s'],
    ['Crossover - Cabo', '3', '12-15', '60s'],
    ['Peck Deck', '3', '12-15', '60s'],
    ['Triceps Testa - Barra EZ', '3', '10-12', '75s'],
    ['Triceps Corda - Cabo', '3', '12-15', '60s'],
    ['Mergulho Entre Bancos', '3', 'ate a falha', '60s'],
  ]],
  ['Costas + Biceps', 'B', 'blue', [
    ['Puxada Frente - Barra Larga', '4', '8-10', '90s'],
    ['Remada Curvada - Barra', '4', '8-10', '90s'],
    ['Remada Unilateral - Halter', '3', '10-12', '75s'],
    ['Pullover - Halter', '3', '12-15', '60s'],
    ['Rosca Direta - Barra', '3', '10-12', '75s'],
    ['Rosca Martelo - Halteres', '3', '12-15', '60s'],
    ['Encolhimento - Barra', '3', '12-15', '60s'],
  ]],
  ['Pernas + Abs (Casa)', 'C', 'purple', [
    ['Agachamento Livre', '4', '20', '60s'],
    ['Afundo Alternado', '3', '12 cada', '60s'],
    ['Agachamento Bulgaro', '3', '12 cada', '75s'],
    ['Ponte de Gluteos', '3', '25', '45s'],
    ['Prancha', '3', '45s', '45s'],
    ['Elevacao de Pernas', '3', '15', '45s'],
    ['Russian Twist', '3', '20', '45s'],
    ['Mountain Climbers', '3', '30s', '45s'],
  ]],
];

// Planos alimentares base: [nome, descricao, cor, [[refeicao, dica, [[alimento, qtd], ...]], ...]]
const PLANOS = [
  ['Dia Academia', 'Dia de treino na academia', 'fire', [
    ['Desjejum', null, [['Leite semidesnatado', 200], ['Aveia em flocos', 40], ['Whey / Proteina vegana', 40]]],
    ['Pre-treino', '30 a 45 min antes do treino', [['Amendoim', 40], ['Whey / Proteina vegana', 30], ['Banana', 80], ['Aveia em flocos', 30]]],
    ['Almoco', 'Marmita fixa - prep em batch semanal', [['Frango grelhado (peito)', 220], ['Cenoura', 50], ['Brocolis', 30]]],
    ['Cafe da tarde', null, [['Ovo cozido', 3], ['Whey / Proteina vegana', 30], ['Amendoim', 20]]],
    ['Jantar', 'Marmita fixa - igual ao almoco', [['Frango grelhado (peito)', 200], ['Cenoura', 50], ['Brocolis', 30]]],
  ]],
  ['Dia Pernas (Casa)', 'Treino de pernas em casa', 'blue', [
    ['Desjejum', null, [['Leite semidesnatado', 200], ['Aveia em flocos', 40], ['Whey / Proteina vegana', 40]]],
    ['Pre-treino', null, [['Amendoim', 30], ['Whey / Proteina vegana', 30], ['Banana', 80]]],
    ['Almoco', null, [['Frango grelhado (peito)', 220], ['Cenoura', 50], ['Brocolis', 30]]],
    ['Cafe da tarde', null, [['Ovo cozido', 3], ['Whey / Proteina vegana', 30], ['Amendoim', 20]]],
    ['Jantar', null, [['Frango grelhado (peito)', 200], ['Cenoura', 50], ['Brocolis', 30]]],
  ]],
  ['Dia Descanso', 'Sem treino - menos carboidrato', 'purple', [
    ['Desjejum', null, [['Leite semidesnatado', 200], ['Aveia em flocos', 40], ['Whey / Proteina vegana', 40]]],
    ['Almoco', null, [['Frango grelhado (peito)', 220], ['Cenoura', 50], ['Brocolis', 30]]],
    ['Cafe da tarde', null, [['Ovo cozido', 3], ['Whey / Proteina vegana', 30], ['Amendoim', 20]]],
    ['Jantar', null, [['Frango grelhado (peito)', 200], ['Cenoura', 50], ['Brocolis', 30]]],
  ]],
];

export function semearUsuario(db, usuarioId) {
  const exercicioIds = new Map();
  for (const [nome, grupo, equipamento] of EXERCICIOS) {
    const { id } = executar(
      db,
      'INSERT INTO exercicios (usuario_id, nome, grupo_muscular, equipamento) VALUES (?, ?, ?, ?)',
      usuarioId, nome, grupo, equipamento,
    );
    exercicioIds.set(nome, id);
  }

  const alimentoIds = new Map();
  for (const [nome, unidade, base, kcal, prot, carbo, gord] of ALIMENTOS) {
    const { id } = executar(
      db,
      `INSERT INTO alimentos (usuario_id, nome, unidade, porcao_base, kcal, proteina_g, carbo_g, gordura_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      usuarioId, nome, unidade, base, kcal, prot, carbo, gord,
    );
    alimentoIds.set(nome, id);
  }

  TREINOS.forEach(([nome, letra, cor, itens], indice) => {
    const { id: treinoId } = executar(
      db,
      'INSERT INTO treinos (usuario_id, nome, letra, cor, posicao) VALUES (?, ?, ?, ?, ?)',
      usuarioId, nome, letra, cor, indice,
    );
    itens.forEach(([exercicio, series, reps, descanso], pos) => {
      executar(
        db,
        `INSERT INTO treino_itens (treino_id, exercicio_id, series, repeticoes, descanso, posicao)
         VALUES (?, ?, ?, ?, ?, ?)`,
        treinoId, exercicioIds.get(exercicio), series, reps, descanso, pos,
      );
    });
  });

  PLANOS.forEach(([nome, descricao, cor, refeicoes], indice) => {
    const { id: planoId } = executar(
      db,
      'INSERT INTO planos_dia (usuario_id, nome, descricao, cor, posicao) VALUES (?, ?, ?, ?, ?)',
      usuarioId, nome, descricao, cor, indice,
    );
    refeicoes.forEach(([refeicao, dica, itens], posRef) => {
      const { id: refeicaoId } = executar(
        db,
        'INSERT INTO plano_refeicoes (plano_id, nome, dica, posicao) VALUES (?, ?, ?, ?)',
        planoId, refeicao, dica, posRef,
      );
      itens.forEach(([alimento, quantidade], posItem) => {
        executar(
          db,
          'INSERT INTO plano_itens (refeicao_id, alimento_id, quantidade, posicao) VALUES (?, ?, ?, ?)',
          refeicaoId, alimentoIds.get(alimento), quantidade, posItem,
        );
      });
    });
  });

  if (!um(db, 'SELECT usuario_id FROM perfis WHERE usuario_id = ?', usuarioId)) {
    executar(
      db,
      `INSERT INTO perfis (usuario_id, nivel_atividade, objetivo, atualizado_em)
       VALUES (?, 'moderado', 'manutencao', ?)`,
      usuarioId, new Date().toISOString(),
    );
  }
}
