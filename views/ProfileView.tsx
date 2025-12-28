import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Topic } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

interface ProfileViewProps {
  currentTopic: Topic;
  onSwitchTopic: (topic: Topic) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ currentTopic, onSwitchTopic }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTopicName, setNewTopicName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Edit State
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Delete Confirmation State
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);

  const fetchTopics = async () => {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setTopics(data || []);
    } catch (err) {
      console.error('Error fetching topics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('topics')
        .insert([{ name: newTopicName }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTopics([...topics, data]);
        setNewTopicName('');
        onSwitchTopic(data); 
      }
    } catch (err) {
      alert("Failed to create topic");
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
      // Inline confirmation Logic handled in render
      try {
          const { error } = await supabase.from('topics').delete().eq('id', topicId);
          if (error) throw error;
          
          const remainingTopics = topics.filter(t => t.id !== topicId);
          setTopics(remainingTopics);
          setDeletingTopicId(null);
          
          if (currentTopic.id === topicId && remainingTopics.length > 0) {
              onSwitchTopic(remainingTopics[0]);
          } else if (remainingTopics.length === 0) {
              window.location.reload(); 
          }
      } catch (e) {
          console.error(e);
          alert("Failed to delete.");
      }
  };

  const startEdit = (topic: Topic) => {
      setEditingTopicId(topic.id);
      setEditName(topic.name);
      setDeletingTopicId(null); // Cancel any delete in progress
  };

  const saveEdit = async () => {
      if (!editingTopicId || !editName.trim()) return;
      try {
          const { error } = await supabase.from('topics').update({ name: editName }).eq('id', editingTopicId);
          if (error) throw error;
          
          const updatedTopic = { ...topics.find(t => t.id === editingTopicId)!, name: editName };
          setTopics(topics.map(t => t.id === editingTopicId ? updatedTopic : t));
          
          // If we edited the currently active topic, update it in parent via prop callback
          if (currentTopic.id === editingTopicId) {
             onSwitchTopic(updatedTopic);
          }
          setEditingTopicId(null);
      } catch (e) {
          console.error(e);
          alert("Failed to update.");
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
        {/* Header */}
        <header className="px-6 pt-12 pb-6 bg-white/80 dark:bg-card-dark/80 backdrop-blur-md sticky top-0 border-b border-blue-100 dark:border-slate-700 z-10">
            <h1 className="text-2xl font-display font-bold text-slate-800 dark:text-white">My Collections</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500">Switch topics to manage different sets.</p>
        </header>

        <main className="p-6 overflow-y-auto flex-1 pb-24 no-scrollbar">
            {loading ? <LoadingSpinner /> : (
                <div className="space-y-4">
                    {/* List Topics */}
                    {topics.map(topic => (
                        <div 
                            key={topic.id}
                            className={`group relative p-4 rounded-2xl border-2 transition-all flex items-center justify-between overflow-hidden ${
                                currentTopic.id === topic.id 
                                ? 'border-primary bg-blue-50 dark:bg-primary/10' 
                                : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-card-dark hover:border-blue-200 dark:hover:border-slate-600'
                            }`}
                        >
                            {/* Deleting State */}
                            {deletingTopicId === topic.id ? (
                                <div className="flex items-center justify-between w-full animate-in fade-in slide-in-from-right duration-200">
                                    <span className="text-sm font-bold text-red-500">Confirm delete "{topic.name}"?</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setDeletingTopicId(null)} className="px-3 py-1 text-slate-500 bg-slate-100 rounded-lg text-xs font-bold">Cancel</button>
                                        <button onClick={() => handleDeleteTopic(topic.id)} className="px-3 py-1 text-white bg-red-500 rounded-lg text-xs font-bold">Delete</button>
                                    </div>
                                </div>
                            ) : editingTopicId === topic.id ? (
                                <div className="flex gap-2 w-full animate-in fade-in">
                                    <input 
                                        autoFocus
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="flex-1 bg-white rounded px-2 py-1 text-sm border border-slate-300"
                                    />
                                    <button onClick={saveEdit} className="text-green-500 material-icons-round">check</button>
                                    <button onClick={() => setEditingTopicId(null)} className="text-red-500 material-icons-round">close</button>
                                </div>
                            ) : (
                                <>
                                    <div 
                                        onClick={() => onSwitchTopic(topic)}
                                        className="flex items-center gap-4 cursor-pointer flex-1"
                                    >
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${
                                            currentTopic.id === topic.id 
                                            ? 'bg-primary text-white shadow-soft' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        }`}>
                                            <span className="material-icons-round">
                                                {currentTopic.id === topic.id ? 'folder_open' : 'folder'}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-base ${currentTopic.id === topic.id ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {topic.name}
                                            </h3>
                                            {currentTopic.id === topic.id && (
                                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Active</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEdit(topic)} className="p-2 text-slate-400 hover:text-blue-500">
                                            <span className="material-icons-round text-lg">edit</span>
                                        </button>
                                        <button onClick={() => setDeletingTopicId(topic.id)} className="p-2 text-slate-400 hover:text-red-500">
                                            <span className="material-icons-round text-lg">delete</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    {/* Create New Topic */}
                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Create New Collection</h3>
                        <form onSubmit={handleCreateTopic} className="bg-white dark:bg-card-dark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                             <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="e.g. Vintage Cars, Stamps..." 
                                    value={newTopicName}
                                    onChange={e => setNewTopicName(e.target.value)}
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-sm dark:text-white focus:ring-2 focus:ring-primary/50"
                                />
                                <button 
                                    type="submit" 
                                    disabled={!newTopicName || isCreating}
                                    className="bg-primary text-white rounded-xl px-4 py-2 font-bold disabled:opacity-50 hover:bg-sky-500 transition shadow-soft"
                                >
                                    {isCreating ? '...' : 'Add'}
                                </button>
                             </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    </div>
  );
};

export default ProfileView;
