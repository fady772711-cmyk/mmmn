
import React, { useEffect, useState } from 'react';
import { ProductionJob, JobStatus } from '../types';
import { toast } from '../services/notificationService';
import { Play, Download, Clock, Search, Filter, Youtube, Wand2, RefreshCw, X } from 'lucide-react';
import { db } from '../services/storageService';

interface VideoLibraryProps {
    onEditJob?: (jobId: string) => void;
}

const VideoLibrary: React.FC<VideoLibraryProps> = ({ onEditJob }) => {
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
    let allJobs: ProductionJob[] = [];

    try {
        // Attempt Fetch from Server API
        const response = await fetch('/api/jobs');
        if (response.ok) {
            allJobs = await response.json();
        } else {
            throw new Error("Server API unavailable");
        }
    } catch (apiErr) {
        console.warn("API unavailable, falling back to local DB.", apiErr);
        // Fallback to local DB
        try {
            allJobs = await db.getJobs();
        } catch (dbErr) {
            console.error("Local DB load failed", dbErr);
        }
    }

    try {
        // Filter only completed jobs that have a final video URL
        const completed = allJobs.filter(j => {
            const isCompleted = j.status === JobStatus.COMPLETED || j.status === JobStatus.SKIPPED;
            const hasRootVideo = !!j.artifacts?.finalVideoUrl || !!j.artifacts?.videoUrl;
            
            // Check step artifacts for video if not found at root
            const hasStepVideo = j.steps.some(s => s.artifacts?.some(a => a.type === 'video' && a.url));
            
            return isCompleted && (hasRootVideo || hasStepVideo);
        });

        // Sort by newest
        completed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setJobs(completed);
        setFilteredJobs(completed);
    } catch (processError) {
        console.error("Error processing jobs list", processError);
    } finally {
        setLoading(false);
    }
  };

  const getVideoUrl = (job: ProductionJob): string | undefined => {
      if (job.artifacts?.finalVideoUrl) return job.artifacts.finalVideoUrl;
      if (job.artifacts?.videoUrl) return job.artifacts.videoUrl;
      
      // Search in steps
      for (const step of job.steps) {
          const videoArt = step.artifacts?.find(a => a.type === 'video' && a.url);
          if (videoArt) return videoArt.url;
      }
      return undefined;
  };

  const handlePlay = (job: ProductionJob) => {
      const url = getVideoUrl(job);
      if (url) {
          setPlayingVideo({ url, title: job.title });
      } else {
          toast.error("رابط الفيديو غير متوفر");
      }
  };

  const handleDownload = (job: ProductionJob) => {
      const url = getVideoUrl(job);
      if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.download = `${job.title.replace(/\s+/g, '_')}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast.success("بدأ تحميل الفيديو");
      } else {
          toast.error("الملف غير موجود");
      }
  };

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white">مكتبة الفيديوهات (Produced Videos)</h2>
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
            <button onClick={loadJobs} className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition" title="تحديث">
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {loading && jobs.length === 0 ? (
            <div className="flex justify-center items-center h-64 text-slate-500">جاري تحميل المكتبة...</div>
        ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                <Play size={48} className="opacity-20 mb-4" />
                <p>لا توجد فيديوهات مكتملة حتى الآن.</p>
                <p className="text-xs mt-2">انتقل إلى "خط الإنتاج" وقم بتشغيل محاكاة (Simulation) لإنشاء فيديو تجريبي.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
                {filteredJobs.map(job => {
                    const videoUrl = getVideoUrl(job);
                    return (
                        <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group hover:border-blue-500/50 transition duration-300 shadow-lg">
                            {/* Thumbnail Area */}
                            <div className="aspect-video bg-black relative overflow-hidden">
                                {videoUrl ? (
                                    <video 
                                        src={videoUrl} 
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-500"
                                        preload="metadata"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">No Video</div>
                                )}
                                
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-[2px]">
                                    <button 
                                        onClick={() => handlePlay(job)}
                                        className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-xl"
                                    >
                                        <Play size={20} className="ml-1" />
                                    </button>
                                </div>
                                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-md">
                                    {job.durationConfig?.target_minutes || '1'}:00
                                </div>
                                {job.type === 'smoke_test' && (
                                    <div className="absolute top-2 left-2 bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded shadow font-bold">
                                        TEST
                                    </div>
                                )}
                            </div>

                            {/* Info Area */}
                            <div className="p-4">
                                <h3 className="font-bold text-slate-200 line-clamp-1 mb-1" title={job.title}>{job.title}</h3>
                                <div className="flex justify-between items-center text-xs text-slate-500 mb-4">
                                    <span className="flex items-center gap-1 font-mono">
                                        <Clock size={12} /> {new Date(job.createdAt).toLocaleDateString()} 
                                    </span>
                                    <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded border border-green-500/20">Ready</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800">
                                    <button 
                                        onClick={() => handleDownload(job)}
                                        className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-xs transition"
                                        title="تحميل الفيديو"
                                    >
                                        <Download size={14} />
                                    </button>
                                    <button 
                                        onClick={() => onEditJob?.(job.id)}
                                        className="flex items-center justify-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-600/20 py-1.5 rounded text-xs transition"
                                        title="تعديل وإعادة بناء"
                                    >
                                        <Wand2 size={14} />
                                    </button>
                                    <button className="flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/20 py-1.5 rounded text-xs transition" title="نشر">
                                        <Youtube size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* Video Modal */}
      {playingVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-4xl bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col">
                  <div className="flex justify-between items-center p-4 border-b border-slate-800">
                      <h3 className="font-bold text-white">{playingVideo.title}</h3>
                      <button onClick={() => setPlayingVideo(null)} className="text-slate-400 hover:text-white transition bg-slate-800 p-1 rounded-full"><X size={20} /></button>
                  </div>
                  <div className="aspect-video bg-black flex items-center justify-center">
                      <video 
                        src={playingVideo.url} 
                        controls 
                        autoPlay 
                        className="w-full h-full" 
                      />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default VideoLibrary;
