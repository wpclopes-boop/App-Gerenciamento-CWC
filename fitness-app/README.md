# Fitness App — Treino & Dieta

Aplicativo web de academia e dieta com **backend, login e banco de dados**: fichas de treino com
registro de carga e recordes, planos alimentares com contagem de macros, evolução corporal
(peso, medidas e fotos) e metas calculadas automaticamente (TMB, GET, macros e água).

Feito em **Node.js puro, sem dependências externas** — usa `node:http`, `node:sqlite` e
`node:crypto`. Não há `npm install`: basta ter Node 22.5+ e rodar.

## Como rodar

```bash
cd fitness-app
npm start           # http://localhost:3000
npm run dev         # com --watch (recarrega ao salvar)
npm test            # testes automatizados
```

Variáveis de ambiente opcionais:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP |
| `HOST` | `0.0.0.0` | Interface de escuta |
| `FITNESS_DB` | `data/fitness.db` | Caminho do banco SQLite |
| `COOKIE_SECURE` | desligado | Defina `1` ao servir por HTTPS |
| `FITNESS_BACKUP_DIR` | `data/backups` | Onde os backups são gravados |
| `FITNESS_BACKUP` | ligado | `0` desliga o backup automático |
| `TWA_ASSETLINKS` | vazio | Conteúdo de `/.well-known/assetlinks.json` (Play Store) |

Ao criar a conta, o app já vem com 38 exercícios, 40 alimentos com macros, 3 fichas de treino
(Peito+Tríceps, Costas+Bíceps, Pernas em casa) e 3 planos alimentares (dia de academia,
dia de pernas em casa e dia de descanso). Tudo é editável.

## Instalar no celular (PWA)

O app é instalável: abra a URL do servidor no celular e use **Instalar app** (Android/Chrome mostra
o botão no topo; no iPhone, Safari → Compartilhar → *Adicionar à Tela de Início*). Ele abre em tela
cheia, com ícone próprio, e a casca funciona offline — os dados continuam vindo do servidor.

- `public/manifest.webmanifest` — nome, ícones, cores e atalhos (`/?secao=treino` abre direto no treino).
- `public/sw.js` — service worker: cacheia HTML/CSS/JS e **nunca** cacheia `/api/`.
- `scripts/gerar-icones.mjs` — regenera os PNGs do ícone (`node scripts/gerar-icones.mjs`).

Para instalar fora de `localhost` o servidor precisa estar em **HTTPS** (requisito de PWA) — nesse
caso, defina também `COOKIE_SECURE=1`.

## Colocar no ar

O app só ganha um endereço depois de publicado — não existe URL antes disso. Duas formas:

### Opção A — Render, pelo navegador (sem instalar nada)

O `render.yaml` na raiz do repositório já descreve o serviço inteiro (Docker, disco em `/data`,
health check e variáveis).

1. Crie a conta em https://render.com e conecte o GitHub.
2. **New → Blueprint** → escolha o repositório `App-Gerenciamento-CWC` → *Apply*.
3. O Render constrói e publica. O endereço fica no painel, no formato
   `https://<nome-que-voce-escolher>.onrender.com`.

A partir daí, **todo push na branch publica sozinho** (`autoDeploy: true`). Precisa do plano
Starter (por volta de US$ 7/mês na data deste texto, mais ~US$ 0,25/mês pelo disco de 1 GB) —
o plano free não permite disco, e sem disco o banco é apagado a cada deploy.

### Opção B — Fly.io, por linha de comando (mais barato)

Com a [CLI do Fly](https://fly.io/docs/flyctl/install/) instalada e logada:

```bash
cd fitness-app
fly launch --no-deploy          # escolha um nome; ele atualiza o "app" no fly.toml
fly volumes create fitness_dados --size 1 --region gru
fly deploy
fly open                        # abre a URL real, https://<seu-nome>.fly.dev
```

Sai por volta de US$ 2–3/mês, porque a máquina suspende quando ninguém acessa e acorda no
primeiro acesso. Para publicar automaticamente a cada push, gere um token com
`fly tokens create deploy`, salve como secret `FLY_API_TOKEN` no GitHub e use o
[action oficial](https://github.com/superfly/flyctl-actions).

Em qualquer hospedagem o essencial é o mesmo: rodar o `Dockerfile`, apontar `FITNESS_DB` para um
disco persistente e definir `COOKIE_SECURE=1`.

### Backup do banco

Um backup é gerado ao subir o servidor e a cada 24 h, guardando os 7 mais recentes em
`FITNESS_BACKUP_DIR` (padrão `data/backups`). O snapshot usa `VACUUM INTO`, então é consistente
mesmo com o app em uso. Manualmente: `node scripts/backup.mjs`. Para desligar: `FITNESS_BACKUP=0`.

Restaurar é copiar o arquivo por cima do banco com o app parado:

```bash
fly ssh console -C "cp /data/backups/fitness-2026-09-03T12-00-00.db /data/fitness.db"
# no Render, o equivalente é abrir o Shell do serviço no painel e rodar o mesmo cp
```

Atenção: os backups ficam no mesmo volume do banco — protegem contra erro de aplicação ou exclusão
acidental, **não** contra a perda do volume. Antes do primeiro cliente pagante, vale copiá-los para
fora (S3/Tigris, ou um `fly ssh sftp get` agendado na sua máquina).

### Play Store (TWA), quando for a hora

O app publicado precisa provar que é dono do domínio. Depois de gerar o APK com
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap), pegue o `assetlinks.json` que a
ferramenta gera e publique-o como variável de ambiente — o servidor já o serve em
`/.well-known/assetlinks.json`:

```bash
fly secrets set TWA_ASSETLINKS="$(cat assetlinks.json)"
```

## Funcionalidades

**Painel** — calorias e macros do dia contra a meta, água, treinos na semana, peso atual,
gráfico de calorias dos últimos 7 dias, evolução do peso e recordes recentes.

**Dieta**
- *Diário*: registro do que foi comido por refeição, com macros calculados pela quantidade;
  aceita item livre (fora da tabela) e aplicação de um plano inteiro ao dia com um clique.
- *Planos*: dias modelo (treino, descanso…) com refeições, itens e totais de kcal/proteína/carbo/gordura.
- *Alimentos*: tabela de macros por porção de referência, com busca e CRUD.

**Treino**
- Fichas com exercícios, séries, repetições e descanso.
- Registro de carga por exercício (peso × repetições), histórico, destaque de PR e 1RM estimado (Epley).
- Biblioteca de exercícios com grupo muscular, equipamento e recorde de cada um.

**Progresso** — peso, % de gordura e medidas (peito, cintura, quadril, braço, coxa) com um registro
por dia, IMC, variação entre pesagens, gráficos de peso e de volume semanal, e fotos de progresso.

**Metas** — perfil (sexo, nascimento, altura, peso inicial, meta de peso, nível de atividade e
objetivo) alimenta os cálculos:
- TMB por Mifflin-St Jeor;
- GET pelo fator de atividade (1,2 a 1,9);
- meta calórica pelo objetivo (cutting −20% até bulking +15%);
- macros (proteína e gordura por kg, carboidrato completa as calorias);
- água (35 ml/kg, +500 ml para treino intenso) e IMC.

As metas calculadas podem ser substituídas por valores fixos e revertidas a qualquer momento.
Há também um simulador que calcula sem alterar o perfil.

## Arquitetura

```
fitness-app/
├── src/
│   ├── server.js          # servidor HTTP, roteamento e entrega do front
│   ├── db.js              # conexão e schema SQLite
│   ├── seed.js            # dados iniciais de cada usuário
│   ├── auth.js            # scrypt + sessões em cookie HttpOnly
│   ├── lib/               # http.js (router/JSON/cookies), validate.js, calc.js
│   └── routes/            # auth, perfil, treinos, nutricao, corpo, painel
├── public/                # front (HTML + CSS + módulos ES, sem build)
└── test/                  # testes de API e das calculadoras
```

Segurança: senhas com scrypt (salt por usuário), sessões opacas de 30 dias guardadas como hash
SHA-256, cookie `HttpOnly`/`SameSite=Lax`, toda consulta filtrada por `usuario_id`, validação de
entrada em todas as rotas e CSP no servidor.

## API (resumo)

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/cadastro`, `/api/auth/login`, `/api/auth/logout` | Conta e sessão |
| GET/PUT | `/api/perfil` | Perfil e metas calculadas |
| GET/PUT/DELETE | `/api/metas` | Metas fixas (DELETE volta ao automático) |
| POST | `/api/calculadora` | Simulação de TMB/GET/macros |
| GET/POST/PUT/DELETE | `/api/exercicios`, `/api/treinos`, `/api/treino-itens/:id` | Fichas e exercícios |
| GET/POST/DELETE | `/api/series` | Registro de cargas |
| GET | `/api/series/estatisticas` | Volume semanal e recordes |
| GET/POST/PUT/DELETE | `/api/alimentos`, `/api/planos`, `/api/plano-refeicoes/:id`, `/api/plano-itens/:id` | Nutrição |
| POST | `/api/planos/:id/aplicar` | Copia o plano para o diário do dia |
| GET/POST/DELETE | `/api/diario`, `/api/agua` | Diário e água |
| GET/POST/DELETE | `/api/medidas`, `/api/fotos` | Evolução corporal |
| GET | `/api/painel` | Resumo consolidado |
| GET | `/api/saude` | Health check (sem autenticação) |
