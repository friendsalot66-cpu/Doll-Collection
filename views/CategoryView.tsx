import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Category, Topic } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { suggestCategory } from '../services/geminiService';
import { compressImage } from '../services/utils';

interface CategoryViewProps {
  currentTopic: Topic;
  onSelectCategory: (categoryId: string) => void;
}

const CategoryView: React.FC<CategoryViewProps> = ({ currentTopic, onSelectCategory }) => {
  const [categories, setCategories] = useState<{ category: Category, count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Edit State
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Deletion state mapping: categoryId -> boolean (isDeleting state)
  const [deletingStates, setDeletingStates] = useState<Record<string, boolean>>({});

  const fetchCategories = async () => {
    if (!currentTopic) return;
    setLoading(true);
    try {
        const { data: cats, error: catError } = await supabase
            .from('categories')
            .select('*')
            .eq('topic_id', currentTopic.id)
            .order('name');
        if (catError) throw catError;

        const catsWithCounts = await Promise.all(cats.map(async (c) => {
            const { count } = await supabase.from('dolls').select('*', { count: 'exact', head: true }).eq('category_id', c.id);
            return {
                category: c,
                count: count || 0
            };
        }));
        
        setCategories(catsWithCounts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [currentTopic]);

  const handleAiScan = async (file: File) => {
    setIsAiLoading(true);
    try {
        const suggestion = await suggestCategory(file);
        setNewCategoryName(suggestion);
    } catch(e) {
        alert("Could not scan.");
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setImageFile(file);
          handleAiScan(file);
      }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, catId: string) => {
      e.stopPropagation();
      
      if (deletingStates[catId]) {
          // Confirmed delete
          try {
              const { error } = await supabase.from('categories').delete().eq('id', catId);
              if (error) throw error;
              setCategories(prev => prev.filter(c => c.category.id !== catId));
          } catch (err) {
              console.error(err);
              alert("Failed to delete category.");
          }
      } else {
          // Arm delete
          setDeletingStates(prev => ({ ...prev, [catId]: true }));
          setTimeout(() => {
              setDeletingStates(prev => ({ ...prev, [catId]: false }));
          }, 3000);
      }
  };

  const createCategory = async () => {
      if (!newCategoryName.trim() || !imageFile) {
        if(!imageFile) alert("Please add an image for the category.");
        return;
      }
      
      setIsCreating(true);
      try {
        // Compress
        const compressed = await compressImage(imageFile);

        // Upload Image
        const fileExt = compressed.name.split('.').pop();
        const fileName = `cat_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(fileName, compressed);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(fileName);

        const { error } = await supabase.from('categories').insert([{ 
            name: newCategoryName,
            topic_id: currentTopic.id,
            image_url: publicUrl 
        }]);

        if (error) throw error;

        setNewCategoryName('');
        setImageFile(null);
        fetchCategories();
      } catch (e) {
        console.error(e);
        alert("Error creating category");
      } finally {
        setIsCreating(false);
      }
  };

  // --- Edit Logic ---
  const startEdit = (e: React.MouseEvent, category: Category) => {
      e.stopPropagation();
      setEditingCategory(category);
      setEditName(category.name);
      setEditImageFile(null);
  };

  const handleUpdateCategory = async () => {
      if (!editingCategory || !editName.trim()) return;
      
      setIsSavingEdit(true);
      try {
          let imageUrl = editingCategory.image_url;

          if (editImageFile) {
             const compressed = await compressImage(editImageFile);
             const fileExt = compressed.name.split('.').pop();
             const fileName = `cat_${Date.now()}.${fileExt}`;
             const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(fileName, compressed);
             if (uploadError) throw uploadError;
             
             const { data } = supabase.storage.from('images').getPublicUrl(fileName);
             imageUrl = data.publicUrl;
          }

          const { error } = await supabase.from('categories').update({
              name: editName,
              image_url: imageUrl
          }).eq('id', editingCategory.id);

          if (error) throw error;

          setCategories(prev => prev.map(c => 
              c.category.id === editingCategory.id 
                ? { ...c, category: { ...c.category, name: editName, image_url: imageUrl } } 
                : c
          ));
          setEditingCategory(null);
      } catch (e) {
          console.error(e);
          alert("Failed to update.");
      } finally {
          setIsSavingEdit(false);
      }
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-background-light dark:bg-background-dark font-category overflow-y-auto pb-24 no-scrollbar">
        {/* Top App Bar */}
        <header className="sticky top-0 z-40 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 justify-between border-b border-gray-200/50 dark:border-gray-800/50">
            <button className="text-[#0d181c] dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors opacity-0 cursor-default">
                <span className="material-symbols-outlined">arrow_back_ios_new</span>
            </button>
            <h2 className="text-[#0d181c] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">Manage Categories</h2>
            <div className="w-10"></div>
        </header>

        <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto">
            {/* Input Section */}
            <section className="px-4 pt-6 pb-2">
                <h3 className="text-[#0d181c] dark:text-white tracking-tight text-xl font-bold leading-tight text-left mb-4">Add to {currentTopic.name}</h3>
                <div className="bg-white dark:bg-[#1a2c32] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 max-w-md mx-auto">
                    <div className="flex gap-4 mb-4">
                        {/* Image Upload Placeholder */}
                        <div className="shrink-0 group cursor-pointer relative">
                            <div className={`w-24 h-24 rounded-xl border-2 border-dashed ${isAiLoading ? 'border-primary animate-pulse' : 'border-[#cfe2e8] dark:border-gray-600'} bg-background-light dark:bg-white/5 flex flex-col items-center justify-center transition-all group-hover:border-primary group-hover:bg-primary/5 overflow-hidden`}>
                                {imageFile ? (
                                    <img src={URL.createObjectURL(imageFile)} className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-primary mb-1">add_a_photo</span>
                                        <span className="text-[10px] font-bold text-center text-gray-500 dark:text-gray-400 group-hover:text-primary leading-tight px-1">Scan / Upload</span>
                                    </>
                                )}
                            </div>
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                        </div>
                        {/* Text Input */}
                        <div className="flex-1 flex flex-col justify-center">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Category Name</label>
                            <input 
                                className="w-full bg-background-light dark:bg-background-dark border-none rounded-xl h-12 px-4 text-[#0d181c] dark:text-white placeholder:text-[#4b879b]/60 focus:ring-2 focus:ring-primary/50 transition-all font-medium" 
                                placeholder={isAiLoading ? "Scanning..." : "e.g. Sharks"} 
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* Create Button */}
                    <button 
                        onClick={createCategory}
                        disabled={!newCategoryName || !imageFile || isCreating}
                        className="w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-5 bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all text-[#0d181c] text-base font-bold leading-normal tracking-[0.015em] flex gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        <span>{isCreating ? 'Saving...' : 'Create Category'}</span>
                    </button>
                </div>
            </section>

            <div className="h-4"></div>

            {/* List Section */}
            <section className="px-4 pb-12 flex-1">
                <div className="flex items-end justify-between mb-4 px-1 max-w-7xl mx-auto">
                    <h3 className="text-[#0d181c] dark:text-white tracking-tight text-xl font-bold leading-tight">Current Categories</h3>
                    <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{categories.length}</span>
                </div>
                
                {loading ? <LoadingSpinner /> : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {categories.map((item) => (
                             <div 
                                key={item.category.id} 
                                onClick={() => onSelectCategory(item.category.id)}
                                className="group bg-white dark:bg-[#1a2c32] rounded-2xl p-3 shadow-sm border border-transparent hover:border-primary/20 dark:hover:border-primary/20 transition-all cursor-pointer hover:shadow-md relative"
                             >
                                <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-primary/10">
                                    {item.category.image_url ? (
                                         <div className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{backgroundImage: `url(${item.category.image_url})`}}></div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-primary/30">
                                            <span className="material-icons-round text-4xl">folder</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col px-1">
                                    <h4 className="font-bold text-base text-[#0d181c] dark:text-white truncate">{item.category.name}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">{item.count} Items</p>
                                </div>
                                
                                {/* Edit Icon - Bottom Right, Transparent */}
                                <div 
                                    onClick={(e) => startEdit(e, item.category)}
                                    className="absolute bottom-3 right-3 p-1.5 rounded-full z-10 bg-white/50 text-slate-800 opacity-20 hover:opacity-100 transition-all hover:bg-white shadow-sm"
                                >
                                     <span className="material-icons-round text-[16px]">edit</span>
                                </div>

                                {/* Delete Icon */}
                                <div 
                                    onClick={(e) => handleDeleteCategory(e, item.category.id)}
                                    className={`absolute top-2 right-2 p-1.5 rounded-full z-10 transition-all ${deletingStates[item.category.id] ? 'bg-red-500 text-white opacity-100' : 'bg-white/50 dark:bg-black/50 text-slate-500 dark:text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-500'}`}
                                >
                                    <span className="material-icons-round text-[16px]">
                                        {deletingStates[item.category.id] ? 'check' : 'delete'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </main>

        {/* Edit Category Modal */}
        {editingCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingCategory(null)}>
                <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Edit Category</h2>
                    
                    <div className="flex flex-col gap-4">
                        <div className="relative w-full h-32 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-300">
                             {editImageFile ? (
                                <img src={URL.createObjectURL(editImageFile)} className="w-full h-full object-cover" />
                             ) : (
                                <img src={editingCategory.image_url} className="w-full h-full object-cover" />
                             )}
                             <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files && setEditImageFile(e.target.files[0])} />
                             <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                                 <span className="material-icons-round text-white">edit</span>
                             </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Name</label>
                            <input 
                                value={editName} 
                                onChange={e => setEditName(e.target.value)} 
                                className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 mt-1 dark:text-white border-none" 
                            />
                        </div>

                        <div className="flex gap-2">
                             <button onClick={() => setEditingCategory(null)} className="flex-1 py-2 bg-slate-100 rounded-lg font-bold text-slate-500">Cancel</button>
                             <button onClick={handleUpdateCategory} disabled={isSavingEdit} className="flex-1 py-2 bg-primary rounded-lg font-bold text-white">
                                {isSavingEdit ? 'Saving...' : 'Save'}
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CategoryView;