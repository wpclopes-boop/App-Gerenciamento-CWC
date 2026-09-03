// Gera os icones PNG do app (halter sobre gradiente fire/gold) sem dependencias externas.
// Uso: node scripts/gerar-icones.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'public/icons');

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(largura, altura, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;  // 8 bits por canal
  ihdr[9] = 6;  // RGBA
  const linhas = Buffer.alloc(altura * (largura * 4 + 1));
  for (let y = 0; y < altura; y += 1) {
    const inicio = y * (largura * 4 + 1);
    linhas[inicio] = 0; // filtro "none"
    pixels.copy(linhas, inicio + 1, y * largura * 4, (y + 1) * largura * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(linhas, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

const misturar = (a, b, t) => Math.round(a + (b - a) * t);
const FIRE = [232, 99, 26];
const GOLD = [245, 230, 66];
const FUNDO = [10, 8, 6];

// Retangulo com cantos arredondados, em coordenadas normalizadas (0..1).
function dentroRet(x, y, x0, y0, x1, y1, raio = 0) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  if (raio <= 0) return true;
  const cx = Math.min(Math.max(x, x0 + raio), x1 - raio);
  const cy = Math.min(Math.max(y, y0 + raio), y1 - raio);
  return (x - cx) ** 2 + (y - cy) ** 2 <= raio ** 2 || (x >= x0 + raio && x <= x1 - raio) || (y >= y0 + raio && y <= y1 - raio);
}

// Halter: barra central, anilhas e presilhas.
function noHalter(x, y) {
  return dentroRet(x, y, 0.20, 0.455, 0.80, 0.545, 0.02)      // barra
    || dentroRet(x, y, 0.155, 0.33, 0.265, 0.67, 0.035)        // anilha esquerda
    || dentroRet(x, y, 0.735, 0.33, 0.845, 0.67, 0.035)        // anilha direita
    || dentroRet(x, y, 0.085, 0.40, 0.155, 0.60, 0.03)         // presilha esquerda
    || dentroRet(x, y, 0.845, 0.40, 0.915, 0.60, 0.03);        // presilha direita
}

function desenhar(tamanho, { maskable = false } = {}) {
  const pixels = Buffer.alloc(tamanho * tamanho * 4);
  // Em icones maskable o conteudo fica dentro da zona segura (80% central).
  const escala = maskable ? 0.8 : 1;
  const raioFundo = maskable ? 0 : 0.2;
  const amostras = [0.25, 0.75];

  for (let py = 0; py < tamanho; py += 1) {
    for (let px = 0; px < tamanho; px += 1) {
      let acR = 0, acG = 0, acB = 0, acA = 0;

      for (const oy of amostras) {
        for (const ox of amostras) {
          const x = (px + ox) / tamanho;
          const y = (py + oy) / tamanho;
          let r = FUNDO[0], g = FUNDO[1], b = FUNDO[2], a = 0;

          if (dentroRet(x, y, 0, 0, 1, 1, raioFundo)) {
            const t = Math.min(1, Math.max(0, (x + y) / 2));
            r = misturar(FIRE[0], GOLD[0], t);
            g = misturar(FIRE[1], GOLD[1], t);
            b = misturar(FIRE[2], GOLD[2], t);
            a = 255;

            const hx = (x - 0.5) / escala + 0.5;
            const hy = (y - 0.5) / escala + 0.5;
            if (noHalter(hx, hy)) { r = 26; g = 22; b = 16; }
          }

          acR += r; acG += g; acB += b; acA += a;
        }
      }

      const n = amostras.length ** 2;
      const i = (py * tamanho + px) * 4;
      pixels[i] = Math.round(acR / n);
      pixels[i + 1] = Math.round(acG / n);
      pixels[i + 2] = Math.round(acB / n);
      pixels[i + 3] = Math.round(acA / n);
    }
  }
  return png(tamanho, tamanho, pixels);
}

mkdirSync(destino, { recursive: true });
const arquivos = [
  ['icone-192.png', 192, {}],
  ['icone-512.png', 512, {}],
  ['icone-maskable-192.png', 192, { maskable: true }],
  ['icone-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }],
];
for (const [nome, tamanho, opcoes] of arquivos) {
  writeFileSync(join(destino, nome), desenhar(tamanho, opcoes));
  console.log(`gerado: icons/${nome} (${tamanho}x${tamanho})`);
}
