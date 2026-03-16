/**
 * PlatformLogo.jsx
 * Real-style SVG logos for all e-commerce and courier platforms.
 * Export: <PlatformBadge name="Shopee Express" size={32} rounded="md" />
 */

import React from 'react';

// ─── SVG icon definitions ────────────────────────────────────────────────────

const ShopeeIcon = ({ c = '#fff' }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '70%', height: '70%' }}>
        {/* Shopping bag */}
        <rect x="6" y="16" width="28" height="20" rx="2" fill={c} opacity="0.95" />
        <path d="M14 16 C14 10 26 10 26 16" stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* S curl */}
        <path d="M16 24 C16 21.5 24 21.5 24 24 C24 26.5 16 26.5 16 29" stroke="#EE4D2D" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
);

const LazadaIcon = ({ c = '#fff' }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '70%', height: '70%' }}>
        {/* Lazada-style shopping bag */}
        <rect x="8" y="17" width="24" height="18" rx="2" fill={c} opacity="0.95" />
        <path d="M14 17 C14 11 26 11 26 17" stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* L mark */}
        <rect x="15" y="21" width="3" height="10" fill="#0F146D" rx="1" />
        <rect x="15" y="28" width="9" height="3" fill="#0F146D" rx="1" />
    </svg>
);

const TikTokIcon = ({ c = '#fff' }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '65%', height: '65%' }}>
        {/* TikTok note shape */}
        <path d="M28 8 C28 8 26 14 20 14 L20 28 C20 30.2 18.2 32 16 32 C13.8 32 12 30.2 12 28 C12 25.8 13.8 24 16 24 C16.7 24 17.3 24.2 17.9 24.5 L18 14 C18 12 19 8 28 8 Z" fill={c} />
        <path d="M28 8 C29 10 31 12 34 12" stroke={c} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
);

const LineIcon = ({ c = '#fff' }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '70%', height: '70%' }}>
        {/* LINE chat bubble */}
        <rect x="4" y="8" width="32" height="22" rx="8" fill={c} />
        {/* Tail */}
        <path d="M14 30 L10 36 L20 30 Z" fill={c} />
        {/* Dots representing chat */}
        <circle cx="13" cy="19" r="2.5" fill="#06C755" />
        <circle cx="20" cy="19" r="2.5" fill="#06C755" />
        <circle cx="27" cy="19" r="2.5" fill="#06C755" />
    </svg>
);

const FlashIcon = ({ c = '#333' }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '65%', height: '65%' }}>
        {/* Lightning bolt */}
        <path d="M23 4 L10 22 H19 L17 36 L30 18 H21 Z" fill={c} />
    </svg>
);

const KerryIcon = ({ c = '#fff' }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '65%', height: '65%' }}>
        {/* Stylized K */}
        <rect x="10" y="6" width="5" height="28" rx="2" fill={c} />
        <path d="M15 20 L28 6" stroke={c} strokeWidth="5" strokeLinecap="round" />
        <path d="M15 20 L28 34" stroke={c} strokeWidth="5" strokeLinecap="round" />
    </svg>
);

const JTIcon = ({ c = '#fff' }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '75%', height: '75%' }}>
        {/* J */}
        <path d="M10 8 H16 V28 C16 32 13 34 10 33" stroke={c} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* & */}
        <text x="18" y="28" fontSize="10" fill={c} fontWeight="bold" fontFamily="sans-serif">&</text>
        {/* T */}
        <line x1="25" y1="8" x2="35" y2="8" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="30" y1="8" x2="30" y2="32" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
);

const ThaiPostIcon = ({ c = '#fff' }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '70%', height: '70%' }}>
        {/* Envelope */}
        <rect x="4" y="10" width="32" height="22" rx="2" fill={c} opacity="0.95" />
        <path d="M4 12 L20 22 L36 12" stroke="#ED1C24" strokeWidth="2" fill="none" />
        {/* Thai Post horn accent */}
        <path d="M4 30 L14 22" stroke="#ED1C24" strokeWidth="1.5" />
        <path d="M36 30 L26 22" stroke="#ED1C24" strokeWidth="1.5" />
    </svg>
);

// ─── Platform config map ──────────────────────────────────────────────────────
export const PLATFORM_LOGO_CONFIG = {
    // E-commerce platforms
    'Shopee Express':  { bg: '#EE4D2D', Icon: ShopeeIcon, iconColor: '#fff', name: 'Shopee' },
    'Lazada Express':  { bg: '#0F146D', Icon: LazadaIcon, iconColor: '#fff', name: 'Lazada' },
    'TikTok Shop':     { bg: '#010101', Icon: TikTokIcon, iconColor: '#fff', name: 'TikTok' },
    'LINE':            { bg: '#06C755', Icon: LineIcon,   iconColor: '#fff', name: 'LINE' },
    'Manual':          { bg: '#06C755', Icon: LineIcon,   iconColor: '#fff', name: 'Manual' },
    // Couriers
    'Flash Express':   { bg: '#FFCD00', Icon: FlashIcon,  iconColor: '#1a1a1a', name: 'Flash' },
    'Kerry Express':   { bg: '#FF6600', Icon: KerryIcon,  iconColor: '#fff', name: 'Kerry' },
    'J&T Express':     { bg: '#D32011', Icon: JTIcon,     iconColor: '#fff', name: 'J&T' },
    'Thai Post':       { bg: '#ED1C24', Icon: ThaiPostIcon, iconColor: '#fff', name: 'Thai Post' },
};

// Fallback for unknown names — try partial match
const resolveConfig = (name) => {
    if (!name) return null;
    if (PLATFORM_LOGO_CONFIG[name]) return PLATFORM_LOGO_CONFIG[name];
    const key = Object.keys(PLATFORM_LOGO_CONFIG).find(k =>
        name.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(name.toLowerCase()) ||
        (PLATFORM_LOGO_CONFIG[k].name && name.toLowerCase().includes(PLATFORM_LOGO_CONFIG[k].name.toLowerCase()))
    );
    return key ? PLATFORM_LOGO_CONFIG[key] : null;
};

// ─── PlatformBadge component ──────────────────────────────────────────────────
/**
 * <PlatformBadge name="Shopee Express" size={32} />
 * <PlatformBadge name="Flash Express" size={24} rounded="full" />
 */
export const PlatformBadge = ({ name, size = 32, rounded = 'md', className = '', style = {} }) => {
    const cfg = resolveConfig(name);
    const r = rounded === 'full' ? '50%' : rounded === 'sm' ? 4 : rounded === 'lg' ? 8 : 6;

    if (!cfg) {
        // Generic fallback: initials
        const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        return (
            <div className={`flex items-center justify-center flex-shrink-0 font-bold select-none ${className}`}
                style={{ width: size, height: size, borderRadius: r, backgroundColor: '#6c757d', color: '#fff', fontSize: size * 0.35, ...style }}>
                {initials}
            </div>
        );
    }

    const { bg, Icon, iconColor } = cfg;
    return (
        <div className={`flex items-center justify-center flex-shrink-0 select-none ${className}`}
            style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, ...style }}>
            <Icon c={iconColor} />
        </div>
    );
};

// ─── PlatformLabel: badge + name inline ──────────────────────────────────────
export const PlatformLabel = ({ name, size = 24, showName = true, className = '' }) => {
    const cfg = resolveConfig(name);
    const displayName = cfg?.name || name || '—';
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <PlatformBadge name={name} size={size} />
            {showName && <span className="text-xs font-medium" style={{ color: '#495057' }}>{displayName}</span>}
        </div>
    );
};

export default PlatformBadge;
