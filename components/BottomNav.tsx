import React from 'react';
import { ViewState } from '../types';

interface BottomNavProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: ViewState.HOME, icon: 'home', label: 'Home' },
    { id: ViewState.CATEGORY, icon: 'category', label: 'Category' },
    { id: ViewState.PROFILE, icon: 'person', label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 w-full max-w-7xl bg-white/90 dark:bg-card-dark/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-700 px-6 py-4 z-30 left-1/2 -translate-x-1/2 transition-all pb-safe">
      <ul className="flex justify-around md:justify-center md:gap-20 items-center px-2">
        {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
                <li key={item.id}>
                <button 
                    onClick={() => setView(item.id)}
                    className="flex flex-col items-center gap-1 group w-16"
                >
                    <span className={`material-icons-round text-2xl transition-transform ${isActive ? 'text-primary scale-110' : 'text-slate-300 dark:text-slate-600 group-hover:text-primary'}`}>
                        {item.icon}
                    </span>
                    <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary font-bold' : 'text-slate-400 dark:text-slate-500 group-hover:text-primary'}`}>
                        {item.label}
                    </span>
                </button>
                </li>
            );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;
