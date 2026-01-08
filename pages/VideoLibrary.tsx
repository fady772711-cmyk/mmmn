import React, { useEffect, useState } from 'react';
import { ProductionJob, JobStatus } from '../types';
import { db } from '../services/storageService';
import { Play, Download, Clock, Search, Filter, Youtube, MoreVertical } from 'lucide-react';

const VideoLibrary: React.FC = () => {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Video Player Modal
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    const results = jobs.filter(job => 
        job.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredJobs(results);
  }, [searchTerm, jobs]);

  const loadJobs = async () => {
    setLoading(true);
    const allJobs = await db.getJobs();
    // Filter only completed jobs that have a video URL
    const completed = allJobs.filter(j => 
        (j.status === JobStatus.COMPLETED || j.status === JobStatus.SKIPPED) && 
        (j.artifacts?.finalVideoUrl || j.artifacts?.videoUrl)
    );
    // Sort by newest
    completed.sort((a, b) => parseInt(b.id.split('_')[1] || '0') - parseInt(a.id.split('_')[1] || '0'));
    
    setJobs(completed);
    setFilteredJobs(completed);
    setLoading(false);
  };

  const handlePlay = (job: ProductionJob) => {
      const url = job.artifacts?.finalVideoUrl || job.artifacts?.videoUrl;
      if (url) {
          setPlayingVideo({ url, title: job.title });
      }
  };

  const handleDownload = (job: ProductionJob) => {
      const url = job.artifacts?.finalVideoUrl || job.artifacts?.videoUrl;
      if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.download = `${job.title.replace(/\s+/g, '_')}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      }
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">مكتبة الفيديوهات</h2>
          <p className="text-slate-400">أرشيف الفيديوهات المكتملة والجاهزة للنشر</p>
        </div>
        
        <div className="flex gap-2">
            <div className="relative">
                <Search size={16} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500" />
                <input 
                    type="text" 
                    placeholder="بحث في المكتبة..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg pr-9 pl-4 py-2 text-sm text-white outline-none focus:border-blue-500 w-64"
                />
            </div>
            <button className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white">
                <Filter size={18} />
            </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
          <div className="flex justify-center items-center h-64 text-slate-500">جاري تحميل المكتبة...</div>
      ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <Play size={48} className="opacity-20 mb-4" />
              <p>لا توجد فيديوهات مكتملة حتى الآن.</p>
              <p className="text-xs mt-2">انتقل إلى "خط الإنتاج" لإنشاء فيديو جديد.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredJobs.map(job => (
                  <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group hover:border-blue-500/50 transition duration-300">
                      {/* Thumbnail Area */}
                      <div className="aspect-video bg-black relative">
                          <video 
                              src={job.artifacts?.finalVideoUrl || job.artifacts?.videoUrl} 
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-[2px]">
                              <button 
                                onClick={() => handlePlay(job)}
                                className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition"
                              >
                                  <Play size={20} className="ml-1" />
                              </button>
                          </div>
                          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-md">
                              {job.durationConfig?.target_minutes || '0'}:00
                          </div>
                          {job.visualConfig?.mode === 'video' && (
                              <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded shadow">
                                  VEO 3.1
                              </div>
                          )}
                      </div>

                      {/* Info Area */}
                      <div className="p-4">
                          <h3 className="font-bold text-slate-200 line-clamp-1 mb-1" title={job.title}>{job.title}</h3>
                          <div className="flex justify-between items-center text-xs text-slate-500 mb-4">
                              <span className="flex items-center gap-1">
                                  <Clock size={12} /> {new Date().toLocaleDateString()} 
                              </span>
                              <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded border border-green-500/20">جاهز</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
                              <button 
                                onClick={() => handleDownload(job)}
                                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-xs transition"
                              >
                                  <Download size={14} /> تحميل
                              </button>
                              <button className="flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/20 py-1.5 rounded text-xs transition">
                                  <Youtube size={14} /> نشر
                              </button>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* Video Modal */}
      {playingVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
              <div className="w-full max-w-4xl bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                  <div className="flex justify-between items-center p-4 border-b border-slate-800">
                      <h3 className="font-bold text-white">{playingVideo.title}</h3>
                      <button onClick={() => setPlayingVideo(null)} className="text-slate-400 hover:text-white">✕</button>
                  </div>
                  <div className="aspect-video bg-black">
                      <video 
                        src={playingVideo.url} 
                        controls 
                        autoPlay 
                        className="w-full h-full" 
                      />
                  </div>
                  <div className="p-4 flex justify-end gap-2 bg-slate-950">
                      <button onClick={() => setPlayingVideo(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">إغلاق</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default VideoLibrary;