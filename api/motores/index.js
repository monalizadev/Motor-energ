"use strict";

/**
 * EnergyMonitor — /api/motores  (GET | POST)
 *
 * Armazenamento em memória (global._motores).
 * ⚠️  Dados são perdidos quando a função "esfria" na Vercel (sem uso por ~5 min).
 * Para persistência real, use Upstash Redis (gratuito): https://upstash.com
 *
 * NUNCA importe 'fs', 'path' ou módulos de disco — ambiente serverless é read-only.
 */

if (!global._motores) {
  global._motores = [];
}

module.exports = function handler(req, res) {
  // Habilita CORS para o front-end poder chamar a API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // GET /api/motores — retorna lista completa
  if (req.method === "GET") {
    return res.status(200).json(global._motores);
  }

  // POST /api/motores — adiciona motor
  if (req.method === "POST") {
    const motor = req.body;
    if (!motor || !motor.nome) {
      return res.status(400).json({ erro: "Dados inválidos." });
    }
    global._motores.push(motor);
    return res.status(201).json({ id: global._motores.length - 1, motor });
  }

  return res.status(405).json({ erro: "Método não permitido." });
};
