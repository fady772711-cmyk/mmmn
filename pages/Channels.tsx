import React, { useEffect, useState } from 'react';
import { Channel } from '../types';
import { db } from '../services/storageService';
import { Edit2, Play, Pause, Plus, Save, X } from 'lucide-react';

const Channels: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Channel>>({});

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    const data = await db.getChannels();
    setChannels(data);
    setLoading(false);
  };

  const handleEdit = (channel: Channel) => {
    setIsEditing(channel.id);
    setEditForm(channel);
  };

  const handleCreate = () => {
    const newChannel: Channel = {
        id: `ch_${Date.now()}`,
        name: 'قناة جديدة',
        language: 'ar-SA',
        tone: 'Balanced',
        visualStyle: 'Modern',
        status: 'paused',
        createdAt: new Date().toISOString()
    };
    setIsEditing(newChannel.id);
    setEditForm(newChannel);
    // Optimistic UI
    setChannels(prev => [newChannel, ...prev]);
  };

  const handleSave = async () => {
    if (editForm && isEditing) {
        await db.saveChannel(editForm as Channel);
        setChannels(prev => prev.map(c => c.id === isEditing ? (editForm as Channel) : c));
        setIsEditing(null);
    }
  };

  const handleCancel = () => {
    setIsEditing(null);
    loadChannels(); // Revert
  };

  const toggleStatus = async (channel: Channel) => {
      const newStatus: 'active' | 'paused' = channel.status === 'active' ? 'paused' : 'active';
      const updated = { ...channel, status: newStatus };
      await db.saveChannel(updated);
      setChannels(prev => prev.map(c => c.id === channel.id ? updated : c));
  };

  if (loading) return <div className="text-center p-10 text-slate-500">جاري تحميل القنوات...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">إدارة القنوات</h2>
          <p className="text-slate-400">تهيئة ملفات التعريف للقنوات (Source of Truth)</p>
        </div>
        <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2">
          <Plus size={18} />
          <span>قناة جديدة</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {channels.map((channel) => (
          <div key={channel.id} className={`bg-slate-900 border rounded-xl overflow-hidden transition ${isEditing === channel.id ? 'border-blue-500 shadow-lg shadow-blue-900/20' : 'border-slate-800 hover:border-slate-700'}`}>
            <div className="p-6">
              {isEditing === channel.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-slate-500 block mb-1">اسم القناة</label>
                          <input 
                            value={editForm.name} 
                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">اللغة</label>
                            <input 
                                value={editForm.language} 
                                onChange={e => setEditForm({...editForm, language: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Tone</label>
                            <input 
                                value={editForm.tone} 
                                onChange={e => setEditForm({...editForm, tone: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
                            />
                        </div>
                      </div>
                      <div>
                          <label className="text-xs text-slate-500 block mb-1">Visual Style</label>
                          <input 
                            value={editForm.visualStyle} 
                            onChange={e => setEditForm({...editForm, visualStyle: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
                          />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                          <button onClick={handleCancel} className="p-2 text-slate-400 hover:text-white"><X size={18}/></button>
                          <button onClick={handleSave} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-500"><Save size={18}/></button>
                      </div>
                  </div>
              ) : (
                  // View Mode
                  <>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-900 to-slate-900 rounded-full flex items-center justify-center border border-slate-700 text-lg font-bold">
                            {channel.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white">{channel.name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            {channel.language}
                            </span>
                        </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleEdit(channel)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => toggleStatus(channel)} className={`p-2 rounded-lg ${channel.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {channel.status === 'active' ? <Pause size={16}/> : <Play size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-400 mt-4 bg-slate-950/50 p-4 rounded-lg">
                        <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tone</p>
                        <p className="text-slate-200">{channel.tone}</p>
                        </div>
                        <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Visual Style</p>
                        <p className="text-slate-200">{channel.visualStyle}</p>
                        </div>
                    </div>
                  </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Channels;