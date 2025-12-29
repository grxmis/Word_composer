import React, { useState, useRef, useEffect } from "react";
import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import "react-resizable/css/styles.css";

const DraggableResizableBox = ({ children, x, y, width, height, onUpdate, disabled, hideBorder }) => {
  return (
    <Draggable
      defaultPosition={{ x, y }}
      onStop={(e, data) => onUpdate({ x: data.x, y: data.y, width, height })}
      disabled={disabled}
    >
      <div style={{ position: "absolute", zIndex: 10 }}>
        <ResizableBox
          width={width}
          height={height}
          onResizeStop={(e, data) =>
            onUpdate({ x, y, width: data.size.width, height: data.size.height })
          }
          draggableOpts={{ disabled: disabled }}
          handle={!hideBorder ? <span className="custom-handle" /> : <div />}
        >
          <div
            className={`w-full h-full ${!hideBorder ? "border-2 border-dashed border-blue-400" : ""}`}
            style={{ padding: "5px", cursor: disabled ? "default" : "move" }}
          >
            {children}
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
};

const A4Composer = ({ docHtml, templateImage }) => {
  const [pages, setPages] = useState([]);
  const [fontSize, setFontSize] = useState(16);
  const [opacity, setOpacity] = useState(0.85);
  const [contrast, setContrast] = useState(1.3); // Νέο state για ένταση
  const [exporting, setExporting] = useState(false);
  const composerRef = useRef(null);

  // Αρχικοποίηση πλαισίου
  useEffect(() => {
    if (docHtml) {
      setPages([{ 
        id: "p1", 
        html: docHtml, 
        box: { x: 50, y: 50, width: 500, height: 400 } 
      }]);
    }
  }, [docHtml]);

  const updateBox = (id, newBox) => {
    setPages(pages.map(p => p.id === id ? { ...p, box: newBox } : p));
  };

  const handlePrint = () => {
    setExporting(true);
    setTimeout(() => {
      window.print();
      setExporting(false);
    }, 500);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-4 bg-slate-100 min-h-screen font-sans">
      
      {/* SIDEBAR CONTROLS */}
      <div className="lg:w-80 space-y-6 no-print">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-5">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Ρυθμίσεις Εγγράφου</h3>
          
          {/* FONT SIZE - Απενεργοποιημένο αν είναι PDF */}
          <div style={{ opacity: docHtml === "PDF_MODE" ? 0.3 : 1 }}>
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
              <span>Μέγεθος Γραμματοσειράς</span>
              <span>{fontSize}px</span>
            </div>
            <input 
              type="range" min="10" max="45" value={fontSize} 
              onChange={e => setFontSize(+e.target.value)} 
              disabled={docHtml === "PDF_MODE"}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
            />
          </div>

          {/* CONTRAST - Για πιο έντονα γράμματα */}
          <div>
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
              <span>Ένταση Γραμμάτων (Contrast)</span>
              <span>{Math.round(contrast * 100)}%</span>
            </div>
            <input 
              type="range" min="1" max="3" step="0.1" value={contrast} 
              onChange={e => setContrast(+e.target.value)} 
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600" 
            />
          </div>

          {/* OPACITY */}
          <div>
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
              <span>Διαφάνεια (Opacity)</span>
              <span>{Math.round(opacity * 100)}%</span>
            </div>
            <input 
              type="range" min="0.1" max="1" step="0.05" value={opacity} 
              onChange={e => setOpacity(+e.target.value)} 
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
            />
          </div>

          <button 
            onClick={handlePrint}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-black transition-colors shadow-lg"
          >
            Εξαγωγή σε PDF / Εκτύπωση
          </button>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-[11px] text-blue-700 leading-relaxed">
            <strong>Tip:</strong> Στο PDF το μέγεθος αλλάζει σέρνοντας την κάτω δεξιά γωνία του μπλε πλαισίου.
          </p>
        </div>
      </div>

      {/* A4 CANVAS */}
      <div className="flex-1 flex justify-center overflow-auto py-4 px-2">
        <div 
          ref={composerRef}
          className="bg-white shadow-2xl relative overflow-hidden"
          style={{ 
            width: "210mm", 
            height: "297mm", 
            minWidth: "210mm",
            printColorAdjust: "exact"
          }}
        >
          {/* BACKGROUND TEMPLATE */}
          {templateImage && (
            <img 
              src={templateImage} 
              alt="Template" 
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
          )}

          {/* CONTENT OVERLAY */}
          {pages.map((p, i) => (
            <DraggableResizableBox 
              key={p.id}
              {...p.box}
              onUpdate={(newBox) => updateBox(p.id, newBox)}
              disabled={exporting}
              hideBorder={exporting}
            >
              <div 
                style={{ 
                  fontSize: docHtml === "PDF_MODE" ? "inherit" : `${fontSize}px`, 
                  lineHeight: 1.4, 
                  opacity: opacity,
                  // Εφαρμογή φίλτρων για ένταση
                  filter: `contrast(${contrast}) brightness(${1 + (contrast - 1) * 0.1})`,
                  transition: "filter 0.2s, opacity 0.2s",
                  pointerEvents: "none",
                  width: "100%",
                  height: "100%"
                }} 
                className="overflow-hidden"
                dangerouslySetInnerHTML={{ __html: p.html }} 
              />
            </DraggableResizableBox>
          ))}
        </div>
      </div>

      {/* STYLES ΓΙΑ ΤΟ RESIZE HANDLE ΚΑΙ PRINT */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-handle {
          position: absolute;
          width: 12px;
          height: 12px;
          background: #3b82f6;
          right: -6px;
          bottom: -6px;
          cursor: se-resize;
          border-radius: 50%;
          border: 2px solid white;
          z-index: 20;
        }
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white; }
          .no-print { display: none !important; }
          .bg-white { shadow: none !important; }
        }
      `}} />
    </div>
  );
};

export default A4Composer;