import React, { useState } from 'react';
import { Doll } from '../types';

interface DollCardProps {
  doll: Doll;
  categoryName?: string;
  onClick: (doll: Doll) => void;
  onDelete?: (e: React.MouseEvent, dollId: string) => void;
}

const DollCard: React.FC<DollCardProps> = ({ doll, categoryName, onClick, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  // Logic for "NEW!" badge: created within last 30 days
  const isNew = React.useMemo(() => {
    const created = new Date(doll.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= 30;
  }, [doll.created_at]);

  const hasNormal = doll.size && doll.size.includes('Normal');
  const hasSmall = doll.size && doll.size.includes('Small');

  const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isDeleting) {
          if (onDelete) onDelete(e, doll.id);
      } else {
          setIsDeleting(true);
          // Reset after 3 seconds if not confirmed
          setTimeout(() => setIsDeleting(false), 3000);
      }
  };

  return (
    <div 
        onClick={() => onClick(doll)}
        className="group relative bg-white dark:bg-card-dark rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all active:scale-95 flex flex-col overflow-hidden cursor-pointer"
    >
      {isNew && (
        <span className="absolute top-1.5 right-1.5 bg-secondary text-white text-[7px] font-extrabold px-1.5 py-0.5 rounded-full shadow-sm z-10 animate-pulse">
          NEW!
        </span>
      )}
      
      {/* Delete Icon - Non-conspicuous */}
      {onDelete && (
        <div 
            onClick={handleDeleteClick}
            className={`absolute top-1.5 left-1.5 z-20 p-1 rounded-full transition-all duration-300 ${isDeleting ? 'bg-red-500 text-white opacity-100' : 'bg-white/50 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-red-500'}`}
        >
            <span className="material-icons-round text-[14px]">
                {isDeleting ? 'check' : 'delete'}
            </span>
        </div>
      )}

      <div className="p-2 pb-0 flex flex-col items-center flex-1">
        <div className="aspect-square w-full rounded-lg bg-blue-50 dark:bg-slate-800 mb-1.5 flex items-center justify-center relative overflow-hidden">
          {doll.image_url ? (
             <img 
                alt={doll.name} 
                className="w-full h-full object-cover mix-blend-normal" 
                src={doll.image_url} 
            />
          ) : (
            <span className="material-icons-round text-slate-300 text-4xl">image</span>
          )}
        </div>
        
        {/* Category Tag */}
        {categoryName && (
            <span className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-0.5">
                {categoryName}
            </span>
        )}

        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 text-center leading-tight line-clamp-2">
          {doll.name}
        </span>
        <span className="text-[9px] text-slate-400 dark:text-slate-500 mb-2 line-clamp-1">
          {doll.description || 'No description'}
        </span>
      </div>
      
      {/* Size Indicator Bar - Updated Colors */}
      <div className="mt-auto border-t border-slate-100 dark:border-slate-700 flex w-full text-[9px] font-bold">
        <div className={`flex-1 py-1.5 text-center transition-colors ${hasNormal ? 'bg-blue-400 text-white' : 'bg-uncollected dark:bg-uncollected-dark text-slate-400 dark:text-slate-500'}`}>
          Normal
        </div>
        <div className="w-px bg-slate-100 dark:bg-slate-700"></div>
        <div className={`flex-1 py-1.5 text-center transition-colors ${hasSmall ? 'bg-pink-400 text-white' : 'bg-uncollected dark:bg-uncollected-dark text-slate-400 dark:text-slate-500'}`}>
          Small
        </div>
      </div>
    </div>
  );
};

export default DollCard;
