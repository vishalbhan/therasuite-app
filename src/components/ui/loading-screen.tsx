import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center -my-24">
      <h1 className="text-xl font-bold text-violet-800 mb-4">
        TheraSuite
      </h1>
      <Loader2 className="h-8 w-8 animate-spin text-violet-800" />
    </div>
  );
} 