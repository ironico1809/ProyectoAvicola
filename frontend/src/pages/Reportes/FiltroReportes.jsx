import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Filter,
  RefreshCw,
  Calendar,
  Database,
  Package,
  FileText,
  List,
  Clock,
  Target,
  TrendingUp,
  AlertTriangle,
  Home,
  Thermometer,
  Mic,
  MicOff,
  ShoppingCart,
  Users,
  Clipboard,
  User,
  Zap,
  Send,
  Activity,
} from "lucide-react";

function iso(d) {
  return d.toISOString().split("T")[0];
}

const PRESETS = [
  {
    id: "inventario",
    name: "Reporte de Inventario",
    desc: "Stock y consumo de materiales",
    icon: <Package size={22} color="#166534" />,
    bg: "#dcfce7",
    entidad: "insumos",
    agrupar: "",
  },
  {
    id: "mortandad",
    name: "Reporte de Mortandad",
    desc: "Bajas y causas registradas",
    icon: <AlertTriangle size={22} color="#dc2626" />,
    bg: "#fef2f2",
    entidad: "mortalidad",
    agrupar: "lote",
  },
  {
    id: "temperatura",
    name: "Reporte de Temperatura",
    desc: "Historial y alertas por galpón",
    icon: <Thermometer size={22} color="#2563eb" />,
    bg: "#eff6ff",
    entidad: "temperatura",
    agrupar: "galpon",
  },
  {
    id: "produccion",
    name: "Reporte de Producción",
    desc: "Rendimiento por lotes activos",
    icon: <Activity size={22} color="#7c3aed" />,
    bg: "#f5f3ff",
    entidad: "lotes",
    agrupar: "estado",
  },
  {
    id: "alimentacion",
    name: "Reporte de Alimentación",
    desc: "Consumo y FCA por galpón",
    icon: <Target size={22} color="#b45309" />,
    bg: "#fffbeb",
    entidad: "alimentacion",
    agrupar: "galpon",
  },
  {
    id: "bitacora",
    name: "Reporte de Bitácora",
    desc: "Historial de actividades",
    icon: <Clipboard size={22} color="#475569" />,
    bg: "#f1f5f9",
    entidad: "bitacora",
    agrupar: "dia",
  },
  {
    id: "personal",
    name: "Reporte de Personal",
    desc: "Empleados y roles activos",
    icon: <User size={22} color="#0d9488" />,
    bg: "#f0fdfa",
    entidad: "usuarios",
    agrupar: "",
  },
  {
    id: "sanitario",
    name: "Reporte Sanitario",
    desc: "Vacunas y control sanitario",
    icon: <Activity size={22} color="#0f766e" />,
    bg: "#f0fdfa",
    entidad: "sanitario",
    agrupar: "dia",
  },
];

function FiltroReportes({
  entidad,
  setEntidad,
  agruparPor,
  setAgruparPor,
  fechaInicio,
  setFechaInicio,
  fechaFin,
  setFechaFin,
  galpones,
  galponIds,
  setGalponIds,
  lotes,
  loteIds,
  setLoteIds,
  rows,
  loading,
  onGenerar,
  onLimpiar,
  onDescargarExcel,
  onDescargarPDF,
}) {
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceUnavailableReason, setVoiceUnavailableReason] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [commandText, setCommandText] = useState("");
  const [galponExpanded, setGalponExpanded] = useState(false);
  const [loteExpanded, setLoteExpanded] = useState(false);
  const recognitionRef = useRef(null);
  const voiceFinalRef = useRef("");
  const lastAppliedRef = useRef("");
  const shouldListenRef = useRef(false);
  const restartTimeRef = useRef(null);
  const latestTranscriptRef = useRef("");

  const normalize = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const applyVoiceCommand = (rawText, triggerGenerate = false) => {
    const text = normalize(rawText);
    if (!text) return;

    // Presets por palabras clave
    if (text.includes("inventario") || text.includes("insumos"))
      setEntidad("insumos");
    if (
      text.includes("mortalidad") ||
      text.includes("mortandad") ||
      text.includes("bajas") ||
      text.includes("muertes")
    )
      setEntidad("mortalidad");
    if (text.includes("alimentacion") || text.includes("comida"))
      setEntidad("alimentacion");
    if (text.includes("produccion") || text.includes("lotes"))
      setEntidad("lotes");
    if (
      text.includes("bitacora") ||
      text.includes("auditoria") ||
      text.includes("eventos")
    )
      setEntidad("bitacora");
    if (
      text.includes("personal") ||
      text.includes("usuarios") ||
      text.includes("empleados")
    )
      setEntidad("usuarios");
    if (
      text.includes("temperatura") ||
      text.includes("termometro") ||
      text.includes("calor") ||
      text.includes("frio") ||
      text.includes("clima")
    )
      setEntidad("temperatura");
    if (
      text.includes("sanitario") ||
      text.includes("vacuna") ||
      text.includes("vacunas") ||
      text.includes("salud")
    )
      setEntidad("sanitario");

    // Agrupación
    if (text.includes("sin agrupar") || text.includes("detalle"))
      setAgruparPor("");
    if (text.includes("por dia") || text.includes("diario"))
      setAgruparPor("dia");
    if (text.includes("por mes") || text.includes("mensual"))
      setAgruparPor("mes");
    if (text.includes("por galpon")) setAgruparPor("galpon");
    if (text.includes("por lote")) setAgruparPor("lote");
    if (text.includes("por etapa") || text.includes("por estado"))
      setAgruparPor("estado");

    // Fechas
    if (text.includes("hoy")) {
      const hoy = iso(new Date());
      setFechaInicio(hoy);
      setFechaFin(hoy);
    }
    if (text.includes("ayer")) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const ay = iso(d);
      setFechaInicio(ay);
      setFechaFin(ay);
    }
    if (text.includes("este mes")) {
      const hoy = new Date();
      setFechaInicio(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
      setFechaFin(iso(hoy));
    }

    // Generar automáticamente si se pide o tiene palabras de generación activa
    if (
      triggerGenerate ||
      text.includes("generar") ||
      text.includes("crear") ||
      text.includes("haz")
    ) {
      setTimeout(() => onGenerar?.(), 300);
    }
  };

  const initRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = "es-ES";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = (event) => {
      let finalText = voiceFinalRef.current;
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const t = res?.[0]?.transcript || "";
        if (!t) continue;
        if (res.isFinal) finalText = `${finalText} ${t}`.trim();
        else interimText = `${interimText} ${t}`.trim();
      }
      voiceFinalRef.current = finalText;
      const liveText =
        `${finalText}${interimText ? ` ${interimText}` : ""}`.trim();
      latestTranscriptRef.current = liveText;
      setVoiceText(liveText);
      // Mientras dictas, escribe en el input principal.
      if (shouldListenRef.current) setCommandText(liveText);
      setVoiceError("");
      const normalizedFinal = normalize(finalText);
      if (normalizedFinal && normalizedFinal !== lastAppliedRef.current) {
        lastAppliedRef.current = normalizedFinal;
        applyVoiceCommand(finalText, false); // No auto-generate while dictating
      }
    };

    rec.onerror = (event) => {
      const code = String(event?.error || "");
      if (code === "aborted") return;
      setListening(false);
      shouldListenRef.current = false;
      if (code === "network") {
        setVoiceError("Error de red. Revisa tu conexión.");
      } else if (code === "not-allowed") {
        setVoiceError("Permiso de micrófono denegado.");
      } else if (code !== "no-speech") {
        setVoiceError(`Error: ${code}`);
      }
    };

    rec.onend = () => {
      setListening(false);
      if (!shouldListenRef.current) return;
      if (restartTimeRef.current) clearTimeout(restartTimeRef.current);
      restartTimeRef.current = setTimeout(() => {
        if (!shouldListenRef.current) return;
        try {
          const newRec = initRecognition();
          if (newRec) {
            recognitionRef.current = newRec;
            setListening(true);
            newRec.start();
          }
        } catch (e) {
          setListening(false);
          shouldListenRef.current = false;
        }
      }, 400);
    };
    return rec;
  };

  const manualStopVoice = () => {
    shouldListenRef.current = false;
    if (restartTimeRef.current) clearTimeout(restartTimeRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setListening(false);
    
    // Al hacer clic en Detener, aplicamos y procesamos inmediatamente el texto dictado
    setTimeout(() => {
      const latestText = latestTranscriptRef.current || commandText;
      applyCommandFromText(latestText);
    }, 150);
  };

  const manualStartVoice = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    const rec = initRecognition();
    if (!rec) {
      setVoiceError("Voz no disponible.");
      return;
    }
    voiceFinalRef.current = "";
    latestTranscriptRef.current = "";
    lastAppliedRef.current = "";
    shouldListenRef.current = true;
    setCommandText("");
    setVoiceText("");
    setVoiceError("");
    setListening(true);
    recognitionRef.current = rec;
    rec.start();
  };

  const applyCommandFromText = (forcedText) => {
    const raw = String(
      forcedText && typeof forcedText === "string" ? forcedText : commandText || ""
    ).trim();
    if (!raw) return;
    setVoiceError("");
    setVoiceText(raw);
    applyVoiceCommand(raw, true); // Forzar generación
  };

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSecure =
      window.isSecureContext || window.location?.hostname === "localhost";
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      setVoiceUnavailableReason("Usa Chrome o Edge para dictado por voz.");
    } else if (!isSecure) {
      setVoiceSupported(false);
      setVoiceUnavailableReason("Requiere HTTPS o localhost.");
    } else {
      setVoiceSupported(true);
    }
    return () => {
      shouldListenRef.current = false;
      if (restartTimeRef.current) clearTimeout(restartTimeRef.current);
      if (recognitionRef.current)
        try {
          recognitionRef.current.abort();
        } catch {}
    };
  }, []);

  const galponesOpts = useMemo(() => {
    return (Array.isArray(galpones) ? galpones : [])
      .map((g) => ({
        value: String(g.id || g.id_galpon),
        label: g.nombre,
      }))
      .filter((o) => o.value && o.label);
  }, [galpones]);

  const lotesOptions = useMemo(() => {
    return (Array.isArray(lotes) ? lotes : [])
      .map((l) => ({
        value: String(l.id_lote),
        label: `Lote ${l.id_lote}`,
      }))
      .filter((o) => o.value);
  }, [lotes]);

  const onMultiSelectChange = (event, setter) => {
    const selected = Array.from(event.target.selectedOptions).map(
      (o) => o.value,
    );
    setter(selected);
  };

  const opcionesAgrupar = useMemo(() => {
    const base = [
      { value: "", label: "Sin agrupar (Detalle)" },
      { value: "dia", label: "Por Día" },
      { value: "mes", label: "Por Mes" },
    ];
    if (
      entidad === "alimentacion" ||
      entidad === "lotes" ||
      entidad === "mortalidad" ||
      entidad === "temperatura"
    ) {
      base.push({ value: "galpon", label: "Por Galpón" });
    }
    if (entidad === "alimentacion" || entidad === "mortalidad")
      base.push({ value: "lote", label: "Por Lote" });
    if (entidad === "lotes") base.push({ value: "estado", label: "Por Etapa" });
    if (entidad === "temperatura")
      base.push({ value: "estado", label: "Por Estado (Frío/Normal/Calor)" });
    return base;
  }, [entidad]);

  const galponSelectSize = useMemo(() => {
    const count = galponesOpts.length || 0;
    if (galponExpanded) return Math.min(10, Math.max(6, count || 6));
    return Math.min(4, Math.max(3, count || 3));
  }, [galponExpanded, galponesOpts.length]);

  const loteSelectSize = useMemo(() => {
    const count = lotesOptions.length || 0;
    if (loteExpanded) return Math.min(10, Math.max(6, count || 6));
    return Math.min(4, Math.max(3, count || 3));
  }, [loteExpanded, lotesOptions.length]);

  return (
    <div className="rep-container">
      {/* ACCIONES IA (BOTONES DE VOZ) */}
      <div className="rep-header-actions" style={{ justifyContent: 'flex-end', marginBottom: '8px' }}>
        {voiceSupported ? (
          listening ? (
            <button className="rep-btn-stop" onClick={manualStopVoice}>
              <MicOff size={18} /> Detener
            </button>
          ) : (
            <button className="rep-btn-ia" onClick={manualStartVoice}>
              <Mic size={18} /> Comando por Voz
            </button>
          )
        ) : (
          <button className="rep-btn-disabled" title={voiceUnavailableReason} disabled>
            <MicOff size={18} /> Voz no disponible
          </button>
        )}
      </div>

      {/* COMANDO MANUAL */}

      <div className="rep-manual-card">
        <div className="rep-manual-header">
          <FileText size={18} className="text-indigo-600" />
          <div>
            <h3>Comando Manual</h3>
            <p>Escribe tu comando directamente</p>
          </div>
        </div>
        <div className="rep-manual-body">
          <div className="rep-input-group">
            <input
              className="rep-manual-input"
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyCommandFromText()}
              placeholder='Ej: "Reporte de mortalidad de este mes por lote"'
            />
            <button className="rep-btn-send" onClick={applyCommandFromText}>
              <Send size={18} /> Ejecutar
            </button>
          </div>
          {listening && (
            <div className="rep-listening-status">
              <Mic size={20} className="animate-pulse text-yellow-600" />
              <div>
                <p className="font-semibold text-yellow-800">
                  Escuchando tu comando...
                </p>
                <p className="text-xs text-yellow-600">
                  Habla claramente mencionando el tipo de reporte
                </p>
              </div>
            </div>
          )}
          {voiceText && (
            <p className="rep-voice-feedback">Transcripción: "{voiceText}"</p>
          )}
          {voiceError && <p className="rep-voice-error">{voiceError}</p>}
        </div>
      </div>

      {/* GENERACIÓN RÁPIDA */}
      <div className="rep-quick-section">
        <div className="rep-section-header">
          <Download size={18} className="text-green-600" />
          <div>
            <h3>Generación de Reportes</h3>
            <p>Acceso rápido a los reportes más comunes</p>
          </div>
        </div>
        <div className="rep-quick-grid">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="rep-quick-btn"
              onClick={() => {
                setEntidad(p.entidad);
                setAgruparPor(p.agrupar);
                setTimeout(onGenerar, 100);
              }}
            >
              <div className="rep-quick-btn-icon" style={{ background: p.bg }}>
                {p.icon}
              </div>
              <div className="rep-quick-btn-text">
                <span className="font-bold text-gray-900">{p.name}</span>
                <span className="text-xs text-gray-500">{p.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* FILTROS MANUALES (Opcionales / Colapsables si se desea, pero los dejamos accesibles) */}
      <div className="rep-filters-manual">
        <div className="rep-filters-header">
          <Filter size={18} />
          <h3>Ajustes de Reporte</h3>
        </div>
        <div className="rep-filters-grid">
          <div className="rep-filter-item">
            <label>Fuente de Datos</label>
            <select
              value={entidad}
              onChange={(e) => setEntidad(e.target.value)}
            >
              <option value="alimentacion">Alimentación</option>
              <option value="lotes">Producción (Lotes)</option>
              <option value="insumos">Inventario</option>
              <option value="mortalidad">Mortalidad</option>
              <option value="temperatura">Temperatura</option>
              <option value="bitacora">Bitácora</option>
              <option value="usuarios">Personal</option>
              <option value="sanitario">Sanitario</option>
            </select>
          </div>
          <div className="rep-filter-item">
            <label>Agrupar por</label>
            <select
              value={agruparPor}
              onChange={(e) => setAgruparPor(e.target.value)}
            >
              {opcionesAgrupar.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rep-filter-item">
            <label>Desde</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="rep-filter-item">
            <label>Hasta</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
          <div className="rep-filter-item">
            <div className="rep-filter-labelRow">
              <label
                style={{
                  margin: 0,
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <Home size={14} /> Galpón
              </label>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="rep-link"
                  onClick={() => setGalponExpanded((v) => !v)}
                  disabled={loading}
                  title={galponExpanded ? "Ver compacto" : "Ver más opciones"}
                >
                  {galponExpanded ? "Contraer" : "Expandir"}
                </button>
                <button
                  type="button"
                  className="rep-link"
                  onClick={() => setGalponIds([])}
                  disabled={loading}
                  title="Quita filtros (todos los galpones)"
                >
                  Todos
                </button>
              </div>
            </div>
            <select
              multiple
              value={(Array.isArray(galponIds) ? galponIds : []).map(String)}
              onChange={(e) =>
                onMultiSelectChange(e, (vals) =>
                  setGalponIds(
                    vals.map(Number).filter((n) => Number.isFinite(n)),
                  ),
                )
              }
              size={galponSelectSize}
            >
              {galponesOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="rep-filter-hint">
              Ctrl/Shift para seleccionar varios.
            </div>
          </div>

          <div className="rep-filter-item">
            <div className="rep-filter-labelRow">
              <label
                style={{
                  margin: 0,
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <Package size={14} /> Lote
              </label>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="rep-link"
                  onClick={() => setLoteExpanded((v) => !v)}
                  disabled={loading}
                  title={loteExpanded ? "Ver compacto" : "Ver más opciones"}
                >
                  {loteExpanded ? "Contraer" : "Expandir"}
                </button>
                <button
                  type="button"
                  className="rep-link"
                  onClick={() => setLoteIds([])}
                  disabled={loading}
                  title="Quita filtros (todos los lotes)"
                >
                  Todos
                </button>
              </div>
            </div>
            <select
              multiple
              value={(Array.isArray(loteIds) ? loteIds : []).map(String)}
              onChange={(e) =>
                onMultiSelectChange(e, (vals) => setLoteIds(vals))
              }
              size={loteSelectSize}
            >
              {lotesOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="rep-filter-hint">Vacío = todos los lotes.</div>
          </div>
        </div>

        <div className="rep-filters-footer">
          <button
            className="rep-btn-clear"
            onClick={onLimpiar}
            disabled={loading}
          >
            <RefreshCw size={14} /> Resetear
          </button>
          <div className="rep-export-group">
            <button
              className="rep-btn-export"
              onClick={onDescargarExcel}
              disabled={loading || !rows?.length}
            >
              <FileText size={14} /> Excel
            </button>
            <button
              className="rep-btn-export"
              onClick={onDescargarPDF}
              disabled={loading || !rows?.length}
            >
              <FileText size={14} /> PDF
            </button>
          </div>
          <button
            className="rep-btn-generate"
            onClick={onGenerar}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : (
              <Filter size={16} />
            )}
            {loading ? "Generando..." : "Generar Reporte"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FiltroReportes;
