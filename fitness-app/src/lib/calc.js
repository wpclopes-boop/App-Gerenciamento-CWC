// Calculadoras nutricionais: TMB, GET, meta calorica, macros e agua.

export const ACTIVITY_FACTORS = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  atleta: 1.9,
};

export const GOAL_ADJUSTMENTS = {
  cutting: -0.20,     // deficit de 20%
  definicao: -0.10,   // deficit leve
  manutencao: 0,
  bulking_limpo: 0.10,
  bulking: 0.15,
};

export const GOAL_LABELS = {
  cutting: 'Cutting (perder gordura)',
  definicao: 'Definicao (deficit leve)',
  manutencao: 'Manutencao',
  bulking_limpo: 'Bulking limpo',
  bulking: 'Bulking',
};

export function idadeEmAnos(birthDate, hoje = new Date()) {
  if (!birthDate) return null;
  const nascimento = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(nascimento.getTime())) return null;
  let idade = hoje.getUTCFullYear() - nascimento.getUTCFullYear();
  const mes = hoje.getUTCMonth() - nascimento.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoje.getUTCDate() < nascimento.getUTCDate())) idade -= 1;
  return idade >= 0 && idade < 130 ? idade : null;
}

// Mifflin-St Jeor
export function calcularTMB({ sexo, pesoKg, alturaCm, idade }) {
  if (!pesoKg || !alturaCm || idade == null) return null;
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;
  return Math.round(sexo === 'feminino' ? base - 161 : base + 5);
}

export function calcularGET(tmb, nivelAtividade) {
  if (!tmb) return null;
  const fator = ACTIVITY_FACTORS[nivelAtividade] ?? ACTIVITY_FACTORS.moderado;
  return Math.round(tmb * fator);
}

export function calcularMetaCalorica(get, objetivo) {
  if (!get) return null;
  const ajuste = GOAL_ADJUSTMENTS[objetivo] ?? 0;
  return Math.round(get * (1 + ajuste));
}

// Proteina e gordura por kg de peso; carboidrato preenche o restante.
export function calcularMacros({ kcal, pesoKg, objetivo }) {
  if (!kcal || !pesoKg) return null;
  const proteinaPorKg = objetivo === 'cutting' || objetivo === 'definicao' ? 2.2 : 2.0;
  const gorduraPorKg = objetivo === 'cutting' ? 0.8 : 1.0;
  const proteina = Math.round(pesoKg * proteinaPorKg);
  const gordura = Math.round(pesoKg * gorduraPorKg);
  const kcalRestante = kcal - proteina * 4 - gordura * 9;
  const carbo = Math.max(0, Math.round(kcalRestante / 4));
  return { proteina_g: proteina, carbo_g: carbo, gordura_g: gordura };
}

export function calcularAgua(pesoKg, nivelAtividade) {
  if (!pesoKg) return null;
  const extra = nivelAtividade === 'intenso' || nivelAtividade === 'atleta' ? 500 : 0;
  return Math.round(pesoKg * 35 + extra);
}

export function calcularIMC(pesoKg, alturaCm) {
  if (!pesoKg || !alturaCm) return null;
  const imc = pesoKg / ((alturaCm / 100) ** 2);
  return Math.round(imc * 10) / 10;
}

export function classificarIMC(imc) {
  if (imc == null) return null;
  if (imc < 18.5) return 'Abaixo do peso';
  if (imc < 25) return 'Peso normal';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidade grau I';
  if (imc < 40) return 'Obesidade grau II';
  return 'Obesidade grau III';
}

// 1RM estimado (Epley) para acompanhar evolucao de forca.
export function estimar1RM(peso, reps) {
  if (!peso || !reps) return null;
  if (reps === 1) return Math.round(peso * 10) / 10;
  return Math.round(peso * (1 + reps / 30) * 10) / 10;
}

// Resumo completo usado pela tela de Metas.
export function resumoMetas(perfil, hoje = new Date()) {
  const idade = idadeEmAnos(perfil.data_nascimento, hoje);
  const peso = perfil.peso_atual ?? perfil.peso_inicial;
  const tmb = calcularTMB({ sexo: perfil.sexo, pesoKg: peso, alturaCm: perfil.altura_cm, idade });
  const get = calcularGET(tmb, perfil.nivel_atividade);
  const metaKcal = calcularMetaCalorica(get, perfil.objetivo);
  const macros = calcularMacros({ kcal: metaKcal, pesoKg: peso, objetivo: perfil.objetivo });
  const imc = calcularIMC(peso, perfil.altura_cm);
  return {
    idade,
    peso_referencia: peso,
    tmb,
    get,
    meta_kcal_sugerida: metaKcal,
    macros_sugeridos: macros,
    agua_ml_sugerida: calcularAgua(peso, perfil.nivel_atividade),
    imc,
    imc_classificacao: classificarIMC(imc),
  };
}
