import React, { useState, useRef, useEffect } from "react";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/* =========================
   Draggable & Resizable Box
========================= */
function DraggableResizableBox({
  x, y, width, height, onUpdate, children,
  disabled, hideBorder
}) {
  const [drag, setDrag] = useState(false);
  const [resize, setResize] = useState(false);
  const start = useRef({});

  const enabled = !disabled && !hideBorder;

  useEffect(() => {
    const move = e => {
      if (!enabled) return;
      const dx = e.clientX - start.current.mx;
      const dy = e.clientY - start.current.my;

      if (drag) {
        onUpdate({
          ...start.current.box,
          x: start.current.box.x + dx,
          y: start.current.box.y + dy
        });
      }
      if (resize) {
        onUpdate({
          ...start.current.box,
          width: Math.max(100, start.current.box.width + dx),
          height: Math.max(100, start.current.box.height + dy)
        });
      }
    };

    const stop = () => {
      setDrag(false);
      setResize(false);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
  }, [drag, resize, enabled, onUpdate]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        border: hideBorder ? "none" : "2px dashed #999",
        cursor: enabled ? "move" : "default",
        zIndex: 10
      }}
      onMouseDown={e => {
        if (!enabled) return;
        if (e.target.classList.contains("resize")) return;
        setDrag(true);
        start.current = {
          mx: e.clientX,
          my: e.clientY,
          box: { x, y, width, height }
        };
      }}
    >
      {children}

      {enabled && (
        <div
          className="resize"
          onMouseDown={e => {
            e.stopPropagation();
            setResize(true);
            start.current = {
              mx: e.clientX,
              my: e.clientY,
              box: { x, y, width, height }
            };
          }}
          style={{
            position: "absolute",
            right: -6,
            bottom: -6,
            width: 14,
            height: 14,
            background: "#2563eb",
            borderRadius: "50%",
            cursor: "nwse-resize"
          }}
        />
      )}
    </div>
  );
}

/* =========================
        MAIN APP
========================= */
export default function A4ComposerPRO() {

  const [template, setTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("Επιλέξτε template...");
  const [contentName, setContentName] = useState("PDF ή εικόνα...");
  const [contentImage, setContentImage] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [box, setBox] = useState({
    x: 60,
    y: 60,
    width: 670,
    height: 1000
  });

  /* =========================
       Load external libs
  ========================= */
  useEffect(() => {
    const libs = [
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    ];
    libs.forEach(src => {
      const s = document.createElement("script");
      s.src = src;
      document.body.appendChild(s);
    });
  }, []);

  /* =========================
         FILE HANDLERS
  ========================= */
  const loadTemplate = file => {
    if (!file?.type.startsWith("image/")) return;
    setTemplateName(file.name);
    const r = new FileReader();
    r.onload = () => setTemplate(r.result);
    r.readAsDataURL(file);
  };

  const loadContent = async file => {
    if (!file) return;
    setContentName(file.name);

    /* IMAGE */
    if (file.type.startsWith("image/")) {
      const r = new FileReader();
      r.onload = () => setContentImage(r.result);
      r.readAsDataURL(file);
      return;
    }

    /* PDF */
    if (file.type === "application/pdf") {
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
      setContentImage(canvas.toDataURL("image/png"));
      return;
    }

    alert("Υποστηρίζονται μόνο PDF ή εικόνες.");
  };

  /* =========================
            PDF EXPORT
  ========================= */
  const exportPDF = async preview => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 200));

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const el = document.querySelector(".a4");
    const canvas = await window.html2canvas(el, { scale: 2 });
    pdf.addImage(canvas, "JPEG", 0, 0, 210, 297);

    setExporting(false);

    preview
      ? window.open(URL.createObjectURL(pdf.output("blob")))
      : pdf.save("document.pdf");
  };

  /* =========================
              UI
  ========================= */
  return (
    <div
      className="p-4 bg-gray-100 min-h-screen"
      onDragOver={e => {
        e.preventDefault();
        setDragging(true);
      }}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (!f) return;
        if (f.type.startsWith("image/")) loadTemplate(f);
        else loadContent(f);
      }}
      onDragLeave={() => setDragging(false)}
    >
      {dragging && (
        <div className="fixed inset-0 bg-blue-500/20 border-4 border-dashed border-blue-600 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl font-bold">
            Ρίξτε PDF ή εικόνα εδώ
          </div>
        </div>
      )}

      <header className="bg-white p-4 rounded-xl shadow flex justify-between mb-4">
        <h1 className="font-black">A4 COMPOSER – PRO MODE</h1>
        <div className="flex gap-2">
          <button onClick={() => location.reload()} className="px-3 py-2 bg-red-100 rounded">
            Reset
          </button>
          <button onClick={() => exportPDF(true)} className="px-3 py-2 bg-gray-800 text-white rounded">
            Preview
          </button>
          <button onClick={() => exportPDF(false)} className="px-3 py-2 bg-blue-600 text-white rounded">
            Download
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <label className="border-2 border-dashed p-3 rounded cursor-pointer">
          🖼️ {templateName}
          <input hidden type="file" accept="image/*" onChange={e => loadTemplate(e.target.files[0])} />
        </label>

        <label className="border-2 border-dashed p-3 rounded cursor-pointer">
          📄 {contentName}
          <input hidden type="file" accept="application/pdf,image/*" onChange={e => loadContent(e.target.files[0])} />
        </label>
      </div>

      <div className="flex justify-center">
        <div className="a4 relative bg-white shadow-2xl" style={{ width: A4_WIDTH, height: A4_HEIGHT }}>
          {template && (
            <img src={template} className="absolute inset-0 w-full h-full object-cover" alt="" />
          )}

          <DraggableResizableBox {...box} onUpdate={setBox} hideBorder={exporting}>
            {contentImage && (
              <img src={contentImage} className="w-full h-full object-contain" alt="" />
            )}
          </DraggableResizableBox>
        </div>
      </div>
    </div>
  );
}
