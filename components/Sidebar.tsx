
import React from 'react';
import { LayoutDashboard, Radio, Workflow, Film, BarChart3, Settings, Mic2, Server, Bot, UploadCloud, Youtube, PlaySquare, Music, BrainCircuit, ShieldCheck } from 'lucide-react';

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
    { id: 'youtube_connect', label: 'ربط يوتيوب (OAuth)', icon: Youtube },
  ];

  const renderItem = (item: any) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`w-full flex items-center space-x-3 space-x-reverse px-4 py-2.5 rounded-lg transition-all duration-200 text-sm ${
          isActive 
            ? 'bg-blue-600/10 text-blue-500 border border-blue-600/20' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
      >
        <Icon size={18} />
        <span className="font-medium">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col h-screen fixed right-0 top-0 overflow-y-auto">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-blue-500 tracking-wider">VIDEO FACTORY</h1>
        <p className="text-xs text-slate-500 mt-1">Automated OS v2.0</p>
      </div>
      
      <div className="flex-1 p-4 space-y-6">
        <div>
          <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">العمليات</p>
          <nav className="space-y-1">
            {mainItems.map(renderItem)}
          </nav>
        </div>

        <div>
          <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">البنية التحتية</p>
          <nav className="space-y-1">
            {infrastructureItems.map(renderItem)}
          </nav>
        </div>

        <div>
          <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">النظام</p>
          <nav className="space-y-1">
             {renderItem({ id: 'admin_arabic', label: 'المشرف الإداري', icon: ShieldCheck })}
             {renderItem({ id: 'admin_agent', label: 'وكيل النظام (Legacy)', icon: BrainCircuit })} 
             {renderItem({ id: 'analytics', label: 'التحليلات', icon: BarChart3 })}
             {renderItem({ id: 'settings', label: 'الإعدادات', icon: Settings })}
          </nav>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
            AD
          </div>
          <div className="text-sm">
            <p className="text-slate-200">Admin User</p>
            <p className="text-slate-500 text-xs">System Architect</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
