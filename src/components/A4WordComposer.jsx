import React, { useState, useRef, useEffect } from "react";

// A4 size at 96 DPI
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// --- Helper Component: Draggable & Resizable Box (Remains the same) ---
function DraggableResizableBox({ x, y, width, height, onUpdate, children, disabled }) {
  // ... (DraggableResizableBox implementation remains the same)
}
// --- ΤΕΛΟΣ DraggableResizableBox ---

// --- Main Component ---
export default function A4WordComposer() {
  const [template, setTemplate] = useState(null);
  const [docHtml, setDocHtml] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [pages, setPages] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [libsLoaded, setLibsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false); 
  
  const [templateFileName, setTemplateFileName] = useState("Επιλέξτε αρχείο...");
  const [docFileName, setDocFileName] = useState("Επιλέξτε αρχείο...");

  const [box, setBox] = useState({ x: 80, y: 120, width: 630, height: 850 });
  const measureRef = useRef(null);

  const templateInputRef = useRef(null);
  const docInputRef = useRef(null);

  // Load external libraries dynamically via CDN (Remains the same)
  useEffect(() => {
    // ... (Library loading logic remains the same)
  }, []);

  function handleTemplate(fileOrEvent) {
    // Ελέγχουμε αν το template input είναι disabled
    if (!docHtml) return; 

    const file = fileOrEvent.target?.files?.[0] || fileOrEvent;
    if (!file || !file.type.startsWith("image/")) return;
    
    setTemplateFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = () => setTemplate(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleDoc(fileOrEvent) {
    if (!window.mammoth) {
      console.error("Mammoth library not loaded.");
      return;
    }
    const file = fileOrEvent.target?.files?.[0] || fileOrEvent;
    if (!file) return;
    
    setDocFileName(file.name);
    
    try {
        const buffer = await file.arrayBuffer();
        const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
        setDocHtml(result.value || "");
        
        // 💡 Εδώ, μόλις φορτωθεί το DOCX, ενεργοποιείται το template input.
    } catch (error) {
      console.error("Error converting DOCX:", error);
    }
  }

  function handleReset() {
    setTemplate(null);
    setDocHtml("");
    setPages([]);
    setFontSize(16);
    setTemplateFileName("Επιλέξτε αρχείο...");
    setDocFileName("Επιλέξτε αρχείο...");
    if (templateInputRef.current) templateInputRef.current.value = null;
    if (docInputRef.current) docInputRef.current.value = null;
  }
  
  // Pagination Logic (Remains the same)
  useEffect(() => {
    // ... (Full pagination logic remains the same)
  }, [docHtml, fontSize, box.width, box.height]);

  async function exportPDF() { /* ... */ }
  async function exportImages(type) { /* ... */ }
  
  // Drag & Drop Logic (Remains the same)
  const handleDrag = (e) => {
    // ... (handleDrag logic remains the same)
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      
      files.forEach(file => {
        const fileType = file.type;
        
        if (fileType.startsWith("image/")) {
          // Το template drop επιτρέπεται μόνο αν υπάρχει ήδη DOCX
          if (docHtml) {
              handleTemplate(file);
          }
        } else if (file.name.endsWith(".docx")) {
          handleDoc(file);
        }
      });
      e.dataTransfer.clearData();
    }
  };


  if (!libsLoaded) {
      return <div className="p-10 text-center">Φόρτωση βιβλιοθηκών...</div>;
  }
  
  // 💡 Έλεγχος: Είναι ενεργό το Template input;
  const isTemplateEnabled = !!docHtml; 
  
  // 💡 Styling για απενεργοποιημένο input
  const disabledStyle = isTemplateEnabled ? '' : 'opacity-50 cursor-not-allowed pointer-events-none';
  const disabledBorder = isTemplateEnabled ? 'border-gray-300' : 'border-gray-200 bg-gray-100';


  return (
    <div 
      className="font-sans p-5 bg-gray-100 min-h-screen relative"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      
      {/* ... Header και Export Buttons παραμένουν ίδια ... */}

      {/* Input Fields και Font Size Control */}
      <div className="flex gap-5 flex-wrap mb-6 bg-white p-4 rounded shadow">
        
        {/* 1. 📝 DOCX File (ΠΡΩΤΟ) */}
        <label className="flex flex-col gap-1 text-sm font-medium w-48 bg-gray-50 p-2 rounded border border-gray-300">
          <span className="text-gray-700 font-bold">📝 1. Word (.docx):</span>
          <span className={`text-xs truncate ${docFileName === "Επιλέξτε αρχείο..." ? 'text-gray-500' : 'text-green-700 font-semibold'}`}>
            {docFileName}
          </span>
          <input 
             type="file" 
             accept=".docx" 
             onChange={handleDoc} 
             className="hidden" 
             ref={docInputRef} 
          />
        </label>
        
        {/* 2. 📄 Template File (ΔΕΥΤΕΡΟ & DISABLED) */}
        <label 
          className={`flex flex-col gap-1 text-sm font-medium w-48 p-2 rounded border ${disabledBorder} ${disabledStyle}`}
          title={isTemplateEnabled ? "" : "Επιλέξτε πρώτα Word αρχείο (Βήμα 1)"}
        >
          <span className="text-gray-700 font-bold">📄 2. Template (JPEG/PNG):</span>
          <span className={`text-xs truncate ${templateFileName === "Επιλέξτε αρχείο..." ? 'text-gray-500' : 'text-green-700 font-semibold flex items-center gap-1'}`}>
            {templateFileName === "Επιλέξτε αρχείο..." ? templateFileName : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {templateFileName}
                </>
            )}
          </span>
          <input 
             type="file" 
             accept="image/*" 
             onChange={handleTemplate} 
             className="hidden" 
             ref={templateInputRef} 
             disabled={!isTemplateEnabled} // <--- ΚΡΙΣΙΜΟ: Απενεργοποίηση του input
          />
        </label>
        
        {/* Font Size Control (Παραμένει τρίτο) */}
        <label className="flex flex-col gap-1 text-sm font-medium w-48">
          {/* ... (Font Size UI) ... */}
        </label>
      </div>

      {/* ... (Rest of the component remains the same) ... */}
    </div>
  );
}