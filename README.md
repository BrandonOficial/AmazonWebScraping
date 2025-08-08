# TraineeFS – Amazon Scraper (Backend + Frontend)

Aplicação full-stack simples para buscar produtos da Amazon por palavra‑chave (via scraping no backend) e exibi‑los no frontend (Vite + Vanilla JS).

### Requisitos

- Bun (recomendado) ou Node.js 18+ para o backend
- Node.js 18+ e npm (ou Bun/PNPM) para o frontend

### Estrutura do projeto

- `backend/`: API Express rodando com Bun, faz scraping da Amazon
- `frontend/`: app Vite que consome a API e renderiza os cards de produto

## Como iniciar

### 1) Backend

1. Acesse a pasta do backend:
   ```bash
   cd backend
   ```
2. Instale dependências (com Bun):
   ```bash
   bun install
   ```
   Alternativa com npm:
   ```bash
   npm install
   ```
3. Inicie o servidor (hot reload com Bun):
   ```bash
   bun run dev
   ```
   Ou iniciar sem hot reload:
   ```bash
   bun run start
   ```
   Sem Bun (Node puro):
   ```bash
   node server.js
   ```

Por padrão a API sobe em `http://localhost:3001`.

### 2) Frontend

1. Acesse a pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instale dependências:
   ```bash
   npm install
   ```
3. Rode em modo desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse a aplicação (Vite) na URL mostrada no terminal (ex.: `http://localhost:5173`).

Observação: o frontend consome a API em `http://localhost:3001/api/scrape`. Se mudar a porta do backend, atualize `API_URL` em `frontend/src/main.js`.

## Configuração (.env) do backend (opcional)

Crie um arquivo `.env` em `backend/` se quiser customizar:

```env
PORT=3001
MARKETPLACE_BASE_URL=https://www.amazon.com
DEFAULT_SEARCH_TERM=headphones
FALLBACK_KEYWORDS=laptop,usb,keyboard,monitor,mouse
```

- **PORT**: porta da API
- **MARKETPLACE_BASE_URL**: domínio do marketplace alvo
- **DEFAULT_SEARCH_TERM**: termo padrão quando nenhum for informado
- **FALLBACK_KEYWORDS**: termos extras usados quando não há `keyword`

## Endpoints da API

- `GET /api/health`

  - Healthcheck simples. Resposta: `{ "status": "ok" }`

- `GET /api/scrape?keyword=TERMO`
  - Faz scraping da primeira página de resultados por `TERMO` (Amazon).
  - Se `keyword` não for enviado ou vier vazio, a API agrega resultados usando `DEFAULT_SEARCH_TERM` + `FALLBACK_KEYWORDS`.

### Estrutura da resposta

Quando `keyword` é enviado:

```json
{
  "keyword": "headphones",
  "count": 3,
  "products": [
    {
      "title": "Nome do produto",
      "rating": 4.5,
      "reviews": 1234,
      "image": "https://.../imagem.jpg",
      "url": "https://www.amazon.com/dp/ASIN"
    }
  ]
}
```

Sem `keyword` (agregado): `keyword` vem vazio e `products` contém itens de vários termos.

### Códigos de erro

- `503`: Captcha detectado pela Amazon (tente novamente mais tarde)
- `502`: Falha ao buscar dados da Amazon
- `500`: Erro inesperado
- `404`: Rota não encontrada

## Como o frontend consome a API

No arquivo `frontend/src/main.js`, a URL está definida como:

```js
const API_URL = "http://localhost:3001/api/scrape";
```

O frontend faz `fetch` com `?keyword=${encodeURIComponent(keyword)}` e renderiza cartões para cada item de `products` (título com link, imagem, nota média e número de avaliações).

## Teste rápido via cURL

```bash
curl "http://localhost:3001/api/scrape?keyword=headphones"
```
## Avisos

- Scraping pode sofrer bloqueios/captcha do provedor e mudar sem aviso.
- Use apenas para fins educacionais.

  <img width="1902" height="818" alt="Captura de Tela (122)" src="https://github.com/user-attachments/assets/a8a35e46-3ee4-4d96-b6e8-dbe75660e995" />

