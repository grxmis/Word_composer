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
        onUpdate({ ...start.current.box, x: start.current.box.x + dx, y: start.current.box.y + dy });
      }
      if (resize) {
        onUpdate({ 
          ...start.current.box, 
          width: Math.max(50, start.current.box.width + dx), 
          height: Math.max(50, start.current.box.height + dy) 
        });
      }
    };
    const stop = () => { setDrag(false); setResize(false); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", stop); };
  }, [drag, resize, enabled, onUpdate]);

  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width, height,
        border: hideBorder ? "none" : "2px dashed #2563eb",
        cursor: enabled ? "move" : "default", zIndex: 10, touchAction: "none"
      }}
      onMouseDown={e => {
        if (!enabled || e.target.classList.contains("resize")) return;
        setDrag(true);
        start.current = { mx: e.clientX, my: e.clientY, box: { x, y, width, height } };
      }}
    >
      {children}
      {enabled && (
        <div className="resize"
          onMouseDown={e => { e.stopPropagation(); setResize(true); start.current = { mx: e.clientX, my: e.clientY, box: { x, y, width, height } }; }}
          style={{ position: "absolute", right: -6, bottom: -6, width: 14, height: 14, background: "#2563eb", borderRadius: "50%", cursor: "nwse-resize" }}
        />
      )}
    </div>
  );
}

/* =========================
        MAIN APP
========================= */
export default function A4Composer() {
  const [template, setTemplate] = useState(null);
  const [templateName, setTemplateName] = useState("Επιλέξτε φόντο...");
  const [docName, setDocName] = useState("Επιλέξτε αρχείο (PDF, DOCX, TXT)...");
  const [docHtml, setDocHtml] = useState("");
  const [pages, setPages] = useState([]);
  const [fontSize, setFontSize] = useState(16);
  const [opacity, setOpacity] = useState(1);
  const [contrast, setContrast] = useState(1.2);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  
  // Επαναφορά αρχικών περιθωρίων (x:40, y:40)
  const [box, setBox] = useState({ x: 40, y: 40, width: 714, height: 1043 });

  const measureRef = useRef(null);

  useEffect(() => {
    const libs = [
      "mammoth/1.6.0/mammoth.browser.min.js", 
      "html2canvas/1.4.1/html2canvas.min.js", 
      "jspdf/2.5.1/jspdf.umd.min.js", 
      "pdf.js/3.11.174/pdf.min.js"
    ];
    libs.forEach(src => {
      if (!document.querySelector(`script[src*="${src}"]`)) {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/" + src;
        document.body.appendChild(s);
      }
    });
  }, []);

  const centerBox = () => {
    setBox({
      ...box,
      x: (A4_WIDTH - box.width) / 2,
      y: (A4_HEIGHT - box.height) / 2
    });
  };

  const loadTemplate = file => {
    if (!file?.type.startsWith("image/")) return;
    setTemplateName(file.name);
    const r = new FileReader();
    r.onload = () => setTemplate(r.result);
    r.readAsDataURL(file);
    if (pages.length === 0) setPages([""]);
  };

  const loadDoc = async file => {
    if (!file) return;
    setDocName(file.name);

    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let pdfPages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.5 }); 
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport: viewport }).promise;

          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let j = 0; j < data.length; j += 4) {
            if (data[j] > 235 && data[j+1] > 235 && data[j+2] > 235) data[j + 3] = 0;
          }
          context.putImageData(imageData, 0, 0);
          pdfPages.push(`<img src="${canvas.toDataURL()}" draggable="false" style="width:100%; height:auto; display:block; pointer-events:none;" />`);
        }
        setDocHtml("PDF_MODE");
        setPages(pdfPages);
        
        // Επαναφορά στο "Word-like" μέγεθος με περιθώρια
        setBox({ x: 40, y: 40, width: 714, height: 1043 });
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    if (file.name.toLowerCase().endsWith(".docx") || file.name.toLowerCase().endsWith(".txt")) {
        const isDocx = file.name.toLowerCase().endsWith(".docx");
        if (isDocx) {
            const buf = await file.arrayBuffer();
            const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
            setDocHtml(res.value);
        } else {
            const text = await file.text();
            setDocHtml(text.split("\n").map(l => `<p>${l}</p>`).join(""));
        }
        setBox({ x: 40, y: 40, width: 714, height: 1043 });
        return;
    }
  };

  useEffect(() => {
    if (!docHtml || docHtml === "PDF_MODE" || !measureRef.current) return;
    const container = measureRef.current;
    container.style.width = box.width + "px";
    container.style.fontSize = fontSize + "px";
    container.innerHTML = docHtml;
    const nodes = Array.from(container.children);
    let current = [], result = [];
    container.innerHTML = "";
    for (let n of nodes) {
      container.appendChild(n.cloneNode(true));
      if (container.scrollHeight > box.height) {
        container.innerHTML = ""; result.push(current.join(""));
        current = [n.outerHTML]; container.innerHTML = n.outerHTML;
      } else { current.push(n.outerHTML); }
    }
    if (current.length) result.push(current.join(""));
    setPages(result);
  }, [docHtml, fontSize, box.width, box.height]);

  const exportPDF = async preview => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 500));
    const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
    const els = document.querySelectorAll(".a4-page");
    for (let i = 0; i < els.length; i++) {
      const canvas = await window.html2canvas(els[i], { scale: 2 });
      if (i) pdf.addPage();
      pdf.addImage(canvas, "JPEG", 0, 0, 210, 297);
    }
    setExporting(false);
    preview ? window.open(URL.createObjectURL(pdf.output("blob"))) : pdf.save("document.pdf");
  };

  return (
    <div className="p-6 bg-slate-200 min-h-screen relative"
      onDragEnter={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes("Files")) setDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => { if (e.relatedTarget === null) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if(f.type.startsWith("image/")) loadTemplate(f); else loadDoc(f); }}
    >
      {dragging && (
        <div className="fixed inset-0 bg-blue-600/30 border-8 border-dashed border-blue-600 flex items-center justify-center z-[100] pointer-events-none backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl font-black shadow-2xl text-xl">Αφήστε το αρχείο εδώ</div>
        </div>
      )}

      <header className="max-w-5xl mx-auto bg-white p-5 rounded-2xl shadow-lg flex justify-between mb-8 border border-slate-300 text-slate-700">
        <h1 className="text-2xl font-black text-blue-600 italic">A4 COMPOSER <span className="text-slate-300 font-light">PRO</span></h1>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="px-4 py-2 text-red-500 font-bold hover:bg-red-50 rounded-lg">Reset</button>
          <button onClick={() => exportPDF(true)} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700 transition-all">Preview</button>
          <button onClick={() => exportPDF(false)} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-all">Download</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <label className="bg-white border-2 border-dashed p-6 rounded-2xl cursor-pointer hover:border-blue-400 flex flex-col items-center gap-2 text-slate-500">
          <span className="text-2xl">🖼️</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Background Image</span>
          <span className="text-xs truncate w-full text-center">{templateName}</span>
          <input hidden type="file" accept="image/*" onChange={e => loadTemplate(e.target.files[0])} />
        </label>
        
        <label className="bg-white border-2 border-dashed p-6 rounded-2xl cursor-pointer hover:border-blue-400 flex flex-col items-center gap-2 text-slate-500">
          <span className="text-2xl">📄</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Document File</span>
          <span className="text-xs truncate w-full text-center">{docName}</span>
          <input hidden type="file" accept=".docx,.txt,.pdf" onChange={e => loadDoc(e.target.files[0])} />
        </label>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col gap-4 shadow-sm">
          <div style={{ opacity: docHtml === "PDF_MODE" ? 0.3 : 1 }}>
            <label className="text-[10px] font-black uppercase text-slate-400 flex justify-between">Font Size <span>{fontSize}px</span></label>
            <input type="range" min="10" max="45" value={fontSize} onChange={e => setFontSize(+e.target.value)} disabled={docHtml === "PDF_MODE"} className="w-full accent-blue-600" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 flex justify-between">Contrast <span>{Math.round(contrast*100)}%</span></label>
            <input type="range" min="1" max="3" step="0.1" value={contrast} onChange={e => setContrast(+e.target.value)} className="w-full accent-emerald-600" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 flex justify-between">Opacity <span>{Math.round(opacity*100)}%</span></label>
            <input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={e => setOpacity(+e.target.value)} className="w-full accent-blue-600" />
          </div>
          <button onClick={centerBox} className="mt-1 py-2 bg-slate-50 hover:bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-[10px] font-black transition-all">🎯 CENTER DOCUMENT</button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-12 pb-20">
        {pages.map((html, i) => (
          <div key={i} className="a4-page relative bg-white shadow-2xl overflow-hidden" style={{ width: A4_WIDTH, height: A4_HEIGHT }}>
            {template && <img src={template} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0" alt="" />}
            
            <DraggableResizableBox {...box} onUpdate={setBox} disabled={i > 0} hideBorder={exporting}>
              <div 
                style={{ 
                  fontSize: docHtml === "PDF_MODE" ? "inherit" : fontSize, 
                  lineHeight: 1.4,
                  opacity: opacity,
                  filter: `contrast(${contrast}) brightness(${1.1 - (contrast - 1) * 0.1})`,
                  pointerEvents: "none", width: "100%", height: "100%", zIndex: 1
                }} 
                dangerouslySetInnerHTML={{ __html: html }} 
              />
            </DraggableResizableBox>
            <div className="absolute bottom-4 right-4 text-[10px] text-slate-300 font-mono tracking-widest">PAGE {i + 1}</div>
          </div>
        ))}
      </div>
      <div ref={measureRef} style={{ position: "absolute", visibility: "hidden", top: 0, left: 0 }} />
    </div>
  );
}