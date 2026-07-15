import React, { useState, useEffect } from 'react';
import { apiFetch as fetch } from '../lib/api';
import { UserProfileData } from '../types';
import io, { Socket } from 'socket.io-client';

interface MessagesPageProps {
  user: UserProfileData;
  onActionToast: (message: string) => void;
}

export default function MessagesPage({ user, onActionToast }: MessagesPageProps) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('savdo24_token');
    if (!token) return;

    const newSocket = io({
      auth: { token }
    });
    setSocket(newSocket);

    newSocket.on('new_message', (message: any) => {
        if(selectedConversation && message.conversationId === selectedConversation.id) {
            setMessages(prev => [...prev, message]);
        }
        fetchConversations();
    });

    return () => { newSocket.disconnect(); };
  }, [selectedConversation]);

  const fetchConversations = async () => {
    const token = localStorage.getItem('savdo24_token');
    const res = await fetch('/api/conversations', { headers: { 'Authorization': `Bearer ${token}` } });
    if(res.ok) setConversations(await res.json());
  };

  useEffect(() => { fetchConversations(); }, []);

  const selectConversation = async (conv: any) => {
    setSelectedConversation(conv);
    const token = localStorage.getItem('savdo24_token');
    const res = await fetch(`/api/conversations/${conv.id}/messages`, { headers: { 'Authorization': `Bearer ${token}` } });
    if(res.ok) setMessages(await res.json());
    await fetch(`/api/conversations/${conv.id}/read`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newMessage.trim()) return;
    const token = localStorage.getItem('savdo24_token');
    const res = await fetch(`/api/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: newMessage })
    });
    if(res.ok) {
        const newMessageData = await res.json();
        setMessages(prev => [...prev, newMessageData]);
        setNewMessage('');
    } else {
        onActionToast("Xabar yuborib bo'lmadi.");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 h-[600px] bg-[#0b1426] border border-white/10 rounded-2xl overflow-hidden">
        <div className="col-span-1 border-r border-white/10 overflow-y-auto">
            {conversations.map(conv => (
                <div key={conv.id} onClick={() => selectConversation(conv)} className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 ${selectedConversation?.id === conv.id ? 'bg-white/10' : ''}`}>
                    <p className="font-bold text-white text-sm">{conv.buyer.name === user.name ? conv.seller.name : conv.buyer.name}</p>
                    <p className="text-xs text-on-primary-container truncate">{conv.startup.name}</p>
                </div>
            ))}
        </div>
        <div className="col-span-2 flex flex-col">
            {selectedConversation ? (
                <>
                    <div className="flex-grow p-4 overflow-y-auto">
                        {messages.map(msg => (
                            <div key={msg.id} className={`mb-2 p-2 rounded ${msg.senderId === user.id ? 'bg-secondary-container text-black ml-auto' : 'bg-white/10 text-white'}`} style={{maxWidth: '70%'}}>
                                {msg.content}
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 flex gap-2">
                        <input className="flex-grow bg-[#0b1426] border border-white/10 rounded-xl p-2 text-white" value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                        <button className="bg-secondary-container text-black px-4 py-2 rounded-xl">Yuborish</button>
                    </form>
                </>
            ) : <div className="flex-grow flex items-center justify-center text-on-primary-container">Suhbatni tanlang</div>}
        </div>
    </div>
  );
}
