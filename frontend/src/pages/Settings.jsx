export default function Settings() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Settings</h1>
      <p className="text-slate-500 font-medium mb-10">Configure your application preferences.</p>
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
        <p className="text-slate-500">Global settings will be displayed here.</p>
      </div>
    </div>
  );
}
