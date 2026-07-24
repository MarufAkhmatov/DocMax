import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
// Vite ?url — worker faylini alohida asset sifatida bundle qiladi (dev va build ikkalasida ham ishlaydi).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.2;
// Ba'zi brauzer/GPU muhitlarida pdf.js render() hech qachon tugamasligi (hang) kuzatilgan —
// bu holatda cheksiz spinner qoldirmasdan brauzer native PDF ko'rinishiga (iframe) tushiladi.
const RENDER_TIMEOUT_MS = 8000;

/** TZ-1 §1.3 — PDF preview pdf.js orqali: sahifama-sahifa navigatsiya + zoom. pdf.js
 * render() muvaffaqiyatsiz/osilib qolsa (ba'zi muhitlarda kuzatilgan), brauzerning
 * o'zining PDF ko'rinishiga (oddiy <iframe>, avvalgi yagona yondashuv) qaytadi. */
export default function PdfViewer({
  url, height = 600, panel, panelBorder, txt, txt2, txt3, isDark, overlay,
}: {
  url: string;
  height?: number;
  panel: string; panelBorder: string; txt: string; txt2: string; txt3: string; isDark: boolean;
  /** Yuklab olish taqiqlangan rejimida watermark kabi qatlamlar uchun (TZ-2 §2.5). */
  overlay?: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);

  // Hujjat yuklash — url o'zgarganda qayta
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFallback(false);
    setPageNumber(1);
    docRef.current?.destroy();
    docRef.current = null;

    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch(() => {
        // pdf.js hujjatni yuklay olmasa ham (worker/render bilan bog'liq muhit-xos
        // muammolar kuzatilgan) — foydalanuvchi xato xabari o'rniga brauzerning
        // o'z PDF ko'rinishini ko'radi (pastdagi render-timeout fallback bilan bir xil falsafa).
        if (!cancelled) {
          setFallback(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [url]);

  // Sahifa render — pageNumber/scale/doc o'zgarganda; muddati o'tsa native iframe'ga tushadi
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || loading) {
      return;
    }
    let cancelled = false;
    let settled = false;
    const timer = setTimeout(() => {
      if (!cancelled && !settled) {
        settled = true;
        setFallback(true);
      }
    }, RENDER_TIMEOUT_MS);

    doc.getPage(pageNumber).then((page) => {
      if (cancelled) {
        return;
      }
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      renderTaskRef.current?.cancel();
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      task.promise
        .then(() => {
          settled = true;
          clearTimeout(timer);
        })
        .catch(() => {
          // sahifa almashtirilganda oldingi render bekor qilinishi kutilgan holat — jim o'tkaziladi
          settled = true;
          clearTimeout(timer);
        });
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, scale, loading, numPages]);

  if (fallback) {
    return (
      <div className="relative rounded-xl overflow-hidden" style={{ height, border: `1px solid ${panelBorder}` }}>
        <iframe src={url} title="PDF" style={{ width: "100%", height: "100%", border: "none" }} />
        {overlay}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1 || loading}
            className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-[11.5px] font-bold" style={{ color: txt2, minWidth: 64, textAlign: "center" }}>
            {loading ? "…" : `${pageNumber} / ${numPages}`}
          </span>
          <button onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages || loading}
            className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)))} disabled={scale <= MIN_SCALE}
            className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
            <ZoomOut size={14} />
          </button>
          <span className="text-[11.5px] font-bold" style={{ color: txt2, minWidth: 40, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)))} disabled={scale >= MAX_SCALE}
            className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" style={{ background: panel, border: `1px solid ${panelBorder}`, color: txt2 }}>
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
      <div className="rounded-xl overflow-auto flex justify-center relative"
        style={{ height, border: `1px solid ${panelBorder}`, background: isDark ? "rgba(0,0,0,.25)" : "rgba(0,0,0,.03)" }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin" style={{ color: txt3 }} />
          </div>
        )}
        <canvas ref={canvasRef} style={{ margin: "16px auto", boxShadow: "0 4px 20px rgba(0,0,0,.25)", display: loading ? "none" : "block" }} />
        {!loading && overlay}
      </div>
    </div>
  );
}
