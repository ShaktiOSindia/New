import { useState } from 'react';
import type { MetaFunction } from '@remix-run/cloudflare';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const meta: MetaFunction = () => [
  { title: 'PDF मित्र – हिंदी PDF टूल्स (भारतीय स्पर्श)' },
  { name: 'description', content: 'PDF जोड़ें, विभाजित करें, और इमेज से PDF – हिंदी UI के साथ सरल और तेज़।' },
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function PdfMitraPage() {
  const [activeTab, setActiveTab] = useState<'merge' | 'split' | 'img2pdf'>('merge');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleMerge(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMessage('PDF जोड़ना जारी है…');
    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of Array.from(files)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const src = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(src, src.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));
      }
      const pdfBytes = await mergedPdf.save({ useObjectStreams: true });
      saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), 'merged.pdf');
      setMessage('हो गया! merged.pdf डाउनलोड हो गया।');
    } catch (err) {
      console.error(err);
      setMessage('त्रुटि: फाइलें जोड़ते समय समस्या आई।');
    } finally {
      setBusy(false);
    }
  }

  async function handleSplit(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMessage('PDF विभाजित किया जा रहा है…');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await PDFDocument.load(bytes);
      const pageCount = pdf.getPageCount();
      const zip = new JSZip();

      for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [copied] = await newPdf.copyPages(pdf, [i]);
        newPdf.addPage(copied);
        const out = await newPdf.save({ useObjectStreams: true });
        zip.file(`page-${i + 1}.pdf`, out);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'split-pages.zip');
      setMessage('हो गया! split-pages.zip डाउनलोड हो गया।');
    } catch (err) {
      console.error(err);
      setMessage('त्रुटि: विभाजन के दौरान समस्या आई।');
    } finally {
      setBusy(false);
    }
  }

  async function handleImagesToPdf(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMessage('इमेज से PDF बनाया जा रहा है…');
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const file of Array.from(files)) {
        const src = URL.createObjectURL(file);
        const img = await loadImage(src);
        // Convert to JPEG to help reduce size
        const { dataUrl, width, height } = await imageToJpegDataUrl(img, 1600, 1600, 0.8);
        const imgBytes = dataUrlToUint8Array(dataUrl);

        let embedded;
        if (dataUrl.startsWith('data:image/png')) {
          embedded = await pdfDoc.embedPng(imgBytes);
        } else {
          embedded = await pdfDoc.embedJpg(imgBytes);
        }

        const page = pdfDoc.addPage();
        const { width: pw, height: ph } = page.getSize();

        // Fit within page with margin
        const margin = 36; // 0.5 inch
        const maxW = pw - margin * 2;
        const maxH = ph - margin * 2;
        const scale = Math.min(maxW / width, maxH / height);
        const drawW = Math.max(1, Math.min(maxW, width * scale));
        const drawH = Math.max(1, Math.min(maxH, height * scale));
        const x = (pw - drawW) / 2;
        const y = (ph - drawH) / 2;

        page.drawImage(embedded, { x, y, width: drawW, height: drawH });
        page.setFont(font);
      }

      const bytes = await pdfDoc.save({ useObjectStreams: true });
      saveAs(new Blob([bytes], { type: 'application/pdf' }), 'images.pdf');
      setMessage('हो गया! images.pdf डाउनलोड हो गया।');
    } catch (err) {
      console.error(err);
      setMessage('त्रुटि: इमेज से PDF बनाते समय समस्या आई।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full w-full bg-bolt-elements-background-depth-1">
      <div className="w-full bg-gradient-to-r from-orange-500 via-white to-green-600 dark:via-slate-900 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-3xl font-bold">PDF मित्र</h1>
          <p className="opacity-80 mt-1">हिंदी में सरल PDF टूल्स – जोड़ें, विभाजित करें, और इमेज से PDF।</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-4 py-6">
        <div className="flex gap-2 flex-wrap">
          <button
            className={classNames(
              'px-4 py-2 rounded border',
              activeTab === 'merge'
                ? 'bg-orange-500 text-white border-transparent'
                : 'bg-transparent text-bolt-elements-textPrimary border-bolt-elements-borderColor',
            )}
            onClick={() => setActiveTab('merge')}
          >
            PDF जोड़ें
          </button>
          <button
            className={classNames(
              'px-4 py-2 rounded border',
              activeTab === 'split'
                ? 'bg-orange-500 text-white border-transparent'
                : 'bg-transparent text-bolt-elements-textPrimary border-bolt-elements-borderColor',
            )}
            onClick={() => setActiveTab('split')}
          >
            PDF विभाजित करें
          </button>
          <button
            className={classNames(
              'px-4 py-2 rounded border',
              activeTab === 'img2pdf'
                ? 'bg-orange-500 text-white border-transparent'
                : 'bg-transparent text-bolt-elements-textPrimary border-bolt-elements-borderColor',
            )}
            onClick={() => setActiveTab('img2pdf')}
          >
            इमेज → PDF
          </button>
        </div>

        <div className="mt-6 border rounded-lg p-4 border-bolt-elements-borderColor">
          {activeTab === 'merge' && <MergeSection busy={busy} onSubmit={handleMerge} />}
          {activeTab === 'split' && <SplitSection busy={busy} onSubmit={handleSplit} />}
          {activeTab === 'img2pdf' && <Img2PdfSection busy={busy} onSubmit={handleImagesToPdf} />}
        </div>

        {message && (
          <div className="mt-4 text-sm text-bolt-elements-textSecondary">{message}</div>
        )}
      </div>
    </div>
  );
}

function MergeSection({ busy, onSubmit }: { busy: boolean; onSubmit: (files: FileList | null) => Promise<void> }) {
  const [files, setFiles] = useState<FileList | null>(null);
  return (
    <div>
      <h2 className="text-xl font-semibold">कई PDF फाइलें जोड़ें</h2>
      <p className="opacity-80 text-sm mt-1">दो या अधिक PDF चुनें और एक फाइल में मिला दें।</p>
      <div className="mt-4 flex flex-col gap-3">
        <input
          type="file"
          multiple
          accept="application/pdf"
          onChange={(e) => setFiles(e.target.files)}
        />
        <button
          className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60 w-fit"
          disabled={busy || !files || files.length < 2}
          onClick={() => onSubmit(files)}
        >
          {busy ? 'कृपया प्रतीक्षा करें…' : 'जोड़ें और डाउनलोड करें'}
        </button>
      </div>
    </div>
  );
}

function SplitSection({ busy, onSubmit }: { busy: boolean; onSubmit: (file: File | null) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div>
      <h2 className="text-xl font-semibold">PDF को पन्नों में विभाजित करें</h2>
      <p className="opacity-80 text-sm mt-1">प्रत्येक पन्ना अलग-अलग PDF के रूप में ZIP में डाउनलोड होगा।</p>
      <div className="mt-4 flex flex-col gap-3">
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button
          className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60 w-fit"
          disabled={busy || !file}
          onClick={() => onSubmit(file)}
        >
          {busy ? 'कृपया प्रतीक्षा करें…' : 'विभाजित करें और ZIP डाउनलोड करें'}
        </button>
      </div>
    </div>
  );
}

function Img2PdfSection({ busy, onSubmit }: { busy: boolean; onSubmit: (files: FileList | null) => Promise<void> }) {
  const [files, setFiles] = useState<FileList | null>(null);
  return (
    <div>
      <h2 className="text-xl font-semibold">इमेज से PDF बनाएँ</h2>
      <p className="opacity-80 text-sm mt-1">JPEG/PNG इमेज चुनें। हर इमेज को एक पन्ने पर फिट किया जाएगा।</p>
      <div className="mt-4 flex flex-col gap-3">
        <input type="file" multiple accept="image/*" onChange={(e) => setFiles(e.target.files)} />
        <button
          className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60 w-fit"
          disabled={busy || !files || files.length === 0}
          onClick={() => onSubmit(files)}
        >
          {busy ? 'कृपया प्रतीक्षा करें…' : 'PDF बनाएँ और डाउनलोड करें'}
        </button>
      </div>
    </div>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function imageToJpegDataUrl(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    resolve({ dataUrl, width: w, height: h });
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}