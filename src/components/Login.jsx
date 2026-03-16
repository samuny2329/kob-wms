import React from 'react';
import { Monitor, User, Lock, Globe, RefreshCw } from 'lucide-react';

const Login = ({ t, username, setUsername, password, setPassword, isLoading, error, handleLogin, language, setLanguage }) => {
    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f8f9fa' }}>
            <div className="w-full max-w-sm animate-fade-in">
                {/* Card */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    {/* Header bar */}
                    <div className="px-8 py-6 text-center" style={{ backgroundColor: '#714B67', borderBottom: '1px solid #5a3d52' }}>
                        <div className="w-14 h-14 rounded flex items-center justify-center mx-auto mb-3 bg-white/20">
                            <Monitor className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-lg font-bold text-white">WMS Pro</h1>
                        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>KOB &amp; BTV-Online</p>
                    </div>

                    {/* Form */}
                    <div className="px-8 py-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6c757d' }}>{t('username')}</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#adb5bd' }} />
                                    <input
                                        type="text"
                                        required
                                        className="login-input"
                                        placeholder="Enter your ID"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6c757d' }}>{t('password')}</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#adb5bd' }} />
                                    <input
                                        type="password"
                                        required
                                        className="login-input"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded flex items-center gap-2 animate-shake" style={{ backgroundColor: '#fff5f5', border: '1px solid #f5c6cb' }}>
                                    <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: '#dc3545' }}></div>
                                    <p className="text-xs font-medium" style={{ color: '#dc3545' }}>{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="login-button mt-2"
                            >
                                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : t('signInBtn')}
                            </button>
                        </form>

                        <div className="mt-5 pt-4 flex items-center justify-center gap-2" style={{ borderTop: '1px solid #dee2e6' }}>
                            <Globe className="w-3.5 h-3.5" style={{ color: '#adb5bd' }} />
                            <select
                                value={language}
                                onChange={e => setLanguage(e.target.value)}
                                className="text-xs font-medium outline-none cursor-pointer bg-transparent"
                                style={{ color: '#6c757d' }}
                            >
                                <option value="en">English (US)</option>
                                <option value="th">ภาษาไทย (TH)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <p className="text-center mt-4 text-[10px] uppercase tracking-widest" style={{ color: '#adb5bd' }}>
                    KOB&amp;BTV-Online • Version 4.0.0
                </p>
            </div>
        </div>
    );
};

export default Login;
