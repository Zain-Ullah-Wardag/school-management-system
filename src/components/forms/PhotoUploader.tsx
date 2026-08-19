import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, RefreshCw, X } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { useToast } from '../../context/ToastContext';
import { apiError } from '../../services/api';
import { Avatar } from '../common/Avatar';

export function PhotoUploader({ value, onChange, name = 'Photo' }: { value?: string | null; onChange: (path: string) => void; name?: string }) {
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const result = await schoolApi.upload(file);
      onChange(result.path);
      toast('success', 'Photo uploaded');
    } catch (error) {
      toast('error', 'Photo upload failed', apiError(error));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!cameraOpen) return;
    let active = true;

    const connectCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support camera capture');
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        if (!active) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = media;
        const video = videoRef.current;
        if (!video) throw new Error('Camera preview is unavailable');
        video.srcObject = media;
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
          if (video.readyState >= HTMLMediaElement.HAVE_METADATA) resolve();
        });
        await video.play();
        if (active) setCameraReady(true);
      } catch (error) {
        if (active) {
          setCameraOpen(false);
          toast('error', 'Camera is unavailable', error instanceof Error ? error.message : 'Allow camera permission or upload an image instead.');
        }
      }
    };

    void connectCamera();
    return () => {
      active = false;
      stopCamera();
    };
  }, [cameraOpen]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !cameraReady || video.videoWidth < 1 || video.videoHeight < 1) {
      toast('error', 'Camera is not ready', 'Wait for the live preview before capturing a photo.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        toast('error', 'Photo capture failed', 'The camera did not return image data.');
        return;
      }
      void upload(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      setCameraOpen(false);
    }, 'image/jpeg', 0.92);
  };

  return <div className="flex flex-wrap items-center gap-3">
    <Avatar src={value} name={name} className="h-16 w-16 rounded-2xl text-base" />
    <div className="flex flex-wrap gap-2">
      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ''; }} />
        <ImagePlus className="h-4 w-4" /> Upload
      </label>
      <button type="button" onClick={() => setCameraOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Camera className="h-4 w-4" /> Camera</button>
      {value && <button type="button" onClick={() => onChange('')} className="inline-flex h-9 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"><X className="h-4 w-4" /> Remove</button>}
      {busy && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
    </div>

    {cameraOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white p-4 shadow-float">
        <div className="mb-3 flex items-center justify-between"><div><p className="font-bold text-slate-800">Capture student photo</p><p className="text-xs text-slate-500">Allow camera access, then wait for the live preview.</p></div><button type="button" onClick={() => setCameraOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        <div className="relative overflow-hidden rounded-2xl bg-slate-900"><video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />{!cameraReady && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/65 text-sm font-semibold text-white"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting camera…</div>}</div>
        <div className="mt-4 flex justify-between gap-2"><button type="button" onClick={() => { stopCamera(); setCameraOpen(false); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Cancel</button><div className="flex gap-2"><button type="button" onClick={() => { stopCamera(); setCameraReady(false); setCameraOpen(false); window.setTimeout(() => setCameraOpen(true), 0); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"><RefreshCw className="h-4 w-4" /></button><button type="button" disabled={!cameraReady || busy} onClick={capture} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Camera className="h-4 w-4" /> Capture photo</button></div></div>
      </div>
    </div>}
  </div>;
}
