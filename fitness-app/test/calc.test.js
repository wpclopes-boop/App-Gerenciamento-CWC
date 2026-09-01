import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularTMB, calcularGET, calcularMetaCalorica, calcularMacros,
  calcularAgua, calcularIMC, classificarIMC, estimar1RM, idadeEmAnos, resumoMetas,
} from '../src/lib/calc.js';

test('TMB segue Mifflin-St Jeor para ambos os sexos', () => {
  // 10*80 + 6.25*180 - 5*30 + 5 = 1780
  assert.equal(calcularTMB({ sexo: 'masculino', pesoKg: 80, alturaCm: 180, idade: 30 }), 1780);
  // mesmo caso feminino: -161 no lugar de +5
  assert.equal(calcularTMB({ sexo: 'feminino', pesoKg: 80, alturaCm: 180, idade: 30 }), 1614);
});

test('TMB retorna null sem dados suficientes', () => {
  assert.equal(calcularTMB({ sexo: 'masculino', pesoKg: null, alturaCm: 180, idade: 30 }), null);
});

test('GET aplica o fator de atividade', () => {
  assert.equal(calcularGET(2000, 'sedentario'), 2400);
  assert.equal(calcularGET(2000, 'intenso'), 3450);
  assert.equal(calcularGET(2000, 'inexistente'), 3100); // cai no fator moderado
});

test('meta calorica ajusta conforme o objetivo', () => {
  assert.equal(calcularMetaCalorica(3000, 'cutting'), 2400);
  assert.equal(calcularMetaCalorica(3000, 'manutencao'), 3000);
  assert.equal(calcularMetaCalorica(3000, 'bulking'), 3450);
});

test('macros somam aproximadamente a meta calorica', () => {
  const macros = calcularMacros({ kcal: 3000, pesoKg: 80, objetivo: 'bulking' });
  const kcal = macros.proteina_g * 4 + macros.carbo_g * 4 + macros.gordura_g * 9;
  assert.ok(Math.abs(kcal - 3000) <= 5, `esperado ~3000 kcal, obtido ${kcal}`);
  assert.equal(macros.proteina_g, 160); // 2 g/kg
  assert.equal(macros.gordura_g, 80); // 1 g/kg
});

test('cutting usa mais proteina e menos gordura por kg', () => {
  const macros = calcularMacros({ kcal: 2000, pesoKg: 80, objetivo: 'cutting' });
  assert.equal(macros.proteina_g, 176);
  assert.equal(macros.gordura_g, 64);
});

test('agua e IMC', () => {
  assert.equal(calcularAgua(80, 'moderado'), 2800);
  assert.equal(calcularAgua(80, 'intenso'), 3300);
  assert.equal(calcularIMC(80, 180), 24.7);
  assert.equal(classificarIMC(24.7), 'Peso normal');
  assert.equal(classificarIMC(31), 'Obesidade grau I');
});

test('1RM estimado (Epley)', () => {
  assert.equal(estimar1RM(100, 1), 100);
  assert.equal(estimar1RM(100, 10), 133.3);
});

test('idade considera se o aniversario ja passou', () => {
  const referencia = new Date('2026-09-01T00:00:00Z');
  assert.equal(idadeEmAnos('1990-05-10', referencia), 36);
  assert.equal(idadeEmAnos('1990-12-10', referencia), 35);
  assert.equal(idadeEmAnos(null, referencia), null);
});

test('resumo de metas usa o peso atual quando existe', () => {
  const resumo = resumoMetas({
    sexo: 'masculino', data_nascimento: '1990-05-10', altura_cm: 178,
    peso_inicial: 85.5, peso_atual: 88, nivel_atividade: 'intenso', objetivo: 'bulking',
  }, new Date('2026-09-01T00:00:00Z'));
  assert.equal(resumo.peso_referencia, 88);
  assert.ok(resumo.meta_kcal_sugerida > resumo.get);
  assert.equal(resumo.imc_classificacao, 'Sobrepeso');
});
