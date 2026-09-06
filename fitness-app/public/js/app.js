// Bootstrap: autenticacao, navegacao entre secoes e carregamento das telas.
import { api } from './api.js';
import { toast, erroToast } from './ui.js';
import * as painel from './views/painel.js';
import * as dieta from './views/dieta.js';
import * as treino from './views/treino.js';
import * as progresso from './views/progresso.js';
import * as metas from './views/metas.js';

const VIEWS = { painel, dieta, treino, progresso, metas };
let modoCadastro = false;
// Atalhos do app instalado abrem direto numa seção: /?secao=treino
const secaoInicial = new URLSearchParams(location.search).get('secao');
let secaoAtual = Object.hasOwn(VIEWS, secaoInicial ?? '') ? secaoInicial : 'painel';

const el = (id) => document.getElementById(id);

async function abrirSecao(nome) {
  secaoAtual = nome;
  document.querySelectorAll('.section').forEach((s) => s.classList.toggle('on', s.id === `s-${nome}`));
  document.querySelectorAll('.ntab').forEach((t) => t.classList.toggle('on', t.dataset.secao === nome));
  const alvo = el(`s-${nome}`);
  alvo.innerHTML = '<div class="card"><div class="empty">Carregando…</div></div>';
  try {
    await VIEWS[nome].render(alvo);
  } catch (erro) {
    if (erro.status === 401) return mostrarLogin();
    alvo.innerHTML = `<div class="card"><div class="empty">Não foi possível carregar: ${erro.message}</div></div>`;
    erroToast(erro);
  }
  return undefined;
}

function mostrarLogin() {
  el('app').classList.add('hidden');
  el('tela-auth').classList.remove('hidden');
}

async function mostrarApp(usuario) {
  el('tela-auth').classList.add('hidden');
  el('app').classList.remove('hidden');
  el('nav-nome').textContent = usuario.nome;
  await abrirSecao(secaoAtual);
}

function alternarModo() {
  modoCadastro = !modoCadastro;
  el('campo-nome').classList.toggle('hidden', !modoCadastro);
  el('campo-nome').querySelector('input').required = modoCadastro;
  el('btn-auth').textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  el('auth-texto').textContent = modoCadastro ? 'Já tem conta?' : 'Ainda não tem conta?';
  el('btn-trocar-modo').textContent = modoCadastro ? 'Entrar' : 'Criar conta';
  el('auth-sub').textContent = modoCadastro
    ? 'Crie sua conta — fichas e tabela de alimentos já vêm prontas'
    : 'Treino, dieta e evolução em um só lugar';
  el('auth-erro').classList.add('hidden');
  el('form-auth').querySelector('input[name=senha]').autocomplete = modoCadastro ? 'new-password' : 'current-password';
}

el('btn-trocar-modo').addEventListener('click', alternarModo);

el('form-auth').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target).entries());
  const erroBox = el('auth-erro');
  erroBox.classList.add('hidden');
  el('btn-auth').disabled = true;
  try {
    const rota = modoCadastro ? '/api/auth/cadastro' : '/api/auth/login';
    const corpo = modoCadastro
      ? { nome: dados.nome, email: dados.email, senha: dados.senha }
      : { email: dados.email, senha: dados.senha };
    const { usuario } = await api.post(rota, corpo);
    e.target.reset();
    toast(modoCadastro ? `Bem-vindo, ${usuario.nome}!` : `Olá de novo, ${usuario.nome}!`);
    await mostrarApp(usuario);
  } catch (erro) {
    erroBox.textContent = erro.message;
    erroBox.classList.remove('hidden');
  } finally {
    el('btn-auth').disabled = false;
  }
});

el('btn-sair').addEventListener('click', async () => {
  try { await api.post('/api/auth/logout'); } catch { /* sessao ja encerrada */ }
  secaoAtual = 'painel';
  mostrarLogin();
});

document.querySelectorAll('.ntab').forEach((tab) => {
  tab.addEventListener('click', () => abrirSecao(tab.dataset.secao));
});

// Sessao ativa? Entra direto.
api.get('/api/auth/eu')
  .then(({ usuario }) => (usuario ? mostrarApp(usuario) : mostrarLogin()))
  .catch(mostrarLogin);

// ---- App instalável (PWA) ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* segue como site normal */ });
  });
}

// O navegador avisa quando o app pode ser instalado; guardamos o evento para o botão.
let promptInstalacao = null;

window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault();
  promptInstalacao = evento;
  el('btn-instalar').classList.remove('hidden');
});

el('btn-instalar').addEventListener('click', async () => {
  if (!promptInstalacao) return;
  promptInstalacao.prompt();
  await promptInstalacao.userChoice;
  promptInstalacao = null;
  el('btn-instalar').classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  promptInstalacao = null;
  el('btn-instalar').classList.add('hidden');
  toast('App instalado 📲');
});

// iPhone/iPad nao disparam beforeinstallprompt: a instalacao e manual, pelo
// menu Compartilhar. Sem uma dica, o usuario de iOS simplesmente nao descobre.
const CHAVE_DICA_IOS = 'dica_ios_fechada';

function ehIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad recente
}

function jaInstalado() {
  return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

function guardou(chave) {
  try { return localStorage.getItem(chave) === '1'; } catch { return false; }
}

if (ehIOS() && !jaInstalado() && !guardou(CHAVE_DICA_IOS)) {
  el('dica-ios').classList.remove('hidden');
  el('fechar-dica-ios').addEventListener('click', () => {
    el('dica-ios').classList.add('hidden');
    try { localStorage.setItem(CHAVE_DICA_IOS, '1'); } catch { /* modo privado */ }
  });
}
