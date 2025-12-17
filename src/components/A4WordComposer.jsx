import React, { useState, useRef, useEffect, useCallback } from "react";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// --- Helper: Draggable & Resizable Box ---
function DraggableResizableBox({ x, y, width, height, onUpdate, children, disabled, hideBorder }) { 
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const startPos = useRef({ x: 0, y: 0, initialX: 0, initialY: 0, initialW: 0, initialH: 0 });
    const isInteractionEnabled = !disabled && !hideBorder;

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isInteractionEnabled) return;
            const dx = e.clientX - startPos.current.x;
            const dy = e.clientY - startPos.current.y;
            if (isDragging) {
                onUpdate({ x: startPos.current.initialX + dx, y: startPos.current.initialY + dy, width: startPos.current.initialW, height: startPos.current.initialH });
            } else if (isResizing) {
                onUpdate({ x: startPos.current.initialX, y: startPos.current.initialY, width: Math.max(100, startPos.current.initialW + dx), height: Math.max(100, startPos.current.initialH + dy) });
            }
        };
        const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isDragging, isResizing, isInteractionEnabled, onUpdate, x, y, width, height]);

    return (
        <div style={{ position: 'absolute', left: x, top: y, width, height, border: (disabled || hideBorder) ? 'none' : '2px dashed #999', cursor: (disabled || hideBorder) ? 'default' : 'move', zIndex: 10 }}
             onMouseDown={(e) => { if (!isInteractionEnabled || e.target.closest('.resize-handle')) return; setIsDragging(true); startPos.current = { x: e.clientX, y: e.clientY, initialX: x, initialY: y, initialW: width, initialH: height }; }}>
            {children}
            {isInteractionEnabled && (
                <div className="resize-handle" style={{ position: 'absolute', bottom: -5, right: -5, width: 15, height: 15, background: '#3b82f6', cursor: 'nwse-resize', borderRadius: '50%' }}
                     onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); startPos.current = { x: e.clientX, y: e.clientY, initialX: x, initialY: y, initialW: width, initialH: height }; }} />
            )}
        </div>
    );
}

export default function A4WordComposer() {
    const [template, setTemplate] = useState(null);
    const [docHtml, setDocHtml] = useState("");
    const [fontSize, setFontSize] = useState(16);
    const [pages, setPages] = useState([]);
    const [isExporting, setIsExporting] = useState(false);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [libsLoaded, setLibsLoaded] = useState(false);
    const [templateFileName, setTemplateFileName] = useState("Επιλέξτε εικόνα...");
    const [docFileName, setDocFileName] = useState("Επιλέξτε .docx...");
    const [box, setBox] = useState({ x: 80, y: 120, width: 630, height: 850 });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const measureRef = useRef(null);

    // Load Scripts & Resize Listener
    useEffect(() => {
        const scripts = [
            "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        ];
        let loaded = 0;
        scripts.forEach(src => {
            const s = document.createElement("script"); s.src = src;
            s.onload = () => { loaded++; if (loaded === scripts.length) setLibsLoaded(true); };
            document.body.appendChild(s);
        });
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Λειτουργία Επαναφοράς (Reset) ---
    const handleReset = () => {
        setTemplate(null);
        setDocHtml("");
        setPages([]);
        setFontSize(16);
        setTemplateFileName("Επιλέξτε εικόνα...");
        setDocFileName("Επιλέξτε .docx...");
        setBox({ x: 80, y: 120, width: 630, height: 850 });
    };

    // File Handlers
    const processFile = async (file) => {
        if (!file) return;
        if (file.type.startsWith("image/")) {
            setTemplateFileName(file.name);
            const r = new FileReader(); r.onload = () => setTemplate(r.result); r.readAsDataURL(file);
        } else if (file.name.endsWith(".docx")) {
            setDocFileName(file.name);
            const buf = await file.arrayBuffer();
            const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
            setDocHtml(res.value);
        }
    };

    // Drag & Drop Handlers
    const handleDragOver = (e) => { e.preventDefault(); setIsDraggingFile(true); };
    const handleDragLeave = () => setIsDraggingFile(false);
    const handleDrop = (e) => {
        e.preventDefault(); setIsDraggingFile(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    // AI Logic (1-Page Fit)
    const optimizeFontSize = () => {
        let low = 10, high = 40, best = 16;
        const container = measureRef.current;
        for (let i = 0; i < 7; i++) {
            let mid = (low + high) / 2;
            container.innerHTML = docHtml; container.style.fontSize = mid + "px"; container.style.width = box.width + "px";
            if (container.scrollHeight <= box.height) { best = mid; low = mid; } else { high = mid; }
        }
        setFontSize(Math.floor(best));
    };

    // Pagination Logic
    useEffect(() => {
        if (!docHtml || !measureRef.current) { setPages([]); return; }
        const container = measureRef.current;
        container.innerHTML = docHtml; container.style.fontSize = fontSize + "px"; container.style.width = box.width + "px";
        const elements = Array.from(container.children);
        let newPages = [], currentRemaining = [...elements];
        while (currentRemaining.length > 0) {
            let pageNodes = []; container.innerHTML = '';
            let breakIdx = currentRemaining.length;
            for (let i = 0; i < currentRemaining.length; i++) {
                container.appendChild(currentRemaining[i].cloneNode(true));
                if (container.scrollHeight <= box.height) pageNodes.push(currentRemaining[i].outerHTML);
                else { breakIdx = i; break; }
            }
            newPages.push(pageNodes.join(""));
            currentRemaining = currentRemaining.slice(breakIdx);
            if (breakIdx === 0) break;
        }
        setPages(newPages);
    }, [docHtml, fontSize, box.width, box.height]);

    // PDF Logic
    const getPDF = async () => {
        setIsExporting(true);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageEls = document.querySelectorAll('.a4-page');
        for (let i = 0; i < pageEls.length; i++) {
            const canvas = await window.html2canvas(pageEls[i], { scale: 2 });
            if (i > 0) pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
        }
        setIsExporting(false);
        return pdf;
    };

    if (!libsLoaded) return <div className="p-10 text-center">Φόρτωση βιβλιοθηκών...</div>;

    return (
        <div className="p-4 bg-gray-100 min-h-screen relative" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <style>{`@media (max-width:768px){.a4-page-scaled{transform:scale(0.45);transform-origin:top center;margin-bottom:-550px;box-shadow:none!important;}}`}</style>
            
            {isDraggingFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-500 bg-opacity-20 border-4 border-dashed border-blue-500 pointer-events-none">
                    <h2 className="text-2xl font-bold text-blue-700 bg-white p-6 rounded-xl shadow-xl">Ρίξτε το αρχείο εδώ ✨</h2>
                </div>
            )}

            <header className="flex justify-between items-center bg-white p-4 shadow-sm rounded-xl mb-4">
                <h1 className="text-xl font-black text-gray-800">A4 COMPOSER <span className="text-blue-500 text-xs">PRO</span></h1>
                <div className="flex gap-2">
                    {/* Επανεμφάνιση Reset Button */}
                    <button onClick={handleReset} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition">Reset</button>
                    <button onClick={async() => { const pdf = await getPDF(); window.open(URL.createObjectURL(pdf.output('blob')), '_blank'); }} disabled={pages.length===0 || isExporting} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-black transition">👁️ Preview</button>
                    <button onClick={async() => { const pdf = await getPDF(); pdf.save('document.pdf'); }} disabled={pages.length===0 || isExporting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition">📥 Download</button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Αρχεία (Drag & Drop)</p>
                    <div className="flex flex-col gap-2">
                        <input type="file" id="t-in" hidden onChange={(e)=>processFile(e.target.files[0])} accept="image/*"/><label htmlFor="t-in" className="border-2 border-dashed p-2 rounded-lg text-xs cursor-pointer truncate hover:bg-gray-50 block">🖼️ {templateFileName}</label>
                        <input type="file" id="d-in" hidden onChange={(e)=>processFile(e.target.files[0])} accept=".docx"/><label htmlFor="d-in" className="border-2 border-dashed p-2 rounded-lg text-xs cursor-pointer truncate hover:bg-gray-50 block">📄 {docFileName}</label>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
                    <div className="flex justify-between items-center"><p className="text-[10px] font-bold text-gray-400 uppercase">Κείμενο</p><button onClick={optimizeFontSize} className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold hover:bg-purple-700">✨ AI AUTO-FIT</button></div>
                    <div className="text-center font-bold text-lg">{fontSize}px</div>
                    <input type="range" min="10" max="40" value={fontSize} onChange={(e)=>setFontSize(Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Περιοχή (X, Y, W, H)</p>
                    <div className="grid grid-cols-4 gap-1">
                        {['x','y','width','height'].map(k => <input key={k} type="number" value={Math.round(box[k])} onChange={e=>setBox({...box,[k]:Number(e.target.value)})} className="border rounded p-1 text-xs text-center font-mono"/>)}
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center gap-10 pb-20">
                {pages.map((html, i) => (
                    <div key={i} className={`relative bg-white shadow-2xl overflow-hidden a4-page ${isMobile ? 'a4-page-scaled' : ''}`} style={{ width: A4_WIDTH, height: A4_HEIGHT }}>
                        {template && <img src={template} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt="" />}
                        <DraggableResizableBox x={box.x} y={box.y} width={box.width} height={box.height} onUpdate={setBox} disabled={i>0 || isMobile} hideBorder={isExporting}>
                            <div className="w-full h-full overflow-hidden" style={{ fontSize: `${fontSize}px`, lineHeight: "1.4" }} dangerouslySetInnerHTML={{ __html: html }} />
                        </DraggableResizableBox>
                        <div className="absolute bottom-4 left-0 w-full text-center text-[10px] text-gray-300 font-mono">- PAGE {i+1} -</div>
                    </div>
                ))}
            </div>
            <div ref={measureRef} style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none', top: 0 }} />
        </div>
    );
}