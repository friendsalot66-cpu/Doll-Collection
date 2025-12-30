import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Doll, Category, NewDollForm, Topic, SortOption, GridOption } from '../types';
import DollCard from '../components/DollCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { identifyDoll } from '../services/geminiService';
import { compressImage } from '../services/utils';

interface HomeViewProps {
  currentTopic: Topic;
  initialCategoryId?: string | null;
  onUpdateTopic: (topic: Topic) => void;
  onClearInitialCategory: () => void;
}

type FilterType = 'ALL' | 'NEW' | 'DATE_FILTER' | string;

const HomeView: React.FC<HomeViewProps> = ({ currentTopic, initialCategoryId, onUpdateTopic, onClearInitialCategory }) => {
  const [dolls, setDolls] = useState<Doll[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View/Sort State
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [dateFilterValue, setDateFilterValue] = useState<string>(''); // Format YYYY-MM
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [sortOption, setSortOption] = useState<SortOption>('DATE_DESC');
  const [gridOption, setGridOption] = useState<GridOption>('GRID_3');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showGridMenu, setShowGridMenu] = useState(false);

  // Edit Collection Name State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleName, setEditTitleName] = useState(currentTopic.name);

  // Detail/Edit Modal State
  const [selectedDoll, setSelectedDoll] = useState<Doll | null>(null);
  const [isEditingDoll, setIsEditingDoll] = useState(false);
  const [editDollData, setEditDollData] = useState<Partial<Doll> & { sizeArray?: string[] }>({});
  
  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [formData, setFormData] = useState<NewDollForm>({
    name: '',
    description: '',
    size: ['Normal'],
    category_id: '',
    catch_date: new Date().toISOString().split('T')[0],
    imageFile: null
  });

  const fetchData = async () => {
    if (!currentTopic) return;
    setLoading(true);
    try {
      const { data: dollsData, error: dollsError } = await supabase
        .from('dolls')
        .select('*')
        .eq('topic_id', currentTopic.id);
      
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('topic_id', currentTopic.id)
        .order('name');

      if (dollsError) throw dollsError;
      if (catError) throw catError;

      setDolls(dollsData || []);
      setCategories(catData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentTopic]);

  // Handle Redirect from Category Tab
  useEffect(() => {
      if (initialCategoryId) {
          setActiveFilter(initialCategoryId);
          onClearInitialCategory(); 
      }
  }, [initialCategoryId, onClearInitialCategory]);

  // Sync editing title
  useEffect(() => {
      setEditTitleName(currentTopic.name);
  }, [currentTopic]);

  // Filter & Sort Logic
  const processedDolls = useMemo(() => {
    let result = [...dolls];

    // Search Filter
    if (searchQuery) {
        result = result.filter(d => 
            d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }

    // Category/Date Filter
    if (activeFilter === 'NEW') {
        result = result.filter(d => {
            const created = new Date(d.created_at);
            const now = new Date();
            const diffDays = Math.ceil(Math.abs(now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays <= 30;
        });
    } else if (activeFilter === 'DATE_FILTER') {
        if (dateFilterValue) {
            // Check if catch_date string starts with YYYY-MM
            result = result.filter(d => d.catch_date && d.catch_date.startsWith(dateFilterValue));
        }
    } else if (activeFilter !== 'ALL') {
        result = result.filter(d => d.category_id === activeFilter);
    }

    // Sort
    result.sort((a, b) => {
        switch (sortOption) {
            case 'DATE_DESC': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            case 'DATE_ASC': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            case 'NAME_ASC': return a.name.localeCompare(b.name);
            case 'NAME_DESC': return b.name.localeCompare(a.name);
            default: return 0;
        }
    });

    return result;
  }, [dolls, activeFilter, dateFilterValue, sortOption, searchQuery]);

  const categoryMap = useMemo(() => {
      const map: Record<string, string> = {};
      categories.forEach(c => map[c.id] = c.name);
      return map;
  }, [categories]);

  // --- Collection Name Edit ---
  const saveTitleEdit = async () => {
    if(!editTitleName.trim()) return;
    try {
        const { error } = await supabase.from('topics').update({ name: editTitleName }).eq('id', currentTopic.id);
        if(error) throw error;
        onUpdateTopic({ ...currentTopic, name: editTitleName });
        setIsEditingTitle(false);
    } catch (e) {
        console.error(e);
        alert("Failed to update name.");
    }
  };

  // --- Delete Logic ---
  const handleDeleteDoll = async (e: React.MouseEvent, dollId: string) => {
      e.stopPropagation();
      try {
          const { error } = await supabase.from('dolls').delete().eq('id', dollId);
          if (error) throw error;
          setDolls(prev => prev.filter(d => d.id !== dollId));
          if (selectedDoll?.id === dollId) setSelectedDoll(null);
      } catch (err) {
          console.error(err);
          alert("Could not delete item.");
      }
  };

  // --- Add Logic ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, imageFile: e.target.files![0] }));
    }
  };

  const handleAiAutofill = async () => {
    if (!formData.imageFile) return alert("Please upload an image first.");
    setIsAiLoading(true);
    try {
      const aiData = await identifyDoll(formData.imageFile);
      
      let newSizes = [...formData.size];
      if (aiData.size) {
          newSizes = []; 
          if (aiData.size.includes('Normal')) newSizes.push('Normal');
          if (aiData.size.includes('Small')) newSizes.push('Small');
          if (newSizes.length === 0) newSizes.push('Normal');
      }

      setFormData(prev => ({
        ...prev,
        name: aiData.name || prev.name,
        description: aiData.description || prev.description,
        size: newSizes
      }));
    } catch (e) {
      console.error(e);
      alert("AI Analysis failed. Please try again.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSizeChange = (size: string) => {
      setFormData(prev => {
          const current = prev.size;
          if (current.includes(size)) {
              return { ...prev, size: current.filter(s => s !== size) };
          } else {
              return { ...prev, size: [...current, size] };
          }
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.imageFile) return alert("Image is required.");
    if (formData.size.length === 0) return alert("Please select at least one size.");
    
    setLoading(true);
    try {
      // Compress Image
      const compressedFile = await compressImage(formData.imageFile);

      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('dolls')
        .insert([{
          name: formData.name,
          description: formData.description,
          size: formData.size.join(', '), 
          category_id: formData.category_id || null,
          topic_id: currentTopic.id,
          catch_date: formData.catch_date,
          image_url: publicUrl
        }]);
      
      if (insertError) throw insertError;

      setIsAddModalOpen(false);
      setFormData({
        name: '', description: '', size: ['Normal'], category_id: '', catch_date: new Date().toISOString().split('T')[0], imageFile: null
      });
      fetchData();

    } catch (err) {
      console.error(err);
      alert("Failed to add doll. See console.");
    } finally {
      setLoading(false);
    }
  };

  // --- Edit Logic ---
  const openDetailModal = (doll: Doll) => {
      setSelectedDoll(doll);
      setEditDollData({
          ...doll,
          sizeArray: doll.size ? doll.size.split(',').map(s => s.trim()) : []
      });
      setIsEditingDoll(false);
  };

  const handleEditSizeChange = (size: string) => {
      setEditDollData(prev => {
          const current = prev.sizeArray || [];
          if (current.includes(size)) {
              return { ...prev, sizeArray: current.filter(s => s !== size) };
          } else {
              return { ...prev, sizeArray: [...current, size] };
          }
      });
  };

  const handleUpdateDoll = async () => {
      if (!selectedDoll) return;
      try {
          const sizeString = editDollData.sizeArray?.join(', ') || '';
          
          const { error } = await supabase
            .from('dolls')
            .update({
                name: editDollData.name,
                description: editDollData.description,
                size: sizeString, 
                catch_date: editDollData.catch_date,
                category_id: editDollData.category_id
            })
            .eq('id', selectedDoll.id);
          
          if (error) throw error;
          
          const updatedDoll = { 
              ...selectedDoll, 
              name: editDollData.name!,
              description: editDollData.description!,
              size: sizeString,
              catch_date: editDollData.catch_date!,
              category_id: editDollData.category_id!
          } as Doll;

          setDolls(prev => prev.map(d => d.id === updatedDoll.id ? updatedDoll : d));
          setSelectedDoll(updatedDoll);
          setIsEditingDoll(false);
      } catch (err) {
          console.error(err);
          alert("Failed to update.");
      }
  };

  const getGridClass = () => {
      switch(gridOption) {
          case 'GRID_2': return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
          case 'GRID_3': return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5';
          case 'GRID_4': return 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6';
          case 'LIST': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
          default: return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5';
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="relative z-40 px-6 pt-12 pb-4 bg-white/80 dark:bg-card-dark/80 backdrop-blur-md sticky top-0 border-b border-blue-100 dark:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-2 h-10">
                {/* Left: Search Toggle / Back (hidden) */}
                <button 
                    onClick={() => {
                        if (isSearchOpen) {
                            setIsSearchOpen(false); 
                            setSearchQuery(''); 
                        }
                    }}
                    className={`p-2 rounded-full transition-all ${isSearchOpen ? 'bg-slate-100 text-slate-600' : 'opacity-0 cursor-default'}`}
                >
                     <span className="material-icons-round">{isSearchOpen ? 'close' : 'arrow_back_ios_new'}</span>
                </button>

                {/* Center: Title OR Search Bar */}
                <div className="flex-1 flex justify-center mx-2">
                    {isSearchOpen ? (
                        <div className="w-full max-w-xs relative animate-in fade-in zoom-in-95 duration-200">
                            <input 
                                autoFocus
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-full py-2 px-4 text-sm focus:ring-2 focus:ring-primary/50"
                            />
                            <span className="material-icons-round absolute right-3 top-2 text-slate-400 text-sm">search</span>
                        </div>
                    ) : (
                        <div className="text-center group flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                             {isEditingTitle ? (
                                <input 
                                    autoFocus
                                    value={editTitleName} 
                                    onChange={e => setEditTitleName(e.target.value)} 
                                    onBlur={saveTitleEdit}
                                    onKeyDown={e => e.key === 'Enter' && saveTitleEdit()}
                                    className="bg-white border border-primary rounded px-2 py-0.5 text-center font-bold text-lg w-40"
                                />
                            ) : (
                                <div onClick={() => setIsEditingTitle(true)} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition">
                                    <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-800 dark:text-white tracking-wide truncate max-w-[200px]">
                                        {currentTopic.name}
                                    </h1>
                                    <span className="material-icons-round text-sm text-slate-300">edit</span>
                                </div>
                            )}
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                                {processedDolls.length} Collected
                            </p>
                        </div>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 relative">
                    {/* Search Trigger */}
                     {!isSearchOpen && (
                        <button 
                            onClick={() => setIsSearchOpen(true)}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        >
                            <span className="material-icons-round text-slate-500 dark:text-slate-300">search</span>
                        </button>
                     )}

                    {/* Grid Button */}
                    <button 
                        onClick={() => { setShowGridMenu(!showGridMenu); setShowSortMenu(false); }}
                        className="p-2 rounded-full bg-blue-50 dark:bg-slate-800 text-primary hover:bg-blue-100 dark:hover:bg-slate-700 transition shadow-sm"
                    >
                        <span className="material-icons-round">
                            {gridOption === 'LIST' ? 'view_list' : 'grid_view'}
                        </span>
                    </button>
                    {showGridMenu && (
                        <div className="absolute top-12 right-10 bg-white dark:bg-card-dark shadow-xl rounded-xl p-2 flex flex-col gap-1 z-50 border border-slate-100 dark:border-slate-700 min-w-[120px]">
                            <button onClick={() => { setGridOption('GRID_2'); setShowGridMenu(false); }} className={`text-left text-xs p-2 rounded-lg ${gridOption === 'GRID_2' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Large</button>
                            <button onClick={() => { setGridOption('GRID_3'); setShowGridMenu(false); }} className={`text-left text-xs p-2 rounded-lg ${gridOption === 'GRID_3' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Medium</button>
                            <button onClick={() => { setGridOption('GRID_4'); setShowGridMenu(false); }} className={`text-left text-xs p-2 rounded-lg ${gridOption === 'GRID_4' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Small</button>
                            <button onClick={() => { setGridOption('LIST'); setShowGridMenu(false); }} className={`text-left text-xs p-2 rounded-lg ${gridOption === 'LIST' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>List View</button>
                        </div>
                    )}

                    {/* Sort Button */}
                    <button 
                        onClick={() => { setShowSortMenu(!showSortMenu); setShowGridMenu(false); }}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                        <span className="material-icons-round text-slate-500 dark:text-slate-300">sort</span>
                    </button>
                    {showSortMenu && (
                        <div className="absolute top-12 right-0 bg-white dark:bg-card-dark shadow-xl rounded-xl p-2 flex flex-col gap-1 z-50 border border-slate-100 dark:border-slate-700 min-w-[140px]">
                            <button onClick={() => { setSortOption('DATE_DESC'); setShowSortMenu(false); }} className={`text-left text-xs p-2 rounded-lg ${sortOption === 'DATE_DESC' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Newest First</button>
                            <button onClick={() => { setSortOption('DATE_ASC'); setShowSortMenu(false); }} className={`text-left text-xs p-2 rounded-lg ${sortOption === 'DATE_ASC' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Oldest First</button>
                            <button onClick={() => { setSortOption('NAME_ASC'); setShowSortMenu(false); }} className={`text-left text-xs p-2 rounded-lg ${sortOption === 'NAME_ASC' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Name (A-Z)</button>
                            <button onClick={() => { setSortOption('NAME_DESC'); setShowSortMenu(false); }} className={`text-left text-xs p-2 rounded-lg ${sortOption === 'NAME_DESC' ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Name (Z-A)</button>
                        </div>
                    )}
                </div>
            </div>
        </header>

        {/* Content */}
        <main className="relative z-10 p-4 overflow-y-auto flex-1 pb-24 no-scrollbar">
             {/* Filter Tabs */}
             <div className="flex gap-2 items-center mb-2 overflow-x-auto no-scrollbar pb-2">
                 {/* Fixed Filters */}
                <button 
                    onClick={() => setActiveFilter('ALL')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-soft whitespace-nowrap transition-colors ${activeFilter === 'ALL' ? 'bg-primary text-white' : 'bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                >
                    All
                </button>
                <button 
                    onClick={() => setActiveFilter('NEW')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-soft whitespace-nowrap transition-colors ${activeFilter === 'NEW' ? 'bg-primary text-white' : 'bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                >
                    New
                </button>

                {/* Catch Date Filter (Month) */}
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold shadow-soft border transition-colors ${activeFilter === 'DATE_FILTER' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                    <span className="material-icons-round text-sm">calendar_month</span>
                    <input 
                        type="month" 
                        value={dateFilterValue}
                        onChange={(e) => {
                            setDateFilterValue(e.target.value);
                            setActiveFilter('DATE_FILTER');
                        }}
                        className="bg-transparent border-none p-0 text-xs w-24 focus:ring-0 text-inherit cursor-pointer"
                    />
                </div>

                {/* Category Filters */}
                {categories.map(cat => (
                     <button 
                        key={cat.id}
                        onClick={() => setActiveFilter(cat.id)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-soft whitespace-nowrap transition-colors ${activeFilter === cat.id ? 'bg-primary text-white' : 'bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {loading ? <LoadingSpinner /> : (
                <div className={`grid gap-3 ${getGridClass()}`}>
                    {processedDolls.map(doll => (
                        <DollCard 
                            key={doll.id} 
                            doll={doll} 
                            categoryName={doll.category_id ? categoryMap[doll.category_id] : undefined}
                            onClick={openDetailModal} 
                            onDelete={handleDeleteDoll}
                        />
                    ))}
                    {processedDolls.length === 0 && (
                        <div className="col-span-full text-center py-10 flex flex-col items-center">
                            <span className="material-icons-round text-slate-200 text-6xl mb-2">filter_alt_off</span>
                            <p className="text-slate-400 text-sm">No items found.</p>
                        </div>
                    )}
                </div>
            )}
        </main>

        {/* Floating Action Button */}
        <button 
            onClick={() => setIsAddModalOpen(true)}
            className="absolute bottom-24 right-6 bg-primary/40 backdrop-blur-md text-white p-4 rounded-full shadow-lg hover:bg-primary/60 transition-all hover:scale-110 z-30 flex items-center justify-center"
        >
            <span className="material-icons-round text-2xl drop-shadow-sm">add_a_photo</span>
        </button>

        {/* Add Modal */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-sm p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Add to {currentTopic.name}</h2>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <span className="material-icons-round">close</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex gap-4">
                            <div className="relative w-24 h-24 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden">
                                {formData.imageFile ? (
                                    <img src={URL.createObjectURL(formData.imageFile)} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="material-icons-round text-slate-300">image</span>
                                )}
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleFileChange}
                                />
                            </div>
                            <div className="flex flex-col justify-center flex-1">
                                <p className="text-xs text-slate-500 mb-2">Upload a photo to auto-fill details.</p>
                                <button 
                                    type="button" 
                                    onClick={handleAiAutofill}
                                    disabled={isAiLoading || !formData.imageFile}
                                    className="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 justify-center disabled:opacity-50"
                                >
                                    <span className="material-icons-round text-sm">auto_awesome</span>
                                    {isAiLoading ? 'Analyzing...' : 'Auto-fill with AI'}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                            <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm dark:text-white border-none focus:ring-2 focus:ring-primary/50" placeholder="e.g. Whale Shark" />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm dark:text-white border-none focus:ring-2 focus:ring-primary/50" rows={2} placeholder="Short description..." />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Size</label>
                                <div className="flex flex-col gap-2 mt-2">
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.size.includes('Normal')} 
                                            onChange={() => handleSizeChange('Normal')}
                                            className="rounded border-slate-300 text-primary focus:ring-primary"
                                        />
                                        Normal
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.size.includes('Small')} 
                                            onChange={() => handleSizeChange('Small')}
                                            className="rounded border-slate-300 text-primary focus:ring-primary"
                                        />
                                        Small
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                                <select value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm dark:text-white border-none">
                                    <option value="">None</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catch Date</label>
                            <input type="date" value={formData.catch_date} onChange={e => setFormData({...formData, catch_date: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm dark:text-white border-none focus:ring-2 focus:ring-primary/50" />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-soft hover:brightness-110 transition disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Add to Collection'}
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* Detail/Edit Modal */}
        {selectedDoll && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setSelectedDoll(null)}>
                <div className="bg-white dark:bg-card-dark rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-[fadeIn_0.2s_ease-out] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="relative bg-black/5 dark:bg-black/40 flex-1 min-h-[50%] overflow-hidden">
                         {/* Full Picture View: object-contain */}
                         <img src={selectedDoll.image_url} className="w-full h-full object-contain" />
                         <button onClick={() => setSelectedDoll(null)} className="absolute top-4 right-4 bg-black/20 text-white rounded-full p-1 hover:bg-black/40 backdrop-blur-md z-10">
                            <span className="material-icons-round">close</span>
                         </button>
                    </div>
                    <div className="p-6 overflow-y-auto shrink-0">
                        {isEditingDoll ? (
                            <div className="space-y-3">
                                <input 
                                    className="w-full text-2xl font-bold bg-slate-50 dark:bg-slate-800 rounded p-1 border-b-2 border-primary outline-none" 
                                    value={editDollData.name} 
                                    onChange={e => setEditDollData({...editDollData, name: e.target.value})}
                                />
                                
                                <select 
                                    value={editDollData.category_id || ''} 
                                    onChange={e => setEditDollData({...editDollData, category_id: e.target.value})} 
                                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-sm dark:text-white border-none"
                                >
                                    <option value="">No Category</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>

                                <div className="flex gap-4">
                                     <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={editDollData.sizeArray?.includes('Normal')} 
                                            onChange={() => handleEditSizeChange('Normal')}
                                            className="rounded border-slate-300 text-primary focus:ring-primary"
                                        />
                                        Normal
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={editDollData.sizeArray?.includes('Small')} 
                                            onChange={() => handleEditSizeChange('Small')}
                                            className="rounded border-slate-300 text-primary focus:ring-primary"
                                        />
                                        Small
                                    </label>
                                </div>

                                <input 
                                    type="date"
                                    className="bg-slate-50 dark:bg-slate-800 rounded p-1 text-sm border-none w-full"
                                    value={editDollData.catch_date || ''}
                                    onChange={e => setEditDollData({...editDollData, catch_date: e.target.value})}
                                />
                                <textarea 
                                    className="w-full text-sm bg-slate-50 dark:bg-slate-800 rounded p-2 h-20 border-none resize-none"
                                    value={editDollData.description || ''} 
                                    onChange={e => setEditDollData({...editDollData, description: e.target.value})}
                                />
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => setIsEditingDoll(false)} className="flex-1 py-2 rounded-lg text-slate-500 font-bold bg-slate-100">Cancel</button>
                                    <button onClick={handleUpdateDoll} className="flex-1 py-2 rounded-lg text-white font-bold bg-primary">Save</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start mb-2">
                                    <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-white">{selectedDoll.name}</h2>
                                    <div className="flex gap-1">
                                        {selectedDoll.size && selectedDoll.size.split(',').map(s => (
                                            <span key={s.trim()} className={`px-2 py-1 rounded-full text-[10px] font-bold text-white ${s.trim() === 'Normal' ? 'bg-blue-400' : 'bg-pink-400'}`}>
                                                {s.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {selectedDoll.category_id && categoryMap[selectedDoll.category_id] && (
                                    <div className="mb-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                            {categoryMap[selectedDoll.category_id]}
                                        </span>
                                    </div>
                                )}

                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                                    {selectedDoll.description || 'No description provided.'}
                                </p>
                                
                                <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
                                    <span className="material-icons-round text-base">calendar_today</span>
                                    <span>Caught on {selectedDoll.catch_date || 'Unknown date'}</span>
                                </div>

                                <button 
                                    onClick={() => setIsEditingDoll(true)}
                                    className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                >
                                    Edit Details
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default HomeView;