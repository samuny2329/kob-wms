/**
 * Full-page loading screen — shown during app initialization
 */
export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      {/* Logo / Brand */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <span className="text-white font-extrabold text-2xl">WMS</span>
        </div>
      </div>

      {/* Spinner */}
      <div className="relative w-12 h-12 mb-6">
        <div className="absolute inset-0 border-4 border-slate-700 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin" />
      </div>

      {/* Text */}
      <p className="text-slate-400 text-sm font-medium tracking-wide">
        Loading WMS Pro...
      </p>

      <p className="text-slate-600 text-xs mt-2">
        Enterprise Warehouse Management System
      </p>
    </div>
  );
}
