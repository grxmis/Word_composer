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
          y: startPos.initialY + dy, 
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
        // Use the globally available 'mammoth' from CDN
        const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
        setDocHtml(result.value || "");
    } catch (error) {
      console.error("Error converting DOCX:", error);
    }
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
    container.style.lineHeight = "1.4"; // Match the display style

    const elements = Array.from(container.children);
    
    // Normalize margins/paddings of content elements *for accurate measurement*
    elements.forEach(el => {
        el.style.margin = '0';
        el.style.padding = '0';
    });

    const newPages = [];
    let remainingElements = [...elements];
    
    // Loop until all content is paginated
    while (remainingElements.length > 0) {
        let currentPageNodes = [];
        let elementsToProcess = [...remainingElements];
        remainingElements = [];
        
        // Temporarily clear the container for the new page measurement
        container.innerHTML = '';
        
        let breakPage = false;

        for (let i = 0; i < elementsToProcess.length; i++) {
            if (breakPage) {
                remainingElements.push(elementsToProcess[i]);
                continue;
            }

            const el = elementsToProcess[i];
            const clone = el.cloneNode(true);
            
            // Check current fit: Append the element to the measuring container and check total height
            container.appendChild(clone);
            
            if (container.scrollHeight <= box.height) {
                // Element fits entirely. Add it to the current page nodes.
                currentPageNodes.push(clone);
                // The element stays in the container for the next measurement iteration
            } else {
                // Element does not fit entirely or caused overflow
                
                // 1. Remove the element that caused the overflow from the container
                container.removeChild(clone);

                if (el.tagName === 'P') {
                    // --- Text splitting logic for Paragraphs ---
                    const words = el.textContent.split(/\s+/).filter(w => w.length > 0);
                    let leftWords = [];
                    let rightWords = [];
                    
                    // The temporary splitter node (which is now empty)
                    const tempSplitter = el.cloneNode(true); 
                    tempSplitter.textContent = '';
                    
                    // We must measure relative to what is ALREADY in the container (currentPageNodes)
                    // We append the temporary splitter (which has the styles but no text yet)
                    container.appendChild(tempSplitter);

                    for (let w = 0; w < words.length; w++) {
                        leftWords.push(words[w]);
                        tempSplitter.textContent = leftWords.join(' ');
                        
                        // Check if the measurement causes the *whole container* to exceed the box height
                        if (container.scrollHeight > box.height) {
                            
                            // The current word caused the overflow, so it belongs to the next page.
                            leftWords.pop(); // Remove the offending word
                            rightWords = words.slice(w); // The rest goes to next page
                            
                            // 1. Create the fragment for the current page (Final content)
                            const currentFragment = el.cloneNode(true);
                            currentFragment.textContent = leftWords.join(' ');
                            currentPageNodes.push(currentFragment);
                            
                            // 2. Create the fragment for the next page
                            const nextFragment = el.cloneNode(true);
                            nextFragment.textContent = rightWords.join(' ');
                            remainingElements.push(nextFragment);
                            
                            // Finalize the current page
                            breakPage = true; 
                            break; 
                        }
                    }
                    
                    // If we finished the word loop without breaking (it fit just perfectly, and we need to commit it)
                    if (!breakPage) {
                        // This shouldn't happen if the check outside the loop was correct, 
                        // but as a fallback, push the full clone and break.
                         currentPageNodes.push(el.cloneNode(true));
                         breakPage = true;
                    }
                    
                    // Remove the temporary splitter node
                    container.removeChild(tempSplitter);
                    
                } else {
                    // 2. Handle non-paragraph elements (Images, Tables, Headers, Lists)
                    // If the element doesn't fit, and it's not a paragraph, we stop the current page 
                    // and put the entire element into the next page.
                    remainingElements.push(el);
                    breakPage = true; // Finalize current page immediately
                }
            }

            if (i === elementsToProcess.length - 1 && !breakPage) {
                // Last element processed and it fit. All done for this content block.
            } else if (!breakPage) {
                // The element fit, but we must explicitly push the rest of elements to be processed
                // in the next iteration if they don't fit in this page.
                // We handle this outside the loop by only processing `elementsToProcess`.
            } else if (breakPage && i < elementsToProcess.length - 1) {
                // If we broke the page (due to split or non-fitting element),
                // the rest of the elements in `elementsToProcess` must go to `remainingElements`.
                remainingElements.push(...elementsToProcess.slice(i + 1));
            }

            if (breakPage) break; // Exit the loop to finalize the current page
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
    // Use setTimeout to allow React to re-render (hide borders) before capture
    setTimeout(async () => {
      try {
        const { jsPDF } = window.jspdf;
        // Use pt (points) for accurate PDF measurements
        const pdf = new jsPDF("p", "pt", "a4"); 
        const pageEls = document.querySelectorAll(".a4-page");

        for (let i = 0; i < pageEls.length; i++) {
          const canvas = await window.html2canvas(pageEls[i], {
            scale: 2, // High resolution (approx 300 DPI for 96 DPI base)
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
          // A4 dimensions in PDF points (595x842)
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
          <input type="file" accept="image/*" onChange={handleTemplate} className="text-gray-600" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          📝 Επιλογή Word (.docx)
          <input type="file" accept=".docx" onChange={handleDoc} className="text-gray-600" />
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