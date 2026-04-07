"use strict";

/**
 * EnergyMonitor — /api/motores/[id]  (PUT | DELETE)
 *
 * NUNCA importe 'fs', 'path' ou módulos de disco — ambiente serverless é read-only.
 */

if (!global._motores) {
  global._motores = [];
}

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const id = parseInt(req.query.id, 10);
  const lista = global._motores;

  if (isNaN(id) || id < 0 || id >= lista.length) {
    return res.status(404).json({ erro: "Motor não encontrado." });
  }

  // PUT /api/motores/:id — atualiza motor
  if (req.method === "PUT") {
    lista[id] = Object.assign(lista[id], req.body);
    return res.status(200).json(lista[id]);
  }

  // DELETE /api/motores/:id — remove motor
  if (req.method === "DELETE") {
    lista.splice(id, 1);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: "Método não permitido." });
};
