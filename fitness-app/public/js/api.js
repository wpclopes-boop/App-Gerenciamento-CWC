// Cliente da API: cookies de sessao vao junto por padrao (same-origin).
async function requisicao(metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }

  const resposta = await fetch(caminho, opcoes);
  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) {
    const erro = new Error(dados?.erro || `Falha na requisicao (${resposta.status})`);
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

export const api = {
  get: (caminho) => requisicao('GET', caminho),
  post: (caminho, corpo) => requisicao('POST', caminho, corpo ?? {}),
  put: (caminho, corpo) => requisicao('PUT', caminho, corpo ?? {}),
  del: (caminho) => requisicao('DELETE', caminho),
};

export const qs = (obj) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : '';
};
