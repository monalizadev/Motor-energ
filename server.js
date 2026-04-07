/**
 * EnergyMonitor — Servidor Node.js
 * Serve os arquivos estáticos e persiste os motores via API REST.
 *
 * Instalar dependências:  npm install
 * Iniciar:               node server.js
 * Ou com auto-reload:    npx nodemon server.js
 */

"use strict";

const express  = require("express");
const fs       = require("fs");
const path     = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;
const DB   = path.join(__dirname, "motores.json");

/* ── Inicializa arquivo de dados ── */
if (!fs.existsSync(DB)) {
  fs.writeFileSync(DB, "[]", "utf8");
}

/* ── Middlewares ── */
app.use(express.json());
app.use(express.static(__dirname));   // serve HTML, CSS, JS

/* ── Helpers ── */
function lerMotores() {
  try {
    return JSON.parse(fs.readFileSync(DB, "utf8") || "[]");
  } catch (e) {
    return [];
  }
}

function salvarMotores(lista) {
  fs.writeFileSync(DB, JSON.stringify(lista, null, 2), "utf8");
}

/* ── API REST ── */

/* GET /api/motores — retorna lista completa */
app.get("/api/motores", (req, res) => {
  res.json(lerMotores());
});

/* POST /api/motores — adiciona motor */
app.post("/api/motores", (req, res) => {
  const motor = req.body;
  if (!motor || !motor.nome) {
    return res.status(400).json({ erro: "Dados inválidos." });
  }
  const lista = lerMotores();
  lista.push(motor);
  salvarMotores(lista);
  res.status(201).json({ id: lista.length - 1, motor });
});

/* PUT /api/motores/:id — atualiza motor por índice */
app.put("/api/motores/:id", (req, res) => {
  const id    = parseInt(req.params.id, 10);
  const lista = lerMotores();
  if (id < 0 || id >= lista.length) {
    return res.status(404).json({ erro: "Motor não encontrado." });
  }
  lista[id] = Object.assign(lista[id], req.body);
  salvarMotores(lista);
  res.json(lista[id]);
});

/* DELETE /api/motores/:id — remove motor por índice */
app.delete("/api/motores/:id", (req, res) => {
  const id    = parseInt(req.params.id, 10);
  const lista = lerMotores();
  if (id < 0 || id >= lista.length) {
    return res.status(404).json({ erro: "Motor não encontrado." });
  }
  lista.splice(id, 1);
  salvarMotores(lista);
  res.json({ ok: true });
});

/* ── Iniciar ── */
app.listen(PORT, () => {
  console.log(`EnergyMonitor rodando em http://localhost:${PORT}`);
});
