import React, { useState, useRef, useEffect } from "react";

// A4 size at 96 DPI
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// --- Helper Component: Draggable & Resizable Box ---
function DraggableResizableBox({ x, y, width, height, onUpdate, children, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef({ x: 0, y: 0, initialX: 0, initialY: 0, initialW: 0, initialH: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (disabled) return;
      if (isDragging) {
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        onUpdate({ 
          x: startPos.current.initialX + dx, 
          y: startPos.current.initialY + dy, 
          width: startPos.current.initialW, 
          height: startPos.current.initialH 
        });
      } else if (isResizing) {
        const dx = e.clientX - startPos.current.x;
        const dy = e.clientY - startPos.current.y;
        onUpdate({ 
          x: startPos.current.initialX, 
          y: startPos.current.initialY, 
          width: Math.max(100, startPos.current.initialW + dx), 
          height: Math.max(100, startPos.current.initialH + dy) 
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, disabled, onUpdate]);

  const handleMouseDown = (e) => {
    if (disabled || e.target.closest('.resize-handle')) return;
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY, initialX: x, initialY: y, initialW: width, initialH: height };
  };

  const handleResizeStart = (e) => {
    if (disabled) return;
    e.stopPropagation();
    setIsResizing(true);
    startPos.current = { x: e.clientX, y: e.clientY, initialX: x, initialY: y, initialW: width, initialH: height };
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        border: disabled ? 'none' : '2px dashed #999',
        cursor: disabled ? 'default' : 'move',
        userSelect: 'none',
        zIndex: 10,
        backgroundColor: 'transparent'
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
      {!disabled && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            bottom: -5,
            right: -5,
            width: 15,
            height: 15,
            background: '#3b82f6',
            cursor: 'nwse-resize',
            borderRadius: '50%'
          }}
        />
      )}
    </div>
  );
}

// --- Main Component ---
export default function A4WordComposer() {
  const [template, setTemplate] = useState(null);
  const [docHtml, setDocHtml] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [pages, setPages] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [libsLoaded, setLibsLoaded] = useState(false);

  // Text box – configured ONLY on the first page
  const [box, setBox] = useState({ x: 80, y: 120, width: 630, height: 850 });
  const measureRef = useRef(null);

  // Refs για τα input files
  const templateInputRef = useRef(null);
  const docInputRef = useRef(null);

  // Load external libraries dynamically via CDN
  useEffect(() => {
    const scripts = [
      "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    ];

    let loadedCount = 0;
    scripts.forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) {
        loadedCount++;
        if (loadedCount === scripts.length) setLibsLoaded(true);
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        loadedCount++;
        if (loadedCount === scripts.length) setLibsLoaded(true);
      };
      document.body.appendChild(script);
    });
  }, []);

  function handleTemplate(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setTemplate(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleDoc(e) {
    if (!window.mammoth) {
      console.error("Mammoth library not loaded.");
      return;
    }
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
        const buffer = await file.arrayBuffer();
        const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
        setDocHtml(result.value || "");
    } catch (error) {
      console.error("Error converting DOCX:", error);
    }
  }

  function handleReset() {
    // Καθαρισμός των States
    setTemplate(null);
    setDocHtml("");
    setPages([]);
    setFontSize(16);
    // Επαναφορά των input fields
    if (templateInputRef.current) templateInputRef.current.value = null;
    if (docInputRef.current) docInputRef.current.value = null;
  }
  
  // --- ΕΝΗΜΕΡΩΜΕΝΗ ΛΟΓΙΚΗ ΣΕΛΙΔΟΠΟΙΗΣΗΣ (με διακοπή κειμένου) ---
  useEffect(() => {
    if (!docHtml || !measureRef.current) {
      setPages([]);
      return;
    }

    const container = measureRef.current;
    container.innerHTML = docHtml;
    container.style.fontSize = fontSize + "px";
    container.style.width = box.width + "px";
    container.style.margin = "0";
    container.style.padding = "0";
    container.style.lineHeight = "1.4"; 

    const elements = Array.from(container.children);
    
    // Normalize margins/paddings of content elements *for accurate measurement*
    elements.forEach(el => {
        el.style.margin = '0';
        el.style.padding = '0';
    });

    const newPages = [];
    let remainingElements = [...elements];
    
    while (remainingElements.length > 0) {
        let currentPageNodes = [];
        let elementsToProcess = [...remainingElements];
        remainingElements = [];
        
        container.innerHTML = '';
        
        let breakPage = false;

        for (let i = 0; i < elementsToProcess.length; i++) {
            if (breakPage) {
                remainingElements.push(elementsToProcess[i]);
                continue;
            }

            const el = elementsToProcess[i];
            const clone = el.cloneNode(true);
            
            container.appendChild(clone);
            
            if (container.scrollHeight <= box.height) {
                // Element fits entirely.
                currentPageNodes.push(clone);
            } else {
                // Element does not fit entirely or caused overflow
                
                container.removeChild(clone);

                if (el.tagName === 'P') {
                    // --- Text splitting logic for Paragraphs ---
                    const words = el.textContent.split(/\s+/).filter(w => w.length > 0);
                    let leftWords = [];
                    let rightWords = [];
                    
                    const tempSplitter = el.cloneNode(true); 
                    tempSplitter.textContent = '';
                    
                    container.appendChild(tempSplitter);

                    for (let w = 0; w < words.length; w++) {
                        leftWords.push(words[w]);
                        tempSplitter.textContent = leftWords.join(' ');
                        
                        if (container.scrollHeight > box.height) {
                            
                            leftWords.pop(); 
                            rightWords = words.slice(w); 
                            
                            // Current page fragment
                            const currentFragment = el.cloneNode(true);
                            currentFragment.textContent = leftWords.join(' ');
                            currentPageNodes.push(currentFragment);
                            
                            // Next page fragment
                            const nextFragment = el.cloneNode(true);
                            nextFragment.textContent = rightWords.join(' ');
                            remainingElements.push(nextFragment);
                            
                            breakPage = true; 
                            break; 
                        }
                    }
                    
                    // Finalize the current page
                    container.removeChild(tempSplitter);
                    
                } else {
                    // Non-paragraph element (Image, Table, Header) doesn't fit
                    remainingElements.push(el);
                    breakPage = true; // Finalize current page immediately
                }
            }
            
            // If page broke or this was the last element, add the rest to remaining
            if (breakPage && i < elementsToProcess.length - 1) {
                remainingElements.push(...elementsToProcess.slice(i + 1));
            }

            if (breakPage) break; 
        }
        
        // Finalize the current page content
        newPages.push(currentPageNodes.map((n) => n.outerHTML).join(""));
    }

    setPages(newPages);
  }, [docHtml, fontSize, box.width, box.height]);
  // --- ΤΕΛΟΣ ΕΝΗΜΕΡΩΜΕΝΗΣ ΛΟΓΙΚΗΣ ΣΕΛΙΔΟΠΟΙΗΣΗΣ ---


  async function exportPDF() {
    if (!window.jspdf || !window.html2canvas) {
        console.error("Export libraries are not ready.");
        return;
    }
    setIsExporting(true);
    setTimeout(async () => {
      try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "pt", "a4"); 
        const pageEls = document.querySelectorAll(".a4-page");

        for (let i = 0; i < pageEls.length; i++) {
          const canvas = await window.html2canvas(pageEls[i], {
            scale: 2, // High resolution 
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            width: A4_WIDTH,
            height: A4_HEIGHT,
            scrollX: 0,
            scrollY: 0,
            windowWidth: A4_WIDTH,
            windowHeight: A4_HEIGHT
          });

          const img = canvas.toDataURL("image/jpeg", 0.9);
          if (i > 0) pdf.addPage();
          pdf.addImage(img, "JPEG", 0, 0, 595, 842);
        }
        pdf.save("document.pdf");
      } catch (err) {
        console.error("Export failed", err);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }

  async function exportImages(type) {
    if (!window.html2canvas) return;
    setIsExporting(true);
    setTimeout(async () => {
      try {
        const pageEls = document.querySelectorAll(".a4-page");
        for (let i = 0; i < pageEls.length; i++) {
          const canvas = await window.html2canvas(pageEls[i], {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            width: A4_WIDTH,
            height: A4_HEIGHT,
            scrollX: 0,
            scrollY: 0,
            windowWidth: A4_WIDTH,
            windowHeight: A4_HEIGHT
          });
          
          const link = document.createElement("a");
          link.download = `page-${i + 1}.${type}`;
          link.href = canvas.toDataURL(`image/${type}`, 0.9);
          link.click();
        }
      } catch (err) {
        console.error("Export failed", err);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  }

  if (!libsLoaded) {
      return <div className="p-10 text-center">Φόρτωση βιβλιοθηκών...</div>;
  }

  return (
    <div className="font-sans p-5 bg-gray-100 min-h-screen">
      
      {/* 🌟 ΚΕΦΑΛΙΔΑ ΕΦΑΡΜΟΓΗΣ 🌟 */}
      <header className="mb-6 py-4 bg-white shadow-md rounded-lg flex justify-between items-center px-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          📝 A4 Document Composer
        </h1>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition duration-150 flex items-center gap-2 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Καθαρισμός / Επαναφορά
        </button>
      </header>
      {/* --------------------------- */}
      
      <div className="mb-6 flex flex-wrap gap-4 bg-white p-4 rounded shadow">
        <div className="flex gap-2">
          <button 
            onClick={exportPDF} 
            disabled={isExporting}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {isExporting ? "Εξαγωγή..." : "📄 PDF (300 DPI)"}
          </button>
          <button 
            onClick={() => exportImages("png")} 
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            🖼️ PNG
          </button>
          <button 
            onClick={() => exportImages("jpeg")} 
            disabled={isExporting}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            🖼️ JPEG
          </button>
        </div>
      </div>

      <div className="flex gap-5 flex-wrap mb-6 bg-white p-4 rounded shadow">
        <label className="flex flex-col gap-1 text-sm font-medium">
          📄 Επιλογή template (JPEG/PNG)
          <input 
             type="file" 
             accept="image/*" 
             onChange={handleTemplate} 
             className="text-gray-600"
             ref={templateInputRef} 
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          📝 Επιλογή Word (.docx)
          <input 
             type="file" 
             accept=".docx" 
             onChange={handleDoc} 
             className="text-gray-600"
             ref={docInputRef} 
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium w-48">
          🔠 Μέγεθος κειμένου: {fontSize}px
          <input 
            type="range" 
            min="10" 
            max="40" 
            value={fontSize} 
            onChange={(e) => setFontSize(Number(e.target.value))} 
            className="w-full"
          />
        </label>
      </div>

      <div className="flex flex-col items-center gap-8">
        {pages.map((html, i) => (
          <div
            key={i}
            className="a4-page shadow-xl"
            style={{
              width: A4_WIDTH,
              height: A4_HEIGHT,
              backgroundImage: template ? `url(${template})` : "linear-gradient(to bottom, #ffffff, #f9f9f9)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              position: "relative",
              overflow: "hidden", 
              backgroundColor: "white"
            }}
          >
            {i === 0 ? (
              <DraggableResizableBox
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                onUpdate={(newBox) => setBox({ ...box, ...newBox })}
                disabled={isExporting}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    fontSize: fontSize + "px",
                    fontFamily: "Arial, sans-serif",
                    lineHeight: "1.4",
                    overflow: "hidden",
                    wordWrap: "break-word"
                  }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </DraggableResizableBox>
            ) : (
              <div
                style={{
                  position: "absolute",
                  left: box.x,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                  background: "transparent",
                  fontSize: fontSize + "px",
                  fontFamily: "Arial, sans-serif",
                  lineHeight: "1.4",
                  overflow: "hidden",
                  wordWrap: "break-word"
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
            
            {!isExporting && (
                <div className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
                    Page {i + 1}
                </div>
            )}
          </div>
        ))}
        
        {pages.length === 0 && (
            <div 
                className="flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded"
                style={{ width: A4_WIDTH, height: 400 }}
            >
                Ανεβάστε ένα αρχείο Word για προεπισκόπηση
            </div>
        )}
      </div>

      {/* Hidden container for measuring text flow */}
      <div
        ref={measureRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          width: box.width,
          fontSize: fontSize + "px",
          fontFamily: "Arial, sans-serif",
          lineHeight: "1.4",
          left: -9999,
          top: 0,
        }}
      />
    </div>
  );
}