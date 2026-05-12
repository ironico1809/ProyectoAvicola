import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const generarPDFMortandad = (lote, kpiData, causasAgrupadas, historial, chartImage) => {
  if (!kpiData) return;

  // Tamaño celular alargado (108mm x 250mm) para que entre el gráfico
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [108, 250]
  });

  // --- ENCABEZADO ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(28, 28, 28);
  doc.text("Reporte de Mortandad", 10, 16);

  doc.setFontSize(12);
  doc.setTextColor(107, 114, 128);
  doc.text(`Análisis del Lote ${lote}`, 10, 23);

  // --- LÍNEA SEPARADORA ---
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(10, 28, 98, 28);

  // --- DATOS KPI ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(28, 28, 28);
  doc.text(`Población Inicial: ${kpiData.inicial} aves`, 10, 36);
  doc.text(`Población Actual: ${kpiData.actual} aves`, 10, 42);
  doc.text(`Total Bajas: ${kpiData.bajas} aves`, 10, 48);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  if (kpiData.porcentaje > 5) {
    doc.setTextColor(220, 38, 38);
  } else {
    doc.setTextColor(5, 150, 105);
  }
  doc.text(`Tasa de Mortalidad: ${kpiData.porcentaje}%`, 10, 56);

  let currentY = 66;

  // --- GRÁFICO (Si el usuario lo analizó antes de exportar) ---
  if (chartImage) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(28, 28, 28);
    doc.text("Tendencia de Bajas:", 10, currentY);
    
    // Dibujamos la imagen capturada
    doc.addImage(chartImage, 'PNG', 10, currentY + 3, 88, 45);
    currentY += 55;
  }

  // --- TABLA DE CAUSAS ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(28, 28, 28);
  doc.text("Distribución por Causas:", 10, currentY);
  
  const causasBody = Object.keys(causasAgrupadas).map(causa => [
    causa, 
    `${causasAgrupadas[causa]} aves`
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Causa Identificada', 'Cantidad']],
    body: causasBody.length ? causasBody : [['Sin registros', '-']],
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 10, right: 10 }
  });

  // --- TABLA DE HISTORIAL DETALLADO ---
  currentY = doc.lastAutoTable.finalY + 12;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Registro Detallado (Historial):", 10, currentY);

  const formatFecha = (fechaString) => {
    if (!fechaString) return "-";
    const f = new Date(fechaString);
    return `${f.toLocaleDateString()} ${f.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  const historialBody = historial.map(r => [
    formatFecha(r.fecha_hora),
    `-${r.cantidad}`,
    r.causa || "Sin causa"
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Fecha y Hora', 'Bajas', 'Causa']],
    body: historialBody.length ? historialBody : [['-', '-', '-']],
    theme: 'plain',
    headStyles: { fillColor: [243, 244, 246], textColor: [75, 85, 99] },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 15, textColor: [220, 38, 38], fontStyle: 'bold' },
      2: { cellWidth: 'auto' }
    },
    margin: { left: 10, right: 10 }
  });

  // --- PIE DE PÁGINA ---
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Generado por Sistema AviGranja - Página ${i} de ${pageCount}`, 
      10, 
      doc.internal.pageSize.getHeight() - 5
    );
  }

  doc.save(`Reporte_Mortandad_Lote_${lote}.pdf`);
};