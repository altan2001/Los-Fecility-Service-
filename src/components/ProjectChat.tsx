import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Clock, Image as ImageIcon, CheckCheck } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  created_at: any;
  project_id: string;
  type: 'text' | 'image' | 'system';
}

export default function ProjectChat({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) return;

    const q = query(
      collection(db, `projects/${projectId}/messages`),
      orderBy('created_at', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [projectId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    setLoading(true);
    try {
      await addDoc(collection(db, `projects/${projectId}/messages`), {
        sender_id: auth.currentUser.uid,
        sender_name: auth.currentUser.displayName || 'Mitarbeiter',
        text: newMessage,
        project_id: projectId,
        type: 'text',
        created_at: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
      {/* Chat Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
            <User size={20} />
          </div>
          <div>
            <h4 className="font-black text-brand-dark tracking-tight">Projekt-Chat</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team-Kommunikation</p>
          </div>
        </div>
        <div className="flex -space-x-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
              U{i}
            </div>
          ))}
        </div>
      </div>

      {/* Message List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"
      >
        <AnimatePresence>
          {messages.map((msg, index) => {
            const isMe = msg.sender_id === auth.currentUser?.uid;
            return (
              <motion.div 
                key={msg.id || index}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMe && <span className="text-[10px] font-bold text-slate-400 mb-1 ml-2 uppercase tracking-widest">{msg.sender_name}</span>}
                  <div className={`p-4 rounded-3xl shadow-sm ${
                    isMe 
                      ? 'bg-brand-dark text-white rounded-tr-none' 
                      : 'bg-white border border-slate-100 text-brand-dark rounded-tl-none'
                  }`}>
                    <p className="text-sm font-medium">{msg.text}</p>
                    <div className={`flex items-center gap-2 mt-2 ${isMe ? 'text-white/40' : 'text-slate-300'}`}>
                      <Clock size={10} />
                      <span className="text-[10px] font-bold">
                        {msg.created_at?.toDate ? msg.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Jetzt'}
                      </span>
                      {isMe && <CheckCheck size={12} className="text-brand-primary" />}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSend} className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
        <button type="button" className="p-3 bg-white text-slate-400 hover:text-brand-primary rounded-2xl border border-slate-200 transition-colors">
          <ImageIcon size={20} />
        </button>
        <input 
          type="text" 
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Nachricht schreiben..."
          className="flex-1 bg-white border border-slate-200 rounded-2xl py-3 px-6 outline-none focus:border-brand-primary/30 font-medium text-sm transition-all"
        />
        <button 
          type="submit" 
          disabled={loading || !newMessage.trim()}
          className="p-3 bg-brand-primary text-white rounded-2xl hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:shadow-none"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
