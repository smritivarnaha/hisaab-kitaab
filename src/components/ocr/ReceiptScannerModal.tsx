import React, { useState, useRef } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { processReceiptImage } from '../../services/ocr/ocrService';
import { ReceiptData } from '../../types/finance';
import { Camera, Upload, Check, RefreshCw, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const ReceiptScannerModal: React.FC<Props> = ({ onClose }) => {
  const { addTransaction } = useFinance();
  const [isScanning, setIsScanning] = useState(false);
  const [ocrData, setOcrData] = useState<ReceiptData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setIsScanning(true);

    try {
      const data = await processReceiptImage(file);
      setOcrData(data);
    } catch (err) {
      console.error('Receipt OCR failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleStartCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access denied:', err);
      setIsCameraActive(false);
    }
  };

  const handleCaptureCamera = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'camera_receipt.jpg', { type: 'image/jpeg' });
      setImagePreview(URL.createObjectURL(file));

      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setIsCameraActive(false);

      setIsScanning(true);
      try {
        const data = await processReceiptImage(file);
        setOcrData(data);
      } catch (err) {
        console.error('OCR failed:', err);
      } finally {
        setIsScanning(false);
      }
    }, 'image/jpeg');
  };

  const handleSaveReceipt = () => {
    if (!ocrData) return;

    addTransaction({
      id: `tx_ocr_${Date.now()}`,
      amount: ocrData.totalAmount,
      currency: 'Rs.',
      type: 'expense',
      category: ocrData.items[0]?.category || 'Grocery',
      title: ocrData.merchant || 'Receipt Expense',
      merchant: ocrData.merchant,
      paymentMethod: 'UPI',
      date: ocrData.date,
      timestamp: Date.now(),
      confidenceScore: ocrData.confidence,
      rawInput: `OCR Receipt: ${ocrData.merchant}`,
      notes: `Receipt from ${ocrData.merchant} (${ocrData.items.length} items)`,
      isPending: false
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 font-outfit">
      <div className="bg-[#F3F5F1] w-full max-w-md rounded-3xl border border-[#E2E8E0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 bg-[#0D2E14] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#93E044]" />
            <h3 className="font-extrabold text-sm text-white">Live Camera / Receipt Scanner</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {!imagePreview && !isCameraActive && (
            <div className="space-y-3 text-center">
              <button
                onClick={handleStartCamera}
                className="w-full py-8 border-2 border-dashed border-[#0D2E14] bg-white rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-[#E4ECE2] transition-colors"
              >
                <Camera className="w-8 h-8 text-[#0D2E14]" />
                <span className="text-xs font-black text-[#0D2E14]">Open Phone / Web Camera Viewfinder</span>
              </button>

              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">- OR -</div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-white border border-[#E2E8E0] rounded-xl text-xs font-extrabold text-[#0D2E14] flex items-center justify-center gap-2 hover:bg-[#E4ECE2]"
              >
                <Upload className="w-4 h-4" />
                Upload Receipt Image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-3/4 flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-8 border-2 border-dashed border-[#93E044] rounded-2xl pointer-events-none flex items-center justify-center">
                <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded">Align Bill / Receipt</span>
              </div>
              <button
                onClick={handleCaptureCamera}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-full bg-[#93E044] text-[#0D2E14] font-black text-xs shadow-lg active:scale-95"
              >
                Snap Receipt
              </button>
            </div>
          )}

          {imagePreview && (
            <div className="space-y-3">
              <img src={imagePreview} alt="Receipt preview" className="w-full h-44 object-cover rounded-2xl border border-[#E2E8E0]" />

              {isScanning && (
                <div className="p-4 bg-white rounded-2xl border border-[#E2E8E0] flex items-center justify-center gap-2 text-xs font-bold text-[#0D2E14] animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#0D2E14]" />
                  <span>AI OCR is extracting receipt total...</span>
                </div>
              )}

              {ocrData && !isScanning && (
                <div className="p-3 bg-white rounded-2xl border border-[#E2E8E0] space-y-2 text-xs">
                  <div className="flex justify-between font-extrabold text-[#0D2E14]">
                    <span>Merchant:</span>
                    <span>{ocrData.merchant}</span>
                  </div>
                  <div className="flex justify-between font-black text-[#D93025] text-sm">
                    <span>Total Amount:</span>
                    <span>Rs. {ocrData.totalAmount}</span>
                  </div>

                  <button
                    onClick={handleSaveReceipt}
                    className="w-full py-2.5 rounded-full bg-[#93E044] text-[#0D2E14] font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Save Extracted Receipt
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
