# EnergyMonitor — Deploy na Vercel

## Estrutura do projeto

```
energymonitor/
├── api/
│   └── motores/
│       ├── index.js   ← GET /api/motores  e  POST /api/motores
│       └── [id].js    ← PUT /api/motores/:id  e  DELETE /api/motores/:id
├── public/
│   ├── index.html
│   ├── motor.html
│   ├── definir_motor.html
│   ├── style.css
│   ├── script.js
│   └── mqtt_config.js
├── vercel.json
└── package.json
```

## Como fazer o deploy

### Opção 1 — Via GitHub (recomendada)

1. Crie um repositório no [GitHub](https://github.com/new) e envie este projeto:
   ```bash
   git init
   git add .
   git commit -m "primeiro commit"
   git remote add origin https://github.com/SEU_USUARIO/energymonitor.git
   git push -u origin main
   ```

2. Acesse [vercel.com](https://vercel.com) → **Add New Project** → importe o repositório.

3. Clique em **Deploy**. Pronto! A Vercel gera uma URL automática.

### Opção 2 — Via CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

## Desenvolvimento local

```bash
npm install
npm run dev
# Acesse: http://localhost:3000
```

## ⚠️ Aviso sobre persistência dos dados

A API usa **memória em tempo de execução** (variável global).
Isso significa que os motores cadastrados são perdidos quando a função
serverless "esfria" (alguns minutos sem uso).

Para persistência real e gratuita, integre um banco externo:
- **Upstash Redis** → https://upstash.com (mais simples)
- **Neon Postgres** → https://neon.tech
- **PlanetScale MySQL** → https://planetscale.com
