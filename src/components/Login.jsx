import React from 'react';
import { Monitor, User, Lock, Globe, RefreshCw } from 'lucide-react';

const Login = ({ t, username, setUsername, password, setPassword, isLoading, error, handleLogin, language, setLanguage }) => {
    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--odoo-bg)' }}>
            <div className="w-full max-w-sm animate-fade-in">
                {/* Card */}
                <div style={{ backgroundColor: 'var(--odoo-surface)', border: '1px solid var(--odoo-border-ghost)', borderRadius: '4px', boxShadow: '0 12px 32px rgba(113, 75, 103, 0.08)', overflow: 'hidden' }}>
                    {/* Header bar — gradient from primary to primary-container */}
                    <div className="px-8 py-7 text-center" style={{ background: 'linear-gradient(135deg, #57344F, #714B67)' }}>
                        <div className="w-14 h-14 rounded flex items-center justify-center mx-auto mb-3 bg-white/20">
                            <Monitor className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-lg font-bold text-white">WMS Pro</h1>
                        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>KOB &amp; BTV-Online</p>
                    </div>

                    {/* Form */}
                    <div className="px-8 py-7">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)', letterSpacing: '0.05em' }}>{t('username')}</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />
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

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--odoo-text-muted)', letterSpacing: '0.05em' }}>{t('password')}</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--odoo-text-muted)' }} />
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
                                <div className="p-3 rounded flex items-center gap-2 animate-shake" style={{ backgroundColor: '#FFDAD6', border: '1px solid rgba(152,53,64,0.15)' }}>
                                    <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: '#983540' }}></div>
                                    <p className="text-xs font-medium" style={{ color: '#983540' }}>{error}</p>
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

                        <div className="mt-5 pt-4 flex items-center justify-center gap-2" style={{ borderTop: '1px solid var(--odoo-border-ghost)' }}>
                            <Globe className="w-3.5 h-3.5" style={{ color: 'var(--odoo-text-muted)' }} />
                            <select
                                value={language}
                                onChange={e => setLanguage(e.target.value)}
                                className="text-xs font-medium outline-none cursor-pointer bg-transparent"
                                style={{ color: 'var(--odoo-text-secondary)' }}
                            >
                                <option value="en">English (US)</option>
                                <option value="th">Thai (TH)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <p className="text-center mt-4 text-[10px] uppercase tracking-widest" style={{ color: 'var(--odoo-text-muted)' }}>
                    KOB&amp;BTV-Online • Version 4.0.0
                </p>
            </div>
        </div>
    );
};

export default Login;
