(function () {
  "use strict";
  /*aaaaaaa */

  /* =============================================
     ARMAZENAMENTO — API REST (servidor)
     Os dados ficam em motores.json no servidor,
     compartilhados entre todos os clientes.
  ============================================= */

  /* Cache local para operações síncronas legadas */
  var _cacheMotores = [];

  function getMotores() {
    return _cacheMotores;
  }

  /* Busca a lista do servidor e atualiza o cache */
  function carregarMotores(callback) {
    fetch("/api/motores")
      .then(function(r) { return r.json(); })
      .then(function(lista) {
        _cacheMotores = lista;
        if (callback) callback(lista);
      })
      .catch(function(e) {
        console.error("[API] Erro ao carregar motores:", e);
        if (callback) callback([]);
      });
  }

  /* Salva a lista completa no servidor (substitui tudo) */
  function salvarMotores(lista, callback) {
    _cacheMotores = lista;
    /* Sincroniza cada posição: DELETE os que sumiram, PUT nos existentes */
    /* Para simplificar, recarregamos após qualquer operação individual */
    if (callback) callback();
  }

  /* Adiciona um motor novo via POST */
  function adicionarMotorAPI(motor, callback) {
    fetch("/api/motores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(motor)
    })
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        carregarMotores(function() { if (callback) callback(resp.id); });
      })
      .catch(function(e) { console.error("[API] Erro ao adicionar motor:", e); });
  }

  /* Remove motor por índice via DELETE */
  function excluirMotorAPI(index, callback) {
    fetch("/api/motores/" + index, { method: "DELETE" })
      .then(function() { carregarMotores(callback); })
      .catch(function(e) { console.error("[API] Erro ao excluir motor:", e); });
  }

  /* Atualiza motor por índice via PUT */
  function atualizarMotorAPI(index, dados, callback) {
    fetch("/api/motores/" + index, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    })
      .then(function() { carregarMotores(callback); })
      .catch(function(e) { console.error("[API] Erro ao atualizar motor:", e); });
  }

  /* =============================================
     ESTADO GLOBAL
  ============================================= */
  var motorSelecionado = null;
  var picoFase  = { a: 0, b: 0, c: 0 };
  var totalAmostras = 0;

  /* Pinos de relé disponíveis — preenchido quando o ESP32 envia capacidades */
  var pinosDisponiveisESP = [];

  /* =============================================
     PALETA
  ============================================= */
  var COR = {
    amber:  "#f59e0b",
    blue:   "#3b82f6",
    green:  "#10b981",
    purple: "#a78bfa",
    red:    "#ef4444",
    grid:   "rgba(255,255,255,0.04)",
    tick:   "#3d4a5c"
  };

  function hexRgba(hex, a) {
    var r = parseInt(hex.slice(1,3),16);
    var g = parseInt(hex.slice(3,5),16);
    var b = parseInt(hex.slice(5,7),16);
    return "rgba("+r+","+g+","+b+","+a+")";
  }

  /* =============================================
     GRÁFICOS
  ============================================= */
  var MAX_PONTOS = 60;
  var graficos = {};

  function opcoesBase(cores, unidade) {
    var corPrincipal = Array.isArray(cores) ? cores[0] : cores;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#13161b",
          borderColor: "#1e2530",
          borderWidth: 1,
          titleColor: "#64748b",
          bodyColor: corPrincipal,
          titleFont: { family: "'Share Tech Mono', monospace", size: 10 },
          bodyFont:  { family: "'Share Tech Mono', monospace", size: 12, weight: "bold" },
          padding: 10,
          callbacks: {
            labelColor: function(ctx) {
              var c = Array.isArray(cores) ? (cores[ctx.datasetIndex] || corPrincipal) : corPrincipal;
              return { borderColor: c, backgroundColor: c };
            },
            label: function(ctx) {
              return "  " + ctx.dataset.label + ": " + ctx.parsed.y.toFixed(2) + (unidade ? " "+unidade : "");
            }
          }
        }
      },
      scales: {
        x: {
          grid:  { color: COR.grid },
          ticks: { color: COR.tick, font: { family: "'Share Tech Mono', monospace", size: 9 }, maxTicksLimit: 8, maxRotation: 0 }
        },
        y: {
          grid:  { color: COR.grid },
          ticks: {
            color: COR.tick, font: { family: "'Share Tech Mono', monospace", size: 9 }, maxTicksLimit: 6,
            callback: function(v) { return v + (unidade ? " "+unidade : ""); }
          }
        }
      }
    };
  }

  function criarDataset(label, cor, fill) {
    return {
      label: label, data: [], borderColor: cor, borderWidth: 1.8,
      backgroundColor: fill ? hexRgba(cor, 0.12) : "transparent",
      fill: !!fill, tension: 0.35, pointRadius: 0, pointHoverRadius: 4,
      pointHoverBackgroundColor: cor, pointHoverBorderColor: "#0d0f12", pointHoverBorderWidth: 2
    };
  }

  function iniciarGraficos() {
    var elFases = document.getElementById("chart-fases");
    if (elFases) {
      graficos.fases = new Chart(elFases.getContext("2d"), {
        type: "line",
        data: { labels: [], datasets: [
          criarDataset("Fase A", COR.amber,  true),
          criarDataset("Fase B", COR.blue,   false),
          criarDataset("Fase C", COR.green,  false)
        ]},
        options: opcoesBase([COR.amber, COR.blue, COR.green], "A")
      });
    }
    var elPot = document.getElementById("chart-potencia");
    if (elPot) {
      graficos.potencia = new Chart(elPot.getContext("2d"), {
        type: "line",
        data: { labels: [], datasets: [ criarDataset("Potência", COR.green, true) ] },
        options: opcoesBase(COR.green, "kW")
      });
    }
    var elFp = document.getElementById("chart-fp");
    if (elFp) {
      graficos.fp = new Chart(elFp.getContext("2d"), {
        type: "line",
        data: { labels: [], datasets: [ criarDataset("FP", COR.purple, true) ] },
        options: opcoesBase(COR.purple, "")
      });
    }
    var btnLimpar = document.getElementById("btn-limpar-fases");
    if (btnLimpar) btnLimpar.addEventListener("click", limparGraficos);
  }

  function limparGraficos() {
    Object.keys(graficos).forEach(function(k) {
      var g = graficos[k];
      g.data.labels = [];
      g.data.datasets.forEach(function(ds) { ds.data = []; });
      g.update("none");
    });
    picoFase = { a: 0, b: 0, c: 0 };
    totalAmostras = 0;
    atualizarSidebar(null);
  }

  function empurrarPonto(chave, valores) {
    var g = graficos[chave];
    if (!g) return;
    var agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (g.data.labels.length >= MAX_PONTOS) {
      g.data.labels.shift();
      g.data.datasets.forEach(function(ds) { ds.data.shift(); });
    }
    g.data.labels.push(agora);
    if (Array.isArray(valores)) {
      valores.forEach(function(v, i) { if (g.data.datasets[i]) g.data.datasets[i].data.push(v); });
    } else {
      g.data.datasets[0].data.push(valores);
    }
    g.update("none");
  }

  /* =============================================
     MINI-GAUGE DE FASES
  ============================================= */
  function atualizarFaseUI(fase, valor, max) {
    var valEl = document.getElementById("fase-" + fase + "-val");
    var barEl = document.getElementById("fase-" + fase + "-bar");
    if (!valEl || !barEl) return;
    if (fase === "desb") {
      valEl.textContent = isNaN(valor) ? "— %" : valor.toFixed(1) + " %";
      var pct = Math.min(valor, 100);
      barEl.style.width = pct + "%";
      barEl.style.background = pct < 5 ? COR.green : pct < 10 ? COR.amber : COR.red;
    } else {
      valEl.textContent = isNaN(valor) ? "— A" : valor.toFixed(1) + " A";
      var pctFase = max > 0 ? Math.min((valor / max) * 100, 100) : 0;
      barEl.style.width = pctFase + "%";
      if (pctFase > 100) barEl.style.background = COR.red;
      else if (pctFase > 90) barEl.style.background = COR.amber;
    }
  }

  /* =============================================
     SELETOR DE MOTOR — UI (Dashboard)
  ============================================= */
  function popularSeletor() {
    var sel = document.getElementById("motor-select");
    if (!sel) return;
    var motores = getMotores();
    sel.innerHTML = "<option value=''>— Selecione um motor —</option>";
    motores.forEach(function(m, i) {
      var opt = document.createElement("option");
      opt.value = i;
      opt.textContent = m.nome + " — " + m.tipo;
      sel.appendChild(opt);
    });
    if (motorSelecionado !== null && motorSelecionado < motores.length) {
      sel.value = motorSelecionado;
    }
    sel.addEventListener("change", function() {
      var v = sel.value;
      motorSelecionado = v === "" ? null : parseInt(v, 10);
      limparGraficos();
      atualizarInfoMotor();
    });
    atualizarInfoMotor();
  }

  function atualizarInfoMotor() {
    var motores = getMotores();
    var motor = motorSelecionado !== null ? motores[motorSelecionado] : null;
    var elNome = document.getElementById("sidebar-motor-nome");
    var elTipo = document.getElementById("sidebar-motor-tipo");
    if (elNome) elNome.textContent = motor ? motor.nome : "—";
    if (elTipo) elTipo.textContent = motor ? motor.tipo : "";
    var elCnom  = document.getElementById("sidebar-cnom");
    var elCmax  = document.getElementById("sidebar-cmax");
    var elTempo = document.getElementById("sidebar-tempo");
    if (elCnom)  elCnom.textContent  = motor ? motor.correnteNominal + " A" : "—";
    if (elCmax)  elCmax.textContent  = motor ? motor.correnteMaxima  + " A" : "—";
    if (elTempo) elTempo.textContent = motor ? motor.tempo + " s"           : "—";
    var badge = document.getElementById("motor-info-badge");
    if (badge) {
      if (motor) {
        badge.style.display = "flex";
        badge.innerHTML =
          "<span>Nom: <strong>" + motor.correnteNominal + "A</strong></span>" +
          "<span>Máx: <strong>" + motor.correnteMaxima + "A</strong></span>" +
          "<span>Partida: <strong>" + motor.tipo + "</strong></span>" +
          (motor.pinoA >= 0 ? "<span>Relé: <strong>GPIO " + motor.pinoA + "</strong></span>" : "");
      } else {
        badge.style.display = "none";
      }
    }
  }

  /* =============================================
     SIDEBAR — métricas dinâmicas
  ============================================= */
  function atualizarSidebar(d) {
    var elAmostras = document.getElementById("sidebar-amostras");
    var elEfic     = document.getElementById("sidebar-eficiencia");
    var elPicoA    = document.getElementById("sidebar-pico-a");
    var elPicoB    = document.getElementById("sidebar-pico-b");
    var elPicoC    = document.getElementById("sidebar-pico-c");
    if (elAmostras) elAmostras.textContent = totalAmostras;
    if (elPicoA) elPicoA.textContent = picoFase.a > 0 ? picoFase.a.toFixed(1) + " A" : "—";
    if (elPicoB) elPicoB.textContent = picoFase.b > 0 ? picoFase.b.toFixed(1) + " A" : "—";
    if (elPicoC) elPicoC.textContent = picoFase.c > 0 ? picoFase.c.toFixed(1) + " A" : "—";
    if (elEfic) {
      var g = graficos.fp;
      if (g && g.data.datasets[0].data.length > 0) {
        var fp = g.data.datasets[0].data[g.data.datasets[0].data.length - 1];
        elEfic.textContent = Math.round(fp * 100) + "%";
      } else {
        elEfic.textContent = "—";
      }
    }
  }

  /* =============================================
     ALERTAS
  ============================================= */
  function verificarAlertas(d) {
    var motores = getMotores();
    var motor = motorSelecionado !== null ? motores[motorSelecionado] : null;
    var alertas = [];
    if (motor) {
      var cMax = motor.correnteMaxima;
      ["ia", "ib", "ic"].forEach(function(campo, i) {
        var letra = ["A","B","C"][i];
        var val = d[campo];
        if (val === undefined) return;
        if (val > cMax) {
          alertas.push({ tipo: "erro", msg: "Sobrecorrente Fase " + letra + ": " + val.toFixed(1) + "A > " + cMax + "A" });
        } else if (val > cMax * 0.9) {
          alertas.push({ tipo: "aviso", msg: "Fase " + letra + " próx. limite: " + val.toFixed(1) + "A" });
        }
      });
    }
    if (d.desbalanceamento !== undefined && d.desbalanceamento > 10) {
      alertas.push({ tipo: "erro", msg: "Desbalanceamento crítico: " + d.desbalanceamento.toFixed(1) + "%" });
    } else if (d.desbalanceamento !== undefined && d.desbalanceamento > 5) {
      alertas.push({ tipo: "aviso", msg: "Desbalanceamento: " + d.desbalanceamento.toFixed(1) + "%" });
    }
    if (d.fp !== undefined && d.fp < 0.92) {
      alertas.push({ tipo: "aviso", msg: "FP baixo: " + d.fp.toFixed(2) });
    }
    renderizarAlertas(alertas);
  }

  function renderizarAlertas(alertas) {
    var el = document.getElementById("alertas-container");
    if (!el) return;
    if (alertas.length === 0) {
      el.innerHTML = "<div class='alerta-vazio'>Nenhum alerta ativo</div>";
      return;
    }
    el.innerHTML = alertas.map(function(a) {
      return "<div class='alerta alerta-" + a.tipo + "'>" + a.msg + "</div>";
    }).join("");
  }

  /* =============================================
     SELETOR DE PINOS — definir_motor.html
  ============================================= */
  /* Chamado quando o tipo de partida muda */
  window.atualizarCamposPartida = function() {
    var tipo   = document.getElementById("tipo");
    var campoB = document.getElementById("campo-rele-b");
    if (!tipo || !campoB) return;
    campoB.style.display = tipo.value === "Direta com reversão" ? "block" : "none";
    atualizarPreviewPino();
  };

  /* Popula os <select> de pinos com os pinos disponíveis do ESP32 */
  function popularSelectoresPinos(pinos) {
    pinosDisponiveisESP = pinos;

    /* Mostra seção de info */
    var infoCont = document.getElementById("pinos-info");
    if (infoCont) {
      if (pinos.length === 0) {
        infoCont.innerHTML = "<span class='pinos-loading'>Nenhum pino configurado no firmware.</span>";
      } else {
        infoCont.innerHTML = pinos.map(function(p) {
          return "<span class='pino-chip'>GPIO " + p + "</span>";
        }).join("");
      }
    }

    /* Atualiza aviso de ESP offline */
    var aviso = document.getElementById("aviso-esp");
    if (aviso) aviso.style.display = "none";

    /* Popula selects */
    ["pino-a", "pino-b"].forEach(function(id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      var valorAtual = sel.value;
      sel.innerHTML = "<option value='-1'>— Sem relé —</option>";
      pinos.forEach(function(p) {
        var opt = document.createElement("option");
        opt.value = p;
        opt.textContent = "GPIO " + p;
        sel.appendChild(opt);
      });
      /* Restaura valor anterior se ainda válido */
      if (valorAtual && sel.querySelector("option[value='" + valorAtual + "']")) {
        sel.value = valorAtual;
      }
      sel.addEventListener("change", atualizarPreviewPino);
    });

    atualizarPreviewPino();
  }

  function atualizarPreviewPino() {
    var preview = document.getElementById("pino-preview");
    var txt     = document.getElementById("pino-preview-txt");
    var selA    = document.getElementById("pino-a");
    var selB    = document.getElementById("pino-b");
    if (!preview || !txt || !selA) return;

    var linhas = [];
    if (selA.value && selA.value !== "-1") linhas.push("Relé principal → GPIO " + selA.value);
    if (selB && selB.value && selB.value !== "-1") linhas.push("Relé reversão → GPIO " + selB.value);

    if (linhas.length > 0) {
      txt.textContent = linhas.join("   |   ");
      preview.style.display = "block";
    } else {
      preview.style.display = "none";
    }
  }

  /* =============================================
     MQTT
  ============================================= */
  var mqtt   = null;
  var mqttOk = false;
  var assinantes = {};

  function topico(sufixo) {
    return (window.MQTT_CONFIG ? MQTT_CONFIG.prefixo : "energymonitor") + "/" + sufixo;
  }

  function iniciarMQTT() {
    if (typeof window.MQTT_CONFIG === "undefined" || typeof window.mqtt === "undefined") {
      console.warn("[MQTT] Modo demo ativado.");
      simularDadosDemo();
      return;
    }

    var cfg = window.MQTT_CONFIG;
    var url = (cfg.useTLS ? "wss" : "ws") + "://" + cfg.host + ":" + cfg.port + "/mqtt";

    mqtt = window.mqtt.connect(url, {
      clientId:        cfg.clientId,
      username:        cfg.usuario  || undefined,
      password:        cfg.senha    || undefined,
      keepalive:       30,
      reconnectPeriod: 3000,
      connectTimeout:  10000,
      will: { topic: topico("dispositivo/site"), payload: "offline", qos: 1, retain: true }
    });

    mqtt.on("connect", function () {
      mqttOk = true;
      atualizarIndicadorMQTT("online");
      mqtt.subscribe(topico("motor/+/telemetria"),           { qos: 0 });
      mqtt.subscribe(topico("telemetria"),                    { qos: 0 });
      mqtt.subscribe(topico("motor/+/estado"),                { qos: 1 });
      mqtt.subscribe(topico("dispositivo/status"),            { qos: 1 });
      mqtt.subscribe(topico("dispositivo/capacidades"),       { qos: 1 });
      mqtt.subscribe(topico("dispositivo/motores"),           { qos: 1 });
      mqtt.publish(topico("dispositivo/site"), "online",      { retain: true, qos: 1 });
      /* Solicita capacidades e lista de motores ao conectar */
      mqtt.publish(topico("config/get"), "1",                 { qos: 1 });
    });

    mqtt.on("offline", function () { mqttOk = false; atualizarIndicadorMQTT("offline"); mostrarAvisoEspOffline(); });
    mqtt.on("error",   function ()  { mqttOk = false; atualizarIndicadorMQTT("erro");    mostrarAvisoEspOffline(); });

    mqtt.on("message", function (topic, payload) {
      var msg = payload.toString();

      /* ── Telemetria por motor ── */
      var matchTel = topic.match(/\/motor\/(\d+)\/telemetria$/);
      if (matchTel) {
        var idMsg = parseInt(matchTel[1], 10);
        if (motorSelecionado !== null && idMsg === motorSelecionado) {
          try { atualizarDashboard(JSON.parse(msg)); } catch(e) {}
        }
        return;
      }

      /* ── Telemetria geral ── */
      if (topic === topico("telemetria")) {
        try { atualizarDashboard(JSON.parse(msg)); } catch(e) {}
        return;
      }

      /* ── Status ESP32 ── */
      if (topic === topico("dispositivo/status")) {
        atualizarIndicadorDispositivo(msg);
        if (msg === "online") mqtt.publish(topico("config/get"), "1", { qos: 1 });
        return;
      }

      /* ── Capacidades do ESP32 (lista de pinos de relé disponíveis) ── */
      if (topic === topico("dispositivo/capacidades")) {
        try {
          var cap = JSON.parse(msg);
          if (cap.pinos && Array.isArray(cap.pinos)) {
            popularSelectoresPinos(cap.pinos);
          }
        } catch(e) {}
        return;
      }

      /* ── Lista de motores configurados no ESP32 ── */
      if (topic === topico("dispositivo/motores")) {
        try {
          var dados = JSON.parse(msg);
          if (dados.motores) sincronizarMotoresESP(dados.motores);
        } catch(e) {}
        return;
      }

      /* ── Estado de motor ── */
      var matchEst = topic.match(/\/motor\/(\d+)\/estado$/);
      if (matchEst) {
        var id = parseInt(matchEst[1], 10);
        var cb = assinantes["motor/" + id + "/estado"];
        if (cb) cb(msg);
      }
    });
  }

  /* Quando o ESP32 envia sua lista de motores configurados, atualiza o localStorage */
  function sincronizarMotoresESP(motoresESP) {
    var motoresLocal = getMotores();
    var pendentes = [];
    motoresESP.forEach(function(me) {
      var idx = me.id;
      if (motoresLocal[idx]) {
        if (motoresLocal[idx].pinoA !== me.pinoA || motoresLocal[idx].pinoB !== me.pinoB) {
          pendentes.push({ idx: idx, dados: { pinoA: me.pinoA, pinoB: me.pinoB } });
        }
      }
    });
    if (pendentes.length === 0) return;
    /* Atualiza cada motor com pino alterado via API */
    var i = 0;
    function proxima() {
      if (i >= pendentes.length) { carregarMotores(renderizarMotores); return; }
      var p = pendentes[i++];
      atualizarMotorAPI(p.idx, p.dados, proxima);
    }
    proxima();
  }

  function mostrarAvisoEspOffline() {
    var aviso = document.getElementById("aviso-esp");
    if (aviso) aviso.style.display = "block";
  }

  /* ── Modo demo (sem MQTT) ── */
  function simularDadosDemo() {
    var t = 0, kwhAcum = 0;
    var badge = document.getElementById("mqtt-status");
    if (badge) { badge.textContent = "DEMO ●"; badge.className = "mqtt-badge mqtt-demo"; }

    /* Simula pinos disponíveis no modo demo */
    popularSelectoresPinos([26, 27, 14, 12, 13, 25, 33, 32]);

    var intervalo = setInterval(function() {
      var baseA = 28 + Math.sin(t * 0.05) * 7;
      var baseB = 27 + Math.sin(t * 0.05 + 0.2) * 7;
      var baseC = 29 + Math.sin(t * 0.05 - 0.15) * 7;
      var noise = function() { return (Math.random() - 0.5) * 2; };
      var ia = parseFloat((baseA + noise()).toFixed(2));
      var ib = parseFloat((baseB + noise()).toFixed(2));
      var ic = parseFloat((baseC + noise()).toFixed(2));
      var media = (ia + ib + ic) / 3;
      var desbalMax = Math.max(Math.abs(ia-media), Math.abs(ib-media), Math.abs(ic-media));
      var desbalanceamento = media > 0 ? parseFloat(((desbalMax / media) * 100).toFixed(2)) : 0;
      var tensao   = parseFloat((220 + Math.sin(t * 0.02) * 3 + noise()).toFixed(1));
      var fp       = parseFloat((0.88 + Math.sin(t * 0.03) * 0.06).toFixed(3));
      var potencia = parseFloat((media * tensao * fp / 1000).toFixed(3));
      kwhAcum     += potencia / 3600;
      atualizarDashboard({
        ia: ia, ib: ib, ic: ic,
        corrente: parseFloat(media.toFixed(2)),
        tensao: tensao, fp: fp, potencia: potencia,
        kwh: parseFloat(kwhAcum.toFixed(4)),
        desbalanceamento: desbalanceamento
      });
      t++;
    }, 1000);
    window._stopDemo = function() { clearInterval(intervalo); };
  }

  function publicar(sufixo, payload) {
    if (!mqttOk || !mqtt) { console.warn("[MQTT] Offline —", sufixo); return false; }
    mqtt.publish(topico(sufixo), payload, { qos: 1 });
    return true;
  }

  /* Envia configuração de motor ao ESP32 */
  function enviarConfigMotorESP(idMotor, motor, ativo) {
    var cfg = JSON.stringify({
      id:    idMotor,
      nome:  motor ? motor.nome : "",
      pinoA: motor ? (motor.pinoA !== undefined ? motor.pinoA : -1) : -1,
      pinoB: motor ? (motor.pinoB !== undefined ? motor.pinoB : -1) : -1,
      ativo: !!ativo
    });
    return publicar("config/motor", cfg);
  }

  function onEstadoMotor(idMotor, callback) {
    assinantes["motor/" + idMotor + "/estado"] = callback;
  }

  /* =============================================
     UI — Indicadores header
  ============================================= */
  function atualizarIndicadorMQTT(status) {
    var el = document.getElementById("mqtt-status");
    if (!el) return;
    var mapa = {
      online:  { txt: "MQTT ●", cls: "mqtt-online"  },
      offline: { txt: "MQTT ○", cls: "mqtt-offline" },
      erro:    { txt: "MQTT ✕", cls: "mqtt-erro"    }
    };
    var s = mapa[status] || mapa.offline;
    el.textContent = s.txt; el.className = "mqtt-badge " + s.cls;
  }

  function atualizarIndicadorDispositivo(status) {
    var el = document.getElementById("esp-status");
    if (!el) return;
    el.textContent = status === "online" ? "ESP32 ●" : "ESP32 ○";
    el.className   = "mqtt-badge " + (status === "online" ? "mqtt-online" : "mqtt-offline");
  }

  /* =============================================
     DASHBOARD PRINCIPAL
  ============================================= */
  function atualizarDashboard(d) {
    var ia = d.ia !== undefined ? d.ia : (d.faseA !== undefined ? d.faseA : NaN);
    var ib = d.ib !== undefined ? d.ib : (d.faseB !== undefined ? d.faseB : NaN);
    var ic = d.ic !== undefined ? d.ic : (d.faseC !== undefined ? d.faseC : NaN);

    var corrMedia = d.corrente;
    if (corrMedia === undefined && !isNaN(ia) && !isNaN(ib) && !isNaN(ic)) {
      corrMedia = (ia + ib + ic) / 3;
    }

    var desb = d.desbalanceamento;
    if (desb === undefined && !isNaN(ia) && !isNaN(ib) && !isNaN(ic)) {
      var med = corrMedia;
      desb = med > 0
        ? (Math.max(Math.abs(ia-med), Math.abs(ib-med), Math.abs(ic-med)) / med) * 100
        : 0;
    }

    setVal("dash-tensao",   d.tensao   !== undefined ? d.tensao.toFixed(1)   : null);
    setVal("dash-corrente", corrMedia  !== undefined ? corrMedia.toFixed(2)  : null);
    setVal("dash-potencia", d.potencia !== undefined ? d.potencia.toFixed(3) : null);
    setVal("dash-fp",       d.fp       !== undefined ? d.fp.toFixed(3)       : null);
    setVal("dash-kwh",      d.kwh      !== undefined ? d.kwh.toFixed(4)      : null);

    var motores = getMotores();
    var motor = motorSelecionado !== null ? motores[motorSelecionado] : null;
    var cMax  = motor ? motor.correnteMaxima : (corrMedia ? corrMedia * 1.5 : 50);

    if (!isNaN(ia)) atualizarFaseUI("a", ia, cMax);
    if (!isNaN(ib)) atualizarFaseUI("b", ib, cMax);
    if (!isNaN(ic)) atualizarFaseUI("c", ic, cMax);
    if (desb !== undefined && !isNaN(desb)) atualizarFaseUI("desb", desb, 100);

    if (!isNaN(ia) && !isNaN(ib) && !isNaN(ic)) empurrarPonto("fases", [ia, ib, ic]);
    if (d.potencia !== undefined) empurrarPonto("potencia", d.potencia);
    if (d.fp       !== undefined) empurrarPonto("fp",       d.fp);

    totalAmostras++;
    if (!isNaN(ia) && ia > picoFase.a) picoFase.a = ia;
    if (!isNaN(ib) && ib > picoFase.b) picoFase.b = ib;
    if (!isNaN(ic) && ic > picoFase.c) picoFase.c = ic;

    var el = document.getElementById("dash-ultima-leitura");
    if (el) el.textContent = new Date().toLocaleTimeString("pt-BR");

    atualizarSidebar(d);
    verificarAlertas(Object.assign({}, d, { ia: ia, ib: ib, ic: ic, desbalanceamento: desb }));
  }

  function setVal(id, valor) {
    var el = document.getElementById(id);
    if (el && valor !== null && valor !== undefined) {
      el.classList.remove("param-atualizado");
      void el.offsetWidth;
      el.classList.add("param-atualizado");
      el.textContent = valor;
    }
  }

  /* =============================================
     MOTOR.HTML — renderizar
  ============================================= */
  function renderizarMotores() {
    var grid  = document.getElementById("botoes-de-controle");
    var lista = document.getElementById("lista-motores");
    if (!grid || !lista) return;

    var motores = getMotores();
    grid.innerHTML  = "";
    lista.innerHTML = "";

    if (motores.length === 0) {
      grid.innerHTML  = "<div class='lista-vazia' style='grid-column:1/-1'>Nenhum motor cadastrado. <a href='definir_motor.html'>+ Adicionar agora</a></div>";
      lista.innerHTML = "<div class='lista-vazia'>Nenhum motor cadastrado ainda.</div>";
      return;
    }

    motores.forEach(function (motor, index) {
      if (motor.tipo === "Direta com reversão") {
        criarBotoesReversao(motor, index, grid);
      } else {
        criarBotaoSimples(motor, index, grid);
      }

      var pinoInfo = "";
      if (motor.pinoA >= 0) pinoInfo += "<span>Relé A: <strong>GPIO " + motor.pinoA + "</strong></span>";
      if (motor.pinoB >= 0) pinoInfo += "<span>Relé B: <strong>GPIO " + motor.pinoB + "</strong></span>";

      var item = document.createElement("div");
      item.className = "motor-item";
      item.innerHTML =
        "<span class='motor-item-nome'>" + motor.nome + "</span>" +
        "<div class='motor-item-detalhes'>" +
          "<span><strong>" + motor.tempo + "s</strong>&nbsp;partida</span>" +
          "<span><strong>" + motor.correnteMaxima + "A</strong>&nbsp;máx.</span>" +
          "<span><strong>" + motor.correnteNominal + "A</strong>&nbsp;nom.</span>" +
          pinoInfo +
        "</div>" +
        "<span class='badge-tipo'>" + motor.tipo + "</span>" +
        "<button class='btn-excluir' title='Remover motor' onclick='excluirMotor(" + index + ")'>✕</button>";
      lista.appendChild(item);
    });
  }

  /* =============================================
     UTILITÁRIOS DE BOTÃO
  ============================================= */
  function criarEstruturaBotao(nomeAlt, nomePrincipal, labelTipo) {
    var btn = document.createElement("button");
    btn.className = "button";
    btn.innerHTML =
      "<div class='status-dot'></div>" +
      "<img src='acetes/motor_desligado.png' alt='" + nomeAlt + "' />" +
      "<span class='motor-nome'>" + nomePrincipal + "</span>" +
      "<span class='motor-tipo'>" + labelTipo + "</span>";
    return btn;
  }

  function imgDe(btn) { return btn.querySelector("img"); }

  var IMG = {
    off:   "acetes/motor_desligado.png",
    on:    "acetes/motor_ligado.png",
    fase1: "acetes/motor_ligando_sem_carga.png",
    fase2: "acetes/motor_ligando_com_carga.png"
  };

  function gerarFases(motor) {
    var t = (motor && motor.tempo > 0) ? motor.tempo * 1000 : 2400;
    return [0.25, 0.25, 0.17, 0.17, 0.08, 0.08].map(function(p, i) {
      return { src: i % 2 === 0 ? IMG.fase1 : IMG.fase2, dur: Math.round(t * p) };
    });
  }

  function rodarAnimacao(btn, fases, onFim) {
    var cancelado = false, idx = 0;
    function passo() {
      if (cancelado) return;
      if (idx >= fases.length) { onFim(); return; }
      imgDe(btn).src = fases[idx].src;
      var d = fases[idx].dur; idx++;
      setTimeout(passo, d);
    }
    passo();
    return function() { cancelado = true; };
  }

  /* =============================================
     BOTÃO SIMPLES
  ============================================= */
  function criarBotaoSimples(motor, idMotor, grid) {
    var btn = criarEstruturaBotao(motor.nome, motor.nome, motor.tipo);
    inicializarBotaoSimples(btn, motor, idMotor);
    grid.appendChild(btn);
  }

  function inicializarBotaoSimples(btn, motor, idMotor) {
    var estado = "off", cancelar = null;

    onEstadoMotor(idMotor, function(msg) {
      if (msg === "ligado" && estado === "starting") {
        if (cancelar) { cancelar(); cancelar = null; }
        imgDe(btn).src = IMG.on;
        btn.classList.remove("ligando"); btn.classList.add("ligado");
        estado = "on";
      }
      if (msg === "desligado" && estado !== "off") {
        if (cancelar) { cancelar(); cancelar = null; }
        imgDe(btn).src = IMG.off;
        btn.classList.remove("ligado", "ligando");
        estado = "off";
      }
      if (msg === "erro") {
        if (cancelar) { cancelar(); cancelar = null; }
        imgDe(btn).src = IMG.off;
        btn.classList.remove("ligado", "ligando");
        btn.classList.add("button-erro");
        setTimeout(function() { btn.classList.remove("button-erro"); }, 2000);
        estado = "off";
      }
    });

    btn.addEventListener("click", function() {
      if (estado === "starting") return;
      if (estado === "off") {
        estado = "starting"; btn.classList.add("ligando");
        publicar("motor/" + idMotor + "/cmd", "ligar");
        cancelar = rodarAnimacao(btn, gerarFases(motor), function() {
          imgDe(btn).src = IMG.on;
          btn.classList.remove("ligando"); btn.classList.add("ligado");
          estado = "on"; cancelar = null;
        });
      } else {
        if (cancelar) { cancelar(); cancelar = null; }
        publicar("motor/" + idMotor + "/cmd", "desligar");
        imgDe(btn).src = IMG.off;
        btn.classList.remove("ligado", "ligando");
        estado = "off";
      }
    });
  }

  /* =============================================
     BOTÕES DE REVERSÃO
  ============================================= */
  function criarBotoesReversao(motor, idMotor, grid) {
    var wrapper = document.createElement("div");
    wrapper.className = "reversao-wrapper";
    wrapper.style.cssText = "grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:12px;";
    var btnA = criarEstruturaBotao("Sentido A", motor.nome, "Sentido A ▶");
    var btnB = criarEstruturaBotao("Sentido B", motor.nome, "◀ Sentido B");
    inicializarReversao(btnA, btnB, motor, idMotor);
    wrapper.appendChild(btnA); wrapper.appendChild(btnB);
    grid.appendChild(wrapper);
  }

  function inicializarReversao(btnA, btnB, motor, idMotor) {
    var estado = "off", cancelar = null;
    function resetar(b) {
      imgDe(b).src = IMG.off;
      b.classList.remove("ligado","ligando","reversao-bloqueado","reversao-ativo");
      b.disabled = false;
    }
    function marcarAtivo(b) {
      imgDe(b).src = IMG.on;
      b.classList.remove("ligando"); b.classList.add("ligado","reversao-ativo");
      b.disabled = false;
    }
    function marcarBloqueado(b) {
      imgDe(b).src = IMG.off;
      b.classList.remove("ligando","ligado","reversao-ativo"); b.classList.add("reversao-bloqueado");
      b.disabled = false;
    }
    function parar() {
      if (cancelar) { cancelar(); cancelar = null; }
      estado = "off"; resetar(btnA); resetar(btnB);
    }
    function ligar(bAtivo, bPass, cmd, novoEst) {
      if (cancelar) { cancelar(); cancelar = null; }
      resetar(btnA); resetar(btnB);
      estado = "starting"; btnA.disabled = true; btnB.disabled = true;
      bAtivo.classList.add("ligando");
      publicar("motor/" + idMotor + "/cmd", cmd);
      cancelar = rodarAnimacao(bAtivo, gerarFases(motor), function() {
        cancelar = null; marcarAtivo(bAtivo); marcarBloqueado(bPass); estado = novoEst;
      });
    }
    onEstadoMotor(idMotor, function(msg) {
      if (msg === "ligado_A" && estado === "starting") { if (cancelar) { cancelar(); cancelar = null; } marcarAtivo(btnA); marcarBloqueado(btnB); estado = "on_A"; }
      if (msg === "ligado_B" && estado === "starting") { if (cancelar) { cancelar(); cancelar = null; } marcarAtivo(btnB); marcarBloqueado(btnA); estado = "on_B"; }
      if (msg === "desligado") { parar(); }
      if (msg === "erro") {
        parar();
        [btnA, btnB].forEach(function(b) {
          b.classList.add("button-erro");
          setTimeout(function() { b.classList.remove("button-erro"); }, 2000);
        });
      }
    });
    btnA.addEventListener("click", function() {
      if (estado === "starting") return;
      if (estado === "off")  { ligar(btnA, btnB, "ligar_A", "on_A"); return; }
      if (estado === "on_A") { publicar("motor/" + idMotor + "/cmd", "desligar"); parar(); return; }
      if (estado === "on_B") { ligar(btnA, btnB, "ligar_A", "on_A"); }
    });
    btnB.addEventListener("click", function() {
      if (estado === "starting") return;
      if (estado === "off")  { ligar(btnB, btnA, "ligar_B", "on_B"); return; }
      if (estado === "on_B") { publicar("motor/" + idMotor + "/cmd", "desligar"); parar(); return; }
      if (estado === "on_A") { ligar(btnB, btnA, "ligar_B", "on_B"); }
    });
  }

  /* =============================================
     EXCLUIR MOTOR
  ============================================= */
  window.excluirMotor = function(index) {
    var motores = getMotores();
    var nome = motores[index] ? motores[index].nome : "motor";
    if (!confirm("Remover \"" + nome + "\"?")) return;
    /* Desliga relé no ESP32 antes de remover */
    enviarConfigMotorESP(index, null, false);
    excluirMotorAPI(index, function() {
      renderizarMotores();
    });
  };

  /* =============================================
     FORMULÁRIO — definir_motor.html
  ============================================= */
  window.adicionarMotor = function() {
    var campos = {
      nome:  document.getElementById("nome"),
      tipo:  document.getElementById("tipo"),
      tempo: document.getElementById("tempo"),
      cMax:  document.getElementById("corrente-max"),
      cNom:  document.getElementById("corrente-nom"),
      pinoA: document.getElementById("pino-a"),
      pinoB: document.getElementById("pino-b")
    };

    var nome  = campos.nome  ? campos.nome.value.trim()       : "";
    var tipo  = campos.tipo  ? campos.tipo.value              : "";
    var tempo = campos.tempo ? parseFloat(campos.tempo.value) : NaN;
    var cMax  = campos.cMax  ? parseFloat(campos.cMax.value)  : NaN;
    var cNom  = campos.cNom  ? parseFloat(campos.cNom.value)  : NaN;
    var pinoA = campos.pinoA ? parseInt(campos.pinoA.value, 10)  : -1;
    var pinoB = campos.pinoB && tipo === "Direta com reversão"
                ? parseInt(campos.pinoB.value, 10) : -1;

    if (!nome || !tipo || isNaN(tempo) || isNaN(cMax) || isNaN(cNom)) {
      mostrarToast("Preencha todos os campos antes de continuar.", "erro"); return;
    }
    if (tempo <= 0 || cMax <= 0 || cNom <= 0) {
      mostrarToast("Os valores numéricos devem ser maiores que zero.", "erro"); return;
    }
    if (cNom > cMax) {
      mostrarToast("Corrente nominal não pode ser maior que a máxima.", "erro"); return;
    }
    if (pinoA < 0) {
      mostrarToast("Selecione o pino GPIO do relé principal.", "erro"); return;
    }
    if (tipo === "Direta com reversão" && (pinoB < 0 || pinoB === pinoA)) {
      mostrarToast("Selecione um pino diferente para o relé de reversão.", "erro"); return;
    }

    var novoMotor = {
      nome: nome, tipo: tipo, tempo: tempo,
      correnteMaxima: cMax, correnteNominal: cNom,
      pinoA: pinoA, pinoB: pinoB
    };

    /* Envia ao servidor via API REST */
    adicionarMotorAPI(novoMotor, function(idMotor) {
      /* Envia configuração ao ESP32 via MQTT */
      var enviado = enviarConfigMotorESP(idMotor, novoMotor, true);
      var aviso   = enviado ? "" : " (ESP32 offline — será enviado ao reconectar)";
      mostrarToast("Motor \"" + nome + "\" adicionado!" + aviso, "sucesso");
      limparForm();
    });
  };

  window.limparForm = function() {
    ["nome","tipo","tempo","corrente-max","corrente-nom"].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = "";
    });
    /* Reseta selects de pinos */
    ["pino-a","pino-b"].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    var campoB = document.getElementById("campo-rele-b");
    if (campoB) campoB.style.display = "none";
    var preview = document.getElementById("pino-preview");
    if (preview) preview.style.display = "none";
    var primeiro = document.getElementById("nome");
    if (primeiro) primeiro.focus();
  };

  function mostrarToast(msg, tipo) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = "toast " + tipo;
    toast.style.display = "block";
    void toast.offsetWidth;
    clearTimeout(toast._hide);
    toast._hide = setTimeout(function() { toast.style.display = "none"; }, 3500);
  }

  /* =============================================
     INIT
  ============================================= */
  document.addEventListener("DOMContentLoaded", function() {
    /* Carrega motores do servidor antes de renderizar */
    carregarMotores(function() {
      renderizarMotores();
      popularSeletor();

      if (typeof Chart !== "undefined") {
        iniciarGraficos();
      }

      iniciarMQTT();

      /* Mostra aviso offline inicialmente na página de cadastro */
      mostrarAvisoEspOffline();
    });
  });

})();
