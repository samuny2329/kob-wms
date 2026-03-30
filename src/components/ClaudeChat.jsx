import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader, AlertCircle, Trash2, Settings, Sparkles } from 'lucide-react';
import { sendMessage } from '../services/claudeApi';

const ClaudeChat = ({ t, apiConfigs, setActiveTab }) => {
    const [messages, setMessages] = useState(() => {
        try { const stored = localStorage.getItem('wms_chat_history'); return stored ? JSON.parse(stored) : []; }
        catch { return []; }
    });
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const apiKey = apiConfigs?.claude?.apiKey || '';
    const isConfigured = apiConfigs?.claude?.enabled && apiKey;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('wms_chat_history', JSON.stringify(messages.slice(-50)));
        }
    }, [messages]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isLoading || !isConfigured) return;

        setInput('');
        setError('');
        const userMsg = { role: 'user', content: text, ts: Date.now() };
        const updated = [...messages, userMsg];
        setMessages(updated);
        setIsLoading(true);

        try {
            const apiMessages = updated.slice(-20).map(m => ({ role: m.role, content: m.content }));
            const reply = await sendMessage(apiKey, apiMessages);
            setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem('wms_chat_history');
    };

    // Not configured state
    if (!isConfigured) {
        return (
            <div className="max-w-3xl mx-auto animate-slide-up pb-12 w-full">
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className="px-6 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                        <Sparkles className="w-5 h-5" style={{ color: '#714B67' }} />
                        <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#212529' }}>Claude AI Assistant</h2>
                    </div>
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#f0e8ed' }}>
                            <Sparkles className="w-8 h-8" style={{ color: '#714B67' }} />
                        </div>
                        <h3 className="text-base font-semibold mb-2" style={{ color: '#212529' }}>Setup Required</h3>
                        <p className="text-sm mb-6" style={{ color: '#6c757d', maxWidth: 400, margin: '0 auto 1.5rem' }}>
                            Enable Claude AI and add your API key in Settings to start chatting.
                        </p>
                        <button onClick={() => setActiveTab('settings')} className="odoo-btn odoo-btn-primary inline-flex items-center gap-1.5">
                            <Settings className="w-4 h-4" /> Go to Settings
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto animate-slide-up pb-12 w-full" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <div className="flex items-center gap-2.5">
                        <Sparkles className="w-5 h-5" style={{ color: '#714B67' }} />
                        <div>
                            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#212529' }}>Claude AI Assistant</h2>
                            <p className="text-[11px]" style={{ color: '#6c757d' }}>WMS intelligent helper — ask anything about operations</p>
                        </div>
                    </div>
                    {messages.length > 0 && (
                        <button onClick={clearChat} className="odoo-btn odoo-btn-secondary text-xs flex items-center gap-1">
                            <Trash2 className="w-3.5 h-3.5" /> Clear
                        </button>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ minHeight: 0 }}>
                    {messages.length === 0 && (
                        <div className="text-center py-12">
                            <Sparkles className="w-10 h-10 mx-auto mb-3" style={{ color: '#dee2e6' }} />
                            <p className="text-sm font-medium" style={{ color: '#6c757d' }}>Start a conversation</p>
                            <p className="text-xs mt-1" style={{ color: '#adb5bd' }}>Ask about orders, inventory, workflows, KPIs...</p>
                            <div className="flex flex-wrap justify-center gap-2 mt-4">
                                {['How to process a pick order?', 'Explain the pack workflow', 'What KPI metrics are tracked?'].map(q => (
                                    <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                                        className="text-xs px-3 py-1.5 rounded-full transition-colors"
                                        style={{ backgroundColor: '#f0e8ed', color: '#714B67', border: '1px solid #e0d0dc' }}>
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[80%] rounded-lg px-3.5 py-2.5" style={{
                                backgroundColor: msg.role === 'user' ? '#714B67' : '#f8f9fa',
                                color: msg.role === 'user' ? '#ffffff' : '#212529',
                                border: msg.role === 'assistant' ? '1px solid #dee2e6' : 'none',
                                fontSize: '13px', lineHeight: '1.6',
                            }}>
                                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                                <div className="text-[10px] mt-1" style={{ opacity: 0.5, textAlign: 'right' }}>
                                    {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="rounded-lg px-3.5 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                                <Loader className="w-4 h-4 animate-spin" style={{ color: '#714B67' }} />
                                <span className="text-xs" style={{ color: '#6c757d' }}>Thinking...</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded text-xs" style={{ backgroundColor: '#fee2e2', color: '#dc3545' }}>
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your warehouse operations..."
                            rows={1}
                            className="odoo-input flex-1 resize-none"
                            style={{ minHeight: '38px', maxHeight: '120px', fontSize: '13px', lineHeight: '1.5' }}
                            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="odoo-btn odoo-btn-primary shrink-0 disabled:opacity-40"
                            style={{ height: '38px', width: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClaudeChat;
