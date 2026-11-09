import React, { useRef, useState, useEffect } from 'react';
import { compressImageFile } from '../lib/imageUtils';

interface CameraCaptureProps {
  label: string;
  onCapture: (base64: string) => void;
  existingImage: string | null;
  disabled?: boolean;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ label, onCapture, existingImage, disabled = true }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(existingImage);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setPreview(existingImage);
  }, [existingImage]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      // Compress and scale photo to max 1024px, 0.72 quality JPEG (~50KB-80KB)
      // This eliminates the 18MB payload error completely
      const optimizedBase64 = await compressImageFile(file, {
        maxDimension: 1024,
        quality: 0.72,
        mimeType: 'image/jpeg'
      });

      setPreview(optimizedBase64);
      onCapture(optimizedBase64);
    } catch (err) {
      console.warn("Image capture compression error:", err);
      // Fallback: standard reader if compression threw
      const reader = new FileReader();
      reader.onloadend = () => {
        const raw = reader.result as string;
        setPreview(raw);
        onCapture(raw);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessing(false);
      // Reset input value so taking another photo with the same name works
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onCapture('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-2xl border border-gray-200">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{label}</span>
        {preview && !isProcessing && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-widest transition"
          >
            Remove
          </button>
        )}
      </div>
      
      <div className="relative w-full aspect-video bg-gray-200 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center gap-2 text-indigo-600">
            <svg className="animate-spin h-6 w-6 text-indigo-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Optimizing Image...</span>
          </div>
        ) : preview ? (
          <img src={preview} alt="Capture" className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400 flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            <span className="text-xs mt-1 font-medium">No Image Attached</span>
          </div>
        )}
      </div>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        disabled={isProcessing || disabled}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed active:scale-95 shadow-sm uppercase tracking-wider"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        {disabled ? 'Photo Upload Paused' : preview ? 'Retake Photo' : 'Take Photo'}
      </button>
    </div>
  );
};

export default CameraCapture;
