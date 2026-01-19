
import React from 'react';
import { LayoutDashboard, Radio, Workflow, Film, BarChart3, Settings, Mic2, Server, Bot, UploadCloud, Youtube, PlaySquare, Music, BrainCircuit, ShieldCheck, ChevronLeft } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const mainItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'channels', label: 'القنوات', icon: Radio },
    { id: 'production', label: 'خط الإنتاج', icon: Film },
    { id: 'library', label: 'مكتبة الفيديوهات', icon: PlaySquare },
    { id: 'automations', label: 'الأتمتة والجدولة', icon: Workflow },
  ];

  const infrastructureItems = [
    { id: 'providers', label: 'المزودات (APIs)', icon: Server },
    { id: 'voices', label: 'مكتبة الأصوات', icon: Mic2 },
    { id: 'music', label: 'مكتبة الموسيقى', icon: Music },
    { id: 'agents', label: 'الوكلاء', icon: Bot },
    { id: 'publishing', label: 'النشر (YouTube)', icon: UploadCloud },
    { id: 'youtube_connect', label: 'ربط يوتيوب', icon: Youtube },
  ];

  const systemItems = [
     { id: 'admin_arabic', label: 'المشرف الإداري', icon: ShieldCheck },
     { id: 'analytics', label: 'التحليلات', icon: BarChart3 },
     { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  const renderItem = (item: any) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`w-full group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm relative overflow-hidden ${
          isActive 
            ? 'bg-blue-600/10 text-blue-400 font-bold shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full"></div>}
        <Icon size={18} className={`transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span className="relative z-10">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="w-64 h-screen fixed right-0 top-0 flex flex-col border-l border-white/5 bg-slate-900/80 backdrop-blur-xl z-50 shadow-2xl">
      {/* Brand Header */}
      <div className="p-6 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                <Workflow size={18} className="text-white" />
            </div>
            <div>
                <h1 className="text-lg font-bold text-white tracking-wide font-sans">VIDEO FACTORY</h1>
                <p className="text-[10px] text-blue-400 font-mono tracking-widest">OS v2.1 PRO</p>
            </div>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar">
        <div>
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">العمليات الرئيسية</p>
          <nav className="space-y-1">
            {mainItems.map(renderItem)}
          </nav>
        </div>

        <div>
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">البنية التحتية</p>
          <nav className="space-y-1">
            {infrastructureItems.map(renderItem)}
          </nav>
        </div>

        <div>
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">إدارة النظام</p>
          <nav className="space-y-1">
             {systemItems.map(renderItem)}
          </nav>
        </div>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-white/5 bg-black/20">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-slate-800">
            AD
          </div>
          <div className="text-sm overflow-hidden">
            <p className="text-slate-200 font-bold truncate">Admin User</p>
            <p className="text-slate-500 text-[10px] truncate">System Architect</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
