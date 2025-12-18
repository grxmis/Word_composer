import React, { useState, useRef, useEffect } from "react";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/* ---------------- Draggable & Resizable Box ---------------- */
function DraggableResizableBox({ x, y, width, height, onUpdate, children, disabled, hideBorder }) {
    const [drag, setDrag] = useState(false);
    const [resize, setResize] = useState(false);
    const start = useRef({});
    const enabled = !disabled && !hideBorder;

    useEffect(() => {
        const move = (e) => {
            const dx = e.clientX - start.current.x;
            const dy = e.clientY - start.current.y;
            if (drag) onUpdate({ x: start.current.ix + dx, y: start.current.iy + dy, width: start.current.w, height: start.current.h });
            if (resize) onUpdate({ x: start.current.ix, y: start.current.iy, width: Math.max(100, start.current.w + dx), height: Math.max(100, start.current.h + dy) });
        };
        const up = () => { setDrag(false); setResize(false); };
        if (drag || resize) {
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
        }
        return () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
        };
    }, [drag, resize, onUpdate]);

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
            onMouseDown={(e) => {
                if (!enabled || e.target.closest(".resize-handle")) return;
                setDrag(true);
                start.current = { x: e.clientX, y: e.clientY, ix: x, iy: y, w: width, h: height };
            }}
        >
            {children}
            {enabled && (
                <div
                    className="resize-handle"
                    style={{
                        position: "absolute",
                        right: -6,
                        bottom: -6,
                        width: 16,
                        height: 16,
                        background: "#2563eb",
                        borderRadius: "50%",
                        cursor: "nwse-resize"
                    }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        setResize(true);
                        start.current = { x: e.clientX, y: e.clientY, ix: x, iy: y, w: width, h: height };
                    }}
                />
            )}
        </div>
    );
}

/* ---------------- MAIN ---------------- */
export default function A4WordComposer() {
    const [template, setTemplate] = useState(null);
    const [docHtml, setDocHtml] = useState("");
    const [fontSize, setFontSize] = useState(16);
    const [pages, setPages] = useState([]);
    const [box, setBox] = useState({ x: 80, y: 120, width: 630, height: 850 });
    const [isExporting, setIsExporting] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [dragLabel, setDragLabel] = useState("");
    const [libsLoaded, setLibsLoaded] = useState(false);
    const [templateName, setTemplateName] = useState("Επιλέξτε εικόνα...");
    const [docName, setDocName] = useState("Επιλέξτε .docx...");
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const measureRef = useRef(null);

    /* -------- Load libs -------- */
    useEffect(() => {
        const libs = [
            "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        ];
        let loaded = 0;
        libs.forEach(src => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = () => { if (++loaded === libs.length) setLibsLoaded(true); };
            document.body.appendChild(s);
        });
        const resize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, []);

    /* -------- FILE HANDLERS -------- */
    const handleTemplateFile = (file) => {
        if (!file || !file.type.startsWith("image/")) return;
        setTemplateName(file.name);
        const r = new FileReader();
        r.onload = () => setTemplate(r.result);
        r.readAsDataURL(file);
    };

    const handleDocFile = async (file) => {
        if (!file || !file.name.endsWith(".docx")) return;
        setDocName(file.name);
        const buf = await file.arrayBuffer();
        const res = await window.mammoth.convertToHtml({ arrayBuffer: buf });
        setDocHtml(res.value);
    };

    /* -------- CLEAN DRAG & DROP -------- */
    const onDragOver = (e) => {
        e.preventDefault();
        const item = e.dataTransfer.items?.[0];
        if (!item) return;

        if (item.type.startsWith("image/")) {
            setDragLabel("🖼 Ρίξτε εικόνα για φόντο");
            setDragActive(true);
        } else if (item.kind === "file" && item.type === "") {
            setDragLabel("📄 Ρίξτε αρχείο Word (.docx)");
            setDragActive(true);
        } else {
            setDragActive(false);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragActive(false);

        const file = e.dataTransfer.files[0];
        if (!file) return;

        if (file.type.startsWith("image/")) handleTemplateFile(file);
        else if (file.name.endsWith(".docx")) handleDocFile(file);
    };

    const onDragLeave = () => setDragActive(false);

    if (!libsLoaded) return <div className="p-10 text-center">Φόρτωση…</div>;

    return (
        <div
            className="p-4 bg-gray-100 min-h-screen"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {dragActive && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-600 bg-opacity-30 pointer-events-none">
                    <div className="bg-white px-10 py-6 rounded-xl shadow-xl text-xl font-bold">
                        {dragLabel}
                    </div>
                </div>
            )}

            {/* HEADER */}
            <header className="bg-white p-4 rounded-xl shadow mb-4 flex gap-2 items-center">
                <h1 className="font-black text-lg">A4 COMPOSER</h1>

                <input id="img" type="file" hidden accept="image/*" onChange={e => handleTemplateFile(e.target.files[0])} />
                <label htmlFor="img" className="border-2 border-dashed px-2 py-1 rounded cursor-pointer text-xs">
                    🖼 {templateName}
                </label>

                <input id="doc" type="file" hidden accept=".docx" onChange={e => handleDocFile(e.target.files[0])} />
                <label htmlFor="doc" className="border-2 border-dashed px-2 py-1 rounded cursor-pointer text-xs">
                    📄 {docName}
                </label>

                <div className="flex items-center gap-2 ml-4">
                    <span className="text-xs">Γραμματοσειρά</span>
                    <input type="range" min="10" max="40" value={fontSize} onChange={e => setFontSize(+e.target.value)} />
                    <span className="text-xs">{fontSize}px</span>
                </div>

                <button onClick={() => window.location.reload()} className="ml-auto bg-red-100 text-red-600 px-3 py-1 rounded">Reset</button>
                <button onClick={async () => window.open(URL.createObjectURL((await (async()=>{setIsExporting(true);await new Promise(r=>setTimeout(r,200));const {jsPDF}=window.jspdf;const pdf=new jsPDF("p","mm","a4");const els=document.querySelectorAll(".a4-page");for(let i=0;i<els.length;i++){const c=await window.html2canvas(els[i],{scale:2});if(i>0)pdf.addPage();pdf.addImage(c.toDataURL("image/jpeg",0.95),"JPEG",0,0,210,297);}setIsExporting(false);return pdf;})()).output("blob")))} className="bg-gray-800 text-white px-3 py-1 rounded">Preview</button>
                <button onClick={async () => (await (async()=>{setIsExporting(true);await new Promise(r=>setTimeout(r,200));const {jsPDF}=window.jspdf;const pdf=new jsPDF("p","mm","a4");const els=document.querySelectorAll(".a4-page");for(let i=0;i<els.length;i++){const c=await window.html2canvas(els[i],{scale:2});if(i>0)pdf.addPage();pdf.addImage(c.toDataURL("image/jpeg",0.95),"JPEG",0,0,210,297);}setIsExporting(false);return pdf;})()).save("document.pdf")} className="bg-blue-600 text-white px-3 py-1 rounded">Download</button>
            </header>

            <div className="flex flex-col items-center gap-10">
                {pages.map((html, i) => (
                    <div key={i} className="relative bg-white shadow-2xl a4-page" style={{ width: A4_WIDTH, height: A4_HEIGHT }}>
                        {template && <img src={template} className="absolute inset-0 w-full h-full object-cover" alt="" />}
                        <DraggableResizableBox x={box.x} y={box.y} width={box.width} height={box.height} onUpdate={setBox} disabled={i > 0 || isMobile} hideBorder={isExporting}>
                            <div style={{ fontSize, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: html }} />
                        </DraggableResizableBox>
                    </div>
                ))}
            </div>

            <div ref={measureRef} style={{ position: "absolute", visibility: "hidden" }} />
        </div>
    );
}
