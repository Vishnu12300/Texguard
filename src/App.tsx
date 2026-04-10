import React, { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, Home as HomeIcon, ShieldCheck, AlertCircle, RefreshCw, ChevronLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { GoogleGenAI, Type } from "@google/genai";

// --- Gemini Initialization ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

// --- Types ---
interface PredictionResult {
  prediction: string;
  confidence: number;
  message: string;
}

// --- AI Logic ---
const getPrediction = async (base64Data: string, mimeType: string, retries = 2): Promise<PredictionResult> => {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing. Please add it to the Secrets panel.");
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: "Analyze this fabric image for defects. Categories: stain, hole, broken yarn, clean, not_fabric. Return JSON: {prediction: string, confidence: number, message: string}. If prediction is 'not_fabric', message should be 'This is not a fabric'.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prediction: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            message: { type: Type.STRING },
          },
          required: ["prediction", "confidence", "message"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retrying prediction... (${retries} left)`);
      await new Promise(r => setTimeout(r, 1000));
      return getPrediction(base64Data, mimeType, retries - 1);
    }
    console.error("Prediction error:", error);
    throw error;
  }
};

// --- Components ---

const ResultDisplay = ({ result, loading }: { result: PredictionResult | null; loading: boolean }) => {
  if (loading) {
    return (
      <div className="space-y-3 w-full max-w-md mx-auto mt-6">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    );
  }

  if (!result || !result.prediction) return null;

  const isDefect = ["stain", "hole", "broken yarn"].includes(result.prediction);
  const isNotFabric = result.prediction === "not_fabric";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto mt-6"
    >
      <Card className={cn(
        "border-2",
        isDefect ? "border-destructive bg-destructive/5" : 
        isNotFabric ? "border-yellow-500 bg-yellow-500/5" : "border-green-500 bg-green-500/5"
      )}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-bold">Detection Result</CardTitle>
            <Badge variant={isDefect ? "destructive" : isNotFabric ? "outline" : "default"} className="capitalize">
              {(result.prediction || "").replace("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold mb-1">{result.message}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  isDefect ? "bg-destructive" : isNotFabric ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${(result.confidence || 0) * 100}%` }}
              />
            </div>
            <span className="whitespace-nowrap font-mono">{((result.confidence || 0) * 100).toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const Home = ({ onStartLive, onStartUpload }: { onStartLive: () => void; onStartUpload: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="mb-8"
    >
      <div className="bg-primary/10 p-6 rounded-full mb-6 inline-block">
        <ShieldCheck className="w-16 h-16 text-primary" />
      </div>
      <h1 className="text-5xl font-black tracking-tighter mb-4">Tex GUARD AI</h1>
      <p className="text-xl text-muted-foreground max-w-lg mx-auto">
        Next-generation fabric defect detection powered by advanced computer vision.
        Ensure quality with real-time scanning and instant analysis.
      </p>
    </motion.div>

    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
      <Button size="lg" className="flex-1 h-16 text-lg font-bold gap-2" onClick={onStartLive}>
        <Camera className="w-6 h-6" />
        Live Detection
      </Button>
      <Button size="lg" variant="outline" className="flex-1 h-16 text-lg font-bold gap-2" onClick={onStartUpload}>
        <Upload className="w-6 h-6" />
        Upload Image
      </Button>
    </div>

    <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-4xl">
      <div className="space-y-2">
        <h3 className="font-bold text-lg">Real-time Analysis</h3>
        <p className="text-sm text-muted-foreground">Instant feedback from your camera feed with sub-second inference times.</p>
      </div>
      <div className="space-y-2">
        <h3 className="font-bold text-lg">Multi-Defect Support</h3>
        <p className="text-sm text-muted-foreground">Detects stains, holes, and broken yarns with high precision.</p>
      </div>
      <div className="space-y-2">
        <h3 className="font-bold text-lg">Confidence Scoring</h3>
        <p className="text-sm text-muted-foreground">Every detection includes a confidence metric to ensure reliability.</p>
      </div>
    </div>
  </div>
);

const LiveDetection = ({ onBack }: { onBack: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutoScanning, setIsAutoScanning] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraReady(true);
        setError(null);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please ensure permissions are granted.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsAnalyzing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Resize to max 640px for better performance and to avoid proxy errors
    const maxDim = 640;
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    if (width > height) {
      if (width > maxDim) {
        height *= maxDim / width;
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width *= maxDim / height;
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const imageData = canvas.toDataURL("image/jpeg", 0.6);

      try {
        const data = await getPrediction(imageData.split(",")[1], "image/jpeg");
        setResult(data);
      } catch (err) {
        console.error("Analysis error:", err);
        setError("Failed to analyze frame.");
      } finally {
        setIsAnalyzing(false);
      }
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoScanning && isCameraReady && !isAnalyzing) {
      interval = setInterval(captureAndAnalyze, 3000);
    }
    return () => clearInterval(interval);
  }, [isAutoScanning, isCameraReady, isAnalyzing, captureAndAnalyze]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={onBack} className="mb-6 gap-2">
        <ChevronLeft className="w-4 h-4" /> Back to Home
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Card className="overflow-hidden bg-black aspect-video relative">
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                <div className="space-y-4">
                  <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                  <p className="text-white font-medium">{error}</p>
                  <Button onClick={startCamera}>Retry Camera</Button>
                </div>
              </div>
            ) : (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
                {!isCameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
                {result && ["stain", "hole", "broken yarn"].includes(result.prediction) && (
                  <div className="absolute inset-0 border-4 border-destructive animate-pulse pointer-events-none" />
                )}
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </Card>

          <div className="flex gap-4">
            <Button 
              className="flex-1 gap-2" 
              onClick={captureAndAnalyze} 
              disabled={!isCameraReady || isAnalyzing}
            >
              {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              Capture & Analyze
            </Button>
            <Button 
              variant={isAutoScanning ? "destructive" : "secondary"} 
              className="flex-1 gap-2"
              onClick={() => setIsAutoScanning(!isAutoScanning)}
              disabled={!isCameraReady}
            >
              {isAutoScanning ? "Stop Auto-Scan" : "Start Auto-Scan"}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Live Feed Control</h2>
            <p className="text-muted-foreground">
              Point your camera at the fabric. Use "Auto-Scan" for continuous monitoring or "Capture" for a single check.
            </p>
          </div>

          <ResultDisplay result={result} loading={isAnalyzing} />

          {result && (
            <Alert variant={["stain", "hole", "broken yarn"].includes(result.prediction) ? "destructive" : "default"}>
              <ShieldCheck className="h-4 h-4" />
              <AlertTitle>System Status</AlertTitle>
              <AlertDescription>
                {result.message}. Confidence: {(result.confidence * 100).toFixed(1)}%
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
};

const UploadDetection = ({ onBack }: { onBack: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
          try {
            const data = await getPrediction(base64, "image/jpeg");
            setResult(data);
          } catch (err) {
            console.error("Upload error:", err);
            setError("Failed to analyze image. Please try again.");
          } finally {
            setLoading(false);
          }
        };
      };
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to analyze image. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={onBack} className="mb-6 gap-2">
        <ChevronLeft className="w-4 h-4" /> Back to Home
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="p-8 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold">Upload Fabric Image</h3>
              <p className="text-sm text-muted-foreground">Supports JPG, PNG up to 10MB</p>
            </div>
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            <label 
              htmlFor="file-upload" 
              className={cn(buttonVariants({ variant: "secondary" }), "cursor-pointer")}
            >
              Select Image
            </label>
          </Card>

          {preview && (
            <Card className="overflow-hidden">
              <img src={preview} alt="Preview" className="w-full h-auto max-h-[400px] object-contain bg-muted" />
              <CardFooter className="p-4">
                <Button className="w-full gap-2" onClick={handleUpload} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Analyze Fabric
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Analysis Results</h2>
            <p className="text-muted-foreground">
              Upload a high-resolution image of the fabric for detailed defect analysis.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <ResultDisplay result={result} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<"home" | "live" | "upload">("home");

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {/* Navigation */}
      <header className="border-bottom border-line px-6 py-4 flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView("home")}>
          <ShieldCheck className="w-6 h-6 text-primary" />
          <span className="font-black tracking-tighter text-xl">Tex GUARD AI</span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <Button variant="ghost" className="text-sm font-medium" onClick={() => setView("home")}>Home</Button>
          <Button variant="ghost" className="text-sm font-medium" onClick={() => setView("live")}>Live Detection</Button>
          <Button variant="ghost" className="text-sm font-medium" onClick={() => setView("upload")}>Upload</Button>
        </nav>
      </header>

      <main className="container mx-auto py-8">
        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Home onStartLive={() => setView("live")} onStartUpload={() => setView("upload")} />
            </motion.div>
          )}
          {view === "live" && (
            <motion.div
              key="live"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <LiveDetection onBack={() => setView("home")} />
            </motion.div>
          )}
          {view === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <UploadDetection onBack={() => setView("home")} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-line mt-auto py-8 px-6 text-center text-sm text-muted-foreground">
        <p>© 2026 Tex GUARD AI. Advanced Fabric Quality Control System.</p>
      </footer>
    </div>
  );
}
