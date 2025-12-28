import React, { useState, useEffect } from 'react';
import HomeView from './views/HomeView';
import CategoryView from './views/CategoryView';
import ProfileView from './views/ProfileView';
import BottomNav from './components/BottomNav';
import LoadingSpinner from './components/LoadingSpinner';
import { ViewState, Topic } from './types';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  
  // Navigation Parameter for Home View (e.g., filter by category ID)
  const [homeInitialCategoryId, setHomeInitialCategoryId] = useState<string | null>(null);

  // Initial Topic Load
  useEffect(() => {
    const initTopic = async () => {
      try {
        // 1. Check if we have topics
        const { data: topics, error } = await supabase
          .from('topics')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1);

        if (error) throw error;

        if (topics && topics.length > 0) {
          setCurrentTopic(topics[0]);
        } else {
          // 2. If no topics, create default "My Collection"
          const { data: newTopic, error: createError } = await supabase
            .from('topics')
            .insert([{ name: 'My Collection' }])
            .select()
            .single();
          
          if (createError) throw createError;
          setCurrentTopic(newTopic);
        }
      } catch (err) {
        console.error("Failed to initialize topic", err);
      } finally {
        setInitLoading(false);
      }
    };

    initTopic();
  }, []);

  const handleSwitchTopic = (topic: Topic) => {
    setCurrentTopic(topic);
    setCurrentView(ViewState.HOME); // Go back to home when switching
  };

  const handleSelectCategory = (categoryId: string) => {
      setHomeInitialCategoryId(categoryId);
      setCurrentView(ViewState.HOME);
  };

  const handleUpdateTopic = (updatedTopic: Topic) => {
      setCurrentTopic(updatedTopic);
  };

  const renderView = () => {
    if (initLoading) return <div className="flex h-full items-center justify-center"><LoadingSpinner /></div>;
    if (!currentTopic) return <div className="flex h-full items-center justify-center text-slate-500">Error loading collection.</div>;

    switch (currentView) {
      case ViewState.HOME:
        return <HomeView 
            currentTopic={currentTopic} 
            initialCategoryId={homeInitialCategoryId}
            onClearInitialCategory={() => setHomeInitialCategoryId(null)}
            onUpdateTopic={handleUpdateTopic}
        />;
      case ViewState.CATEGORY:
        return <CategoryView currentTopic={currentTopic} onSelectCategory={handleSelectCategory} />;
      case ViewState.PROFILE:
        return <ProfileView currentTopic={currentTopic} onSwitchTopic={handleSwitchTopic} />;
      default:
        return <HomeView currentTopic={currentTopic} onUpdateTopic={handleUpdateTopic} onClearInitialCategory={() => setHomeInitialCategoryId(null)} />;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto min-h-screen relative flex flex-col shadow-2xl overflow-hidden bg-background-light dark:bg-background-dark">
      <div className="absolute inset-0 bubble-pattern opacity-50 pointer-events-none z-0"></div>
      
      {/* View Container */}
      <div className="flex-1 relative z-10 h-[calc(100vh-80px)] overflow-hidden">
        {renderView()}
      </div>

      {/* Navigation */}
      <BottomNav currentView={currentView} setView={setCurrentView} />
    </div>
  );
};

export default App;
