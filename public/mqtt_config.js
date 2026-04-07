/**
 * EnergyMonitor — Configuração MQTT
 * Edite este arquivo para conectar ao seu broker.
 *
 * Broker gratuito recomendado: HiveMQ Cloud (hivemq.com/mqtt-cloud-broker)
 * Ou rode o Mosquitto localmente com suporte a WebSocket.
 */
var MQTT_CONFIG = {
  /* Endereço do broker — use wss:// para TLS (recomendado em produção) */
  host: "8316cb76632c4630ac05b42eb4065a67.s1.eu.hivemq.cloud" /* ← substitua pelo seu broker         */,
  port: 8884 /* 8884 = WSS (TLS), 8083 = WS (sem TLS) */,
  useTLS: true,

  /* Credenciais — deixe vazio se o broker não exigir */
  usuario: "user_esp_monitor",
  senha: "Batatafrita22",

  /* ID único do cliente — dois clientes com mesmo ID se desconectam mutuamente */
  clientId: "energymonitor_web_" + Math.random().toString(16).slice(2, 8),

  /* Prefixo de todos os tópicos — mude se tiver múltiplas instalações */
  prefixo: "energymonitor",

  /*
   * Tópicos gerados automaticamente (não edite):
   *
   *  Comandos  (site → ESP32):
   *    energymonitor/motor/{id}/cmd      payload: "ligar" | "desligar" | "ligar_A" | "ligar_B"
   *
   *  Confirmações (ESP32 → site):
   *    energymonitor/motor/{id}/estado   payload: "ligado" | "desligado" | "ligado_A" | "ligado_B" | "erro"
   *
   *  Telemetria  (ESP32 → site):
   *    energymonitor/telemetria          payload: JSON  { tensao, corrente, potencia, fp, kwh }
   *
   *  Status do ESP32:
   *    energymonitor/dispositivo/status  payload: "online" | "offline"  (Last Will)
   */
};
