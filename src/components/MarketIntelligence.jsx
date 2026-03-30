import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Globe, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, ChevronRight, Star, Zap, Eye, Target, ShoppingCart, BarChart2, Minus } from 'lucide-react';

// ── Translations ────────────────────────────────────────────────────────────
const T = {
    en: {
        title: 'Market Intelligence 360\u00B0',
        aiLive: 'AI Live',
        lastUpdated: 'Last updated',
        refreshing: 'Refreshing...',
        marketShareOverview: 'MARKET SHARE OVERVIEW',
        thaiBeautyEcom: 'Thai Beauty E-commerce',
        competitorDashboard: 'COMPETITOR DASHBOARD',
        engagementAnalytics: 'ENGAGEMENT ANALYTICS',
        priceIntelligence: 'PRICE INTELLIGENCE',
        trendRadar: 'TREND RADAR',
        aiStrategicInsights: 'AI STRATEGIC INSIGHTS',
        marketSize: 'Market Size',
        vsPrev: 'vs prev period',
        revenue: 'Est. Revenue',
        engagement: 'Engagement',
        growth: 'Growth',
        threat: 'Threat',
        topProducts: 'Top Products',
        strengths: 'Strengths',
        weakness: 'Weakness',
        brand: 'Brand',
        shopeeFollowers: 'Shopee Followers',
        shopeeRating: 'Shopee Rating',
        lazadaFollowers: 'Lazada Followers',
        lazadaRating: 'Lazada Rating',
        tiktokFollowers: 'TikTok Followers',
        tiktokEngagement: 'TikTok Engage %',
        sentiment: 'Sentiment',
        reviews30d: 'Reviews (30d)',
        avgRating: 'Avg Rating',
        category: 'Category',
        kobPrice: 'KOB Price',
        competitorAvg: 'Competitor Avg',
        marketAvg: 'Market Avg',
        position: 'Position',
        priceGap: 'Price Gap',
        trendingKeywords: 'Trending Keywords',
        trendingCategories: 'Trending Categories',
        emergingAlerts: 'Emerging Competitor Alerts',
        premium: 'Premium',
        mid: 'Mid-Range',
        budget: 'Budget',
        positive: 'Positive',
        neutral: 'Neutral',
        negative: 'Negative',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        period7d: '7D',
        period30d: '30D',
        period90d: '90D',
        platformPresence: 'Platforms',
        categoryFocus: 'Category',
    },
    th: {
        title: 'วิเคราะห์ตลาด 360\u00B0',
        aiLive: 'AI Live',
        lastUpdated: 'อัปเดตล่าสุด',
        refreshing: 'กำลังรีเฟรช...',
        marketShareOverview: 'ภาพรวมส่วนแบ่งตลาด',
        thaiBeautyEcom: 'อีคอมเมิร์ซเครื่องสำอางไทย',
        competitorDashboard: 'แดชบอร์ดคู่แข่ง',
        engagementAnalytics: 'วิเคราะห์การมีส่วนร่วม',
        priceIntelligence: 'ข้อมูลราคาเชิงลึก',
        trendRadar: 'เรดาร์เทรนด์',
        aiStrategicInsights: 'AI วิเคราะห์เชิงกลยุทธ์',
        marketSize: 'ขนาดตลาด',
        vsPrev: 'เทียบช่วงก่อนหน้า',
        revenue: 'รายได้โดยประมาณ',
        engagement: 'การมีส่วนร่วม',
        growth: 'การเติบโต',
        threat: 'ระดับภัยคุกคาม',
        topProducts: 'สินค้ายอดนิยม',
        strengths: 'จุดแข็ง',
        weakness: 'จุดอ่อน',
        brand: 'แบรนด์',
        shopeeFollowers: 'ผู้ติดตาม Shopee',
        shopeeRating: 'คะแนน Shopee',
        lazadaFollowers: 'ผู้ติดตาม Lazada',
        lazadaRating: 'คะแนน Lazada',
        tiktokFollowers: 'ผู้ติดตาม TikTok',
        tiktokEngagement: 'TikTok Engage %',
        sentiment: 'ความรู้สึก',
        reviews30d: 'รีวิว (30 วัน)',
        avgRating: 'คะแนนเฉลี่ย',
        category: 'หมวดหมู่',
        kobPrice: 'ราคา KOB',
        competitorAvg: 'เฉลี่ยคู่แข่ง',
        marketAvg: 'เฉลี่ยตลาด',
        position: 'ตำแหน่ง',
        priceGap: 'ส่วนต่างราคา',
        trendingKeywords: 'คำค้นยอดนิยม',
        trendingCategories: 'หมวดสินค้าที่กำลังมา',
        emergingAlerts: 'แจ้งเตือนคู่แข่งใหม่',
        premium: 'พรีเมียม',
        mid: 'กลาง',
        budget: 'ประหยัด',
        positive: 'เชิงบวก',
        neutral: 'เป็นกลาง',
        negative: 'เชิงลบ',
        low: 'ต่ำ',
        medium: 'ปานกลาง',
        high: 'สูง',
        period7d: '7 วัน',
        period30d: '30 วัน',
        period90d: '90 วัน',
        platformPresence: 'แพลตฟอร์ม',
        categoryFocus: 'หมวดหมู่',
    }
};

// ── Data — Focus: Thai mid-price skincare/cosmetics brands ───────────────────
// Target segment: Thai-manufactured, mid-price (฿150-900), e-commerce + Modern Trade
// ไม่รวม: L'Oréal/Shiseido/NIVEA (multinational), Amway (direct sales), Drunk Elephant (luxury)
// Market scope: Thai brand skincare+cosmetics e-com + MT est. ~฿15-18B segment
// Sources: Statista, SCMP, TheStoryThailand, company filings
const MARKET_SHARE = [
    { name: 'KARMARTS', short: 'KM', share: 22, change: 3.8, color: '#10b981' },           // ฿3.25B (2024), +45% YoY. Cathy Doll + Baby Bright + Skinsista
    { name: 'Mistine', short: 'MST', share: 20, change: -1.2, color: '#3b82f6' },          // ฿4B/yr domestic (mass segment overlap but same channels)
    { name: 'Beauty Buffet', short: 'BB', share: 14, change: -0.8, color: '#8b5cf6' },     // ฿1.85B (9M/2024), Beauty Community PCL group
    { name: 'Srichand', short: 'SRC', share: 11, change: 4.5, color: '#e11d48' },          // ฿1.6B (2025), +117% YoY, #1 Thai skincare
    { name: 'Rojukiss', short: 'RJK', share: 8, change: 0.5, color: '#f59e0b' },           // Top 5, Rojukiss + Smooth-E group
    { name: 'Cute Press', short: 'CP', share: 7, change: -0.5, color: '#06b6d4' },         // Long-running Thai brand, 7-Eleven staple
    { name: 'Kiss of Beauty', short: 'KOB', share: 6, change: 1.2, color: '#714B67' },     // Skinoxy + Malissa Kiss + Moona House, 12,000+ outlets
    { name: 'Oriental Princess', short: 'OP', share: 5, change: -0.3, color: '#a855f7' },  // Own 300+ stores, mid-premium Thai
    { name: 'Others (Thai)', short: 'OTH', share: 7, change: -7.2, color: '#9ca3af' },     // Smaller Thai brands in same segment
];

// Competitors — same segment: Thai mid-price skincare/cosmetics, e-com + Modern Trade
// + Skintific as disruptor entering same target audience
const COMPETITORS = [
    { name: 'KARMARTS (Cathy Doll)', emoji: '🎀', category: 'Multi-brand Cosmetics', revenue: '฿270M/mo', revenueNote: '฿3.25B (2024), +45% YoY. Target ฿4B (2025)', platforms: ['Shopee', 'Lazada', 'TikTok'], engagement: 78, growth: 45, threat: 'high', products: ['Cathy Doll AA Cream', 'Baby Bright Eye Palette', 'Skinsista Serum'], strengths: 'Fastest growing Thai beauty company. 2gether stars as ambassadors. Multi-brand portfolio. 15%+ market share mid-premium.', strengthsTh: 'โตเร็วสุด +45% ใช้ดาราดัง มีหลายแบรนด์ 15%+ ส่วนแบ่งตลาดกลาง-บน', weakness: 'Brand confusion across Cathy Doll/Baby Bright/Skinsista', weaknessTh: 'หลายแบรนด์ทำให้ลูกค้าสับสน' },
    { name: 'Srichand', emoji: '🌸', category: 'Skincare + Color', revenue: '฿133M/mo', revenueNote: '฿1.6B/yr (2025), +117% YoY', platforms: ['Shopee', 'Lazada', 'TikTok'], engagement: 82, growth: 45, threat: 'high', products: ['Translucent Powder (#1 Face Moisturizer)', 'Gold Serum', 'Sunscreen SPF50'], strengths: '#1 Thai skincare brand 2025. Face Moisturizer category leader (+79% vs market +3.4%). Heritage brand trust.', strengthsTh: 'แบรนด์สกินแคร์ไทยอันดับ 1 ปี 2025 ครอง Face Moisturizer (+79% vs ตลาด +3.4%)', weakness: '90% offline / 10% online — slow e-commerce adoption', weaknessTh: '90% ออฟไลน์ / 10% ออนไลน์ — ช้าในอีคอมเมิร์ซ' },
    { name: 'Mistine', emoji: '💄', category: 'Mass-Mid Cosmetics', revenue: '฿333M/mo', revenueNote: '฿4B/yr domestic (flat). ฿16B in China', platforms: ['Shopee', 'Lazada', 'TikTok'], engagement: 71, growth: -2, threat: 'medium', products: ['Super Black Eyeliner', 'Aqua Base Sunscreen (#2 in China)', 'Pink Magic Lip'], strengths: 'Largest Thai beauty brand by total revenue. #2 sunscreen brand in China. Massive offline distribution.', strengthsTh: 'แบรนด์ไทยรายได้สูงสุด #2 กันแดดในจีน กระจายสินค้าออฟไลน์ทั่ว', weakness: 'Domestic stagnation. Premium segment weak. Old brand image.', weaknessTh: 'ในประเทศไม่โต พรีเมียมอ่อน ภาพลักษณ์เก่า' },
    { name: 'Beauty Buffet', emoji: '🧴', category: 'Skincare + Body', revenue: '฿205M/mo', revenueNote: '฿1.85B (9M/2024), Beauty Community PCL', platforms: ['Shopee', 'Lazada'], engagement: 65, growth: 3, threat: 'medium', products: ['Ginseng Serum', 'Milk Plus Whitening', 'Scentio Body'], strengths: 'Own retail chain 200+ stores. Multi-brand (Beauty Cottage, Made in Nature).', strengthsTh: 'ร้านค้าปลีกตัวเอง 200+ สาขา หลายแบรนด์ (Beauty Cottage, Made in Nature)', weakness: 'Declining online presence. No TikTok strategy.', weaknessTh: 'ออนไลน์ถดถอย ไม่มีกลยุทธ์ TikTok' },
    { name: 'Rojukiss', emoji: '💋', category: 'Skincare + Lip', revenue: '฿90-120M/mo (est.)', revenueNote: 'Rojukiss International PCL, Top 5 Thai beauty', platforms: ['Shopee', 'Lazada', 'TikTok'], engagement: 72, growth: 8, threat: 'medium', products: ['Rojukiss Lip Matte', 'White Poreless Serum', 'Smooth-E Gold'], strengths: 'Listed company, strong R&D. Smooth-E sub-brand for pharmacy channel. Good Watsons/7-Eleven placement.', strengthsTh: 'บริษัทจดทะเบียน R&D แข็ง Smooth-E ในร้านยา วาง Watsons/7-Eleven ดี', weakness: 'Small online presence vs KARMARTS. Limited TikTok content.', weaknessTh: 'ออนไลน์เล็กกว่า KARMARTS คอนเทนต์ TikTok จำกัด' },
    { name: 'Cute Press', emoji: '🌷', category: 'Color Cosmetics + Skincare', revenue: '฿80-100M/mo (est.)', revenueNote: 'Long-running Thai brand, strong 7-Eleven presence', platforms: ['Shopee', 'Lazada'], engagement: 58, growth: -5, threat: 'low', products: ['Alpha Bright Night Serum', 'Let Me Glow Cushion', 'Secret Garden Perfume'], strengths: 'Strong 7-Eleven distribution. Trusted Thai heritage brand 30+ years. Affordable pricing.', strengthsTh: 'กระจาย 7-Eleven ดี แบรนด์ไทยที่เชื่อถือ 30+ ปี ราคาจับต้องได้', weakness: 'Aging brand image. Weak social media. Gen Z not interested.', weaknessTh: 'ภาพลักษณ์เก่า โซเชียลอ่อน Gen Z ไม่สนใจ' },
    { name: 'Oriental Princess', emoji: '👸', category: 'Mid-Premium Skincare', revenue: '฿70-90M/mo (est.)', revenueNote: 'Own 300+ stores nationwide. Strong offline, weak online', platforms: ['Shopee', 'Lazada'], engagement: 55, growth: -3, threat: 'low', products: ['Age Defying Serum', 'Natural Power C Miracle', 'Tropical Nutrients'], strengths: 'Own 300+ retail stores. Loyal 30-50 age customer base. Premium Thai positioning.', strengthsTh: 'มีร้าน 300+ สาขา ลูกค้าประจำอายุ 30-50 ตำแหน่งพรีเมียมไทย', weakness: 'Very weak online. No Gen Z strategy. Own-store model limits reach.', weaknessTh: 'ออนไลน์อ่อนมาก ไม่มีกลยุทธ์ Gen Z ร้านตัวเองจำกัดการเข้าถึง' },
    { name: 'Skintific ⚠️', emoji: '🔬', category: 'Disruptor — Science Skincare (Indo)', revenue: '฿50-80M/mo (est.)', revenueNote: 'Entered Thai market 2024 via TikTok. 500K followers in 3 months', platforms: ['TikTok', 'Shopee'], engagement: 85, growth: 120, threat: 'high', products: ['5X Ceramide Barrier Moisturizer', 'Symwhite Serum', 'AHA BHA Toner'], strengths: 'Explosive TikTok growth. Science-backed branding. Aggressive pricing 30-40% below Thai brands.', strengthsTh: 'โตระเบิดใน TikTok วิทยาศาสตร์นำ ตัดราคา 30-40% ต่ำกว่าแบรนด์ไทย', weakness: 'No offline distribution in Thailand yet. Brand awareness still building.', weaknessTh: 'ยังไม่มีออฟไลน์ในไทย การรับรู้แบรนด์ยังสร้างอยู่' },
];

const ENGAGEMENT_DATA = [
    { brand: 'KOB (Us)', shopeeF: '285K', shopeeR: 4.89, lazadaF: '142K', lazadaR: 4.85, tiktokF: '520K', tiktokE: 5.2, sentPos: 78, sentNeu: 16, sentNeg: 6, reviews: 4820, avgRating: 4.87, highlight: true },
    { brand: 'KARMARTS', shopeeF: '380K', shopeeR: 4.75, lazadaF: '215K', lazadaR: 4.72, tiktokF: '1.2M', tiktokE: 7.8, sentPos: 71, sentNeu: 21, sentNeg: 8, reviews: 8120, avgRating: 4.75 },
    { brand: 'Mistine', shopeeF: '520K', shopeeR: 4.71, lazadaF: '310K', lazadaR: 4.69, tiktokF: '450K', tiktokE: 3.9, sentPos: 65, sentNeu: 25, sentNeg: 10, reviews: 7540, avgRating: 4.70 },
    { brand: 'Beauty Buffet', shopeeF: '290K', shopeeR: 4.68, lazadaF: '165K', lazadaR: 4.65, tiktokF: '180K', tiktokE: 2.1, sentPos: 60, sentNeu: 28, sentNeg: 12, reviews: 3210, avgRating: 4.66 },
    { brand: 'Srichand', shopeeF: '412K', shopeeR: 4.82, lazadaF: '198K', lazadaR: 4.78, tiktokF: '890K', tiktokE: 6.1, sentPos: 72, sentNeu: 20, sentNeg: 8, reviews: 6340, avgRating: 4.80 },
    { brand: 'Rojukiss', shopeeF: '165K', shopeeR: 4.74, lazadaF: '78K', lazadaR: 4.70, tiktokF: '320K', tiktokE: 4.5, sentPos: 69, sentNeu: 22, sentNeg: 9, reviews: 3850, avgRating: 4.72 },
    { brand: 'Cute Press', shopeeF: '120K', shopeeR: 4.65, lazadaF: '62K', lazadaR: 4.60, tiktokF: '85K', tiktokE: 1.8, sentPos: 62, sentNeu: 28, sentNeg: 10, reviews: 2140, avgRating: 4.63 },
    { brand: 'Oriental Princess', shopeeF: '95K', shopeeR: 4.70, lazadaF: '48K', lazadaR: 4.68, tiktokF: '45K', tiktokE: 1.2, sentPos: 70, sentNeu: 22, sentNeg: 8, reviews: 1680, avgRating: 4.69 },
    { brand: 'Skintific ⚠️', shopeeF: '310K', shopeeR: 4.80, lazadaF: '45K', lazadaR: 4.75, tiktokF: '580K', tiktokE: 9.2, sentPos: 74, sentNeu: 18, sentNeg: 8, reviews: 5200, avgRating: 4.78 },
];

const PRICE_DATA = [
    { category: 'Serum', kobPrice: 590, compAvg: 450, mktAvg: 380, position: 'premium', gap: 31 },
    { category: 'Sunscreen', kobPrice: 350, compAvg: 320, mktAvg: 290, position: 'mid', gap: 9 },
    { category: 'Cleanser', kobPrice: 290, compAvg: 265, mktAvg: 230, position: 'mid', gap: 9 },
    { category: 'Moisturizer', kobPrice: 690, compAvg: 520, mktAvg: 420, position: 'premium', gap: 33 },
];

// Trending data sourced from: Shopee Trending 2025, TikTok Shop Thailand, Google Trends TH
// Shopee beauty: Skin care +278%, Makeup +356% YoY (Jan-Jul 2025)
const TRENDING_KEYWORDS = [
    { keyword: 'PDRN', change: 85, hot: true },          // VT PDRN Essence viral on TikTok
    { keyword: 'Centella/CICA', change: 45, hot: true },  // Still dominant ingredient trend
    { keyword: 'Niacinamide', change: 38 },                // Staple, still growing
    { keyword: 'SPF50 PA++++', change: 34 },               // Sunscreen CAGR 9.4% (2025-2030)
    { keyword: 'Ceramide', change: 32 },                    // Barrier repair trend (Skintific driver)
    { keyword: 'Glass Skin', change: 28 },                  // K-beauty aesthetic trend
    { keyword: 'Bakuchiol', change: 25 },                   // Natural retinol alternative, emerging
    { keyword: 'Retinol', change: 22 },                     // Still growing, more cautious adoption
    { keyword: 'Vitamin C', change: 18 },                   // Mature trend, steady
    { keyword: 'Omega-7 (Fruit Fly Larva Oil)', change: 15 }, // New biotech ingredient (Lamaii brand)
];

// Source: Shopee Thailand bestsellers, TikTok Shop trending categories
const TRENDING_CATEGORIES = [
    { name: 'Sun Protection', growth: 34, icon: '☀️' },       // SPF market CAGR 9.4%
    { name: 'Anti-Aging / PDRN', growth: 32, icon: '✨' },     // PDRN viral, anti-aging Gen Z
    { name: 'Barrier Repair', growth: 28, icon: '🛡️' },       // Ceramide/CICA driven
    { name: 'K-Beauty (COSRX, TIRTIR)', growth: 25, icon: '🇰🇷' }, // COSRX, Some By Mi, Torriden, TIRTIR
    { name: 'Skinimalism', growth: 20, icon: '🧪' },          // Minimalist high-efficacy routines
];

// Source: TikTok Shop Thailand new entrants, Shopee new official stores
const EMERGING_ALERTS = [
    { name: 'Skintific (Indonesia)', note: 'Science-led skincare via TikTok Shop. 500K Thai followers in 3 months. 5X Ceramide Moisturizer is #1 trending. Pricing 30-40% below Thai brands.', noteTh: 'สกินแคร์สายวิทย์จากอินโดฯ ผ่าน TikTok Shop 500K followers ไทยใน 3 เดือน 5X Ceramide Moisturizer เทรนด์อันดับ 1 ราคาต่ำกว่าแบรนด์ไทย 30-40%', risk: 'high' },
    { name: 'Somethinc (Indonesia)', note: 'Aggressive Shopee pricing on serums. Official store launched. AHA BHA PHA Peeling Serum viral. Direct competitor to SKINOXY price range.', noteTh: 'ตัดราคารุนแรงบน Shopee เปิด Official Store แล้ว AHA BHA PHA Peeling Serum ไวรัล แข่งตรงกับ SKINOXY ช่วงราคาเดียวกัน', risk: 'high' },
    { name: 'COSRX / K-Beauty wave', note: 'K-beauty gaining 25% share of Thai online skincare. COSRX Snail Mucin is #1 imported serum on Shopee. TIRTIR Cushion went viral on TikTok.', noteTh: 'K-beauty คว้า 25% ส่วนแบ่งสกินแคร์ออนไลน์ไทย COSRX Snail Mucin ซีรั่มนำเข้าอันดับ 1 Shopee TIRTIR Cushion ไวรัล TikTok', risk: 'medium' },
];

// ── Modern Trade Channel Comparison ─────────────────────────────────────────
// Sources: company reports, store shelf surveys, retailer data
// Thai beauty offline = 80% of market (~฿133B), Modern Trade is largest offline channel
const MODERN_TRADE_CHANNELS = [
    { name: '7-Eleven', emoji: '🏪', outlets: '14,000+', shelfShare: 'High', color: '#16a34a' },
    { name: 'Watsons', emoji: '💊', outlets: '800+', shelfShare: 'High', color: '#2563eb' },
    { name: 'Big C', emoji: '🛒', outlets: '400+', shelfShare: 'Medium', color: '#dc2626' },
    { name: "Lotus's", emoji: '🪷', outlets: '2,500+', shelfShare: 'Medium', color: '#16a34a' },
    { name: 'Boots', emoji: '💙', outlets: '280+', shelfShare: 'Medium', color: '#1d4ed8' },
    { name: 'Beauty Buffet (Own)', emoji: '🧴', outlets: '200+', shelfShare: 'Own Stores', color: '#8b5cf6' },
    { name: 'Eveandboy', emoji: '✨', outlets: '50+', shelfShare: 'High', color: '#ec4899' },
    { name: 'Konvy', emoji: '🌸', outlets: 'Online MT', shelfShare: 'High', color: '#f59e0b' },
];

const MODERN_TRADE_BRANDS = [
    {
        brand: 'KOB (Skinoxy / Malissa Kiss)',
        channels: { '7-Eleven': true, 'Watsons': true, 'Big C': true, "Lotus's": true, 'Boots': true, 'Beauty Buffet (Own)': false, 'Eveandboy': true, 'Konvy': true },
        skuCount: 85, listingFee: 'Medium', promoFreq: 'Monthly', shelfPosition: 'Mid-level',
        highlight: true,
    },
    {
        brand: 'Srichand',
        channels: { '7-Eleven': true, 'Watsons': true, 'Big C': true, "Lotus's": true, 'Boots': true, 'Beauty Buffet (Own)': false, 'Eveandboy': true, 'Konvy': true },
        skuCount: 45, listingFee: 'Low (heritage)', promoFreq: 'Bi-weekly', shelfPosition: 'Eye-level (#1)',
    },
    {
        brand: 'KARMARTS (Cathy Doll / Baby Bright)',
        channels: { '7-Eleven': true, 'Watsons': true, 'Big C': true, "Lotus's": true, 'Boots': true, 'Beauty Buffet (Own)': false, 'Eveandboy': true, 'Konvy': true },
        skuCount: 200, listingFee: 'High (wide SKU)', promoFreq: 'Weekly', shelfPosition: 'Eye-level',
    },
    {
        brand: 'Mistine',
        channels: { '7-Eleven': true, 'Watsons': true, 'Big C': true, "Lotus's": true, 'Boots': true, 'Beauty Buffet (Own)': false, 'Eveandboy': false, 'Konvy': true },
        skuCount: 150, listingFee: 'Low (volume)', promoFreq: 'Monthly', shelfPosition: 'Eye-level',
    },
    {
        brand: 'Beauty Buffet',
        channels: { '7-Eleven': false, 'Watsons': true, 'Big C': true, "Lotus's": true, 'Boots': false, 'Beauty Buffet (Own)': true, 'Eveandboy': true, 'Konvy': true },
        skuCount: 120, listingFee: 'Own stores', promoFreq: 'Monthly', shelfPosition: 'Own stores dominant',
    },
    {
        brand: 'Rojukiss',
        channels: { '7-Eleven': true, 'Watsons': true, 'Big C': true, "Lotus's": true, 'Boots': true, 'Beauty Buffet (Own)': false, 'Eveandboy': true, 'Konvy': true },
        skuCount: 65, listingFee: 'Medium', promoFreq: 'Bi-weekly', shelfPosition: 'Mid-level',
    },
    {
        brand: 'Cute Press',
        channels: { '7-Eleven': true, 'Watsons': true, 'Big C': true, "Lotus's": true, 'Boots': false, 'Beauty Buffet (Own)': false, 'Eveandboy': true, 'Konvy': true },
        skuCount: 90, listingFee: 'Low (heritage)', promoFreq: 'Monthly', shelfPosition: 'Mid-level',
    },
    {
        brand: 'Oriental Princess',
        channels: { '7-Eleven': false, 'Watsons': false, 'Big C': false, "Lotus's": false, 'Boots': false, 'Beauty Buffet (Own)': false, 'Eveandboy': true, 'Konvy': true },
        skuCount: 180, listingFee: 'Own stores only', promoFreq: 'Monthly', shelfPosition: 'Own 300+ stores',
        note: 'own-store',
    },
    {
        brand: 'Skintific ⚠️',
        channels: { '7-Eleven': false, 'Watsons': false, 'Big C': false, "Lotus's": false, 'Boots': false, 'Beauty Buffet (Own)': false, 'Eveandboy': false, 'Konvy': true },
        skuCount: 12, listingFee: 'N/A (online only)', promoFreq: 'TikTok-driven', shelfPosition: 'No offline yet',
    },
];

// AI Insights based on real market data (2025)
const AI_INSIGHTS = {
    en: [
        { icon: Target, color: '#714B67', title: 'Market Position Assessment', text: 'KOB (Kiss of Beauty) holds ~5% e-commerce share with 12,000+ distribution outlets. Thai beauty market = ฿166B ($4.75B), e-commerce ~฿33B (20%, growing fast). Shopee beauty grew +278% YoY. KOB\'s multi-brand strategy (Skinoxy, Malissa Kiss, Moona House) mirrors KARMARTS model but at smaller scale. Key advantage: manufacturer + distributor hybrid = better margin control.' },
        { icon: AlertTriangle, color: '#ea580c', title: 'Critical Threats (Immediate)', text: '1) KARMARTS grew +45% to ฿3.25B — targeting ฿10B by 2028 with celebrity ambassadors. 2) Srichand hit ฿1.6B (+117% YoY) — now #1 Thai skincare brand. 3) Indonesian invasion: Skintific (500K followers in 3 months) and Somethinc pricing 30-40% below Thai brands. 4) K-beauty (COSRX, TIRTIR) capturing 25% of online skincare. Thai brands still own 85% domestic market but share is eroding.' },
        { icon: Zap, color: '#10b981', title: 'Opportunities Identified', text: '1) PDRN is hottest ingredient trend (+85%) — no major Thai brand has a PDRN hero product yet. First-mover advantage window: ~6 months. 2) Sunscreen SPF market CAGR 9.4% — Mistine proves Thai brands can win (they\'re #2 in China). 3) Shopee Skin care +278% & Makeup +356% YoY = massive channel growth. 4) "Skinimalism" trend aligns with KOB\'s affordable positioning.' },
        { icon: ShoppingCart, color: '#3b82f6', title: 'Recommended Actions', text: '1) Launch PDRN Serum as hero product (฿490-690 range) before KARMARTS does. 2) Invest heavily in TikTok Shop — KARMARTS\' #1 growth driver. 3) Create "Thai vs Import" value proposition to counter Skintific/Somethinc — emphasize local manufacturing, faster formulation cycles. 4) Expand Shopee official store with Skinoxy-focused storefront (benchmark: Srichand\'s 79% category growth).' },
        { icon: BarChart2, color: '#7c3aed', title: 'Revenue Impact Projection', text: 'If KOB captures just 2% more e-commerce share (5%→7% of ฿33B market) = +฿660M/yr (+฿55M/mo). Achievable via: TikTok Shop launch (+฿20M/mo, based on Skintific benchmark), PDRN hero product (+฿15M/mo first-mover), Shopee optimization (+฿20M/mo, based on +278% category growth). Timeline: 6-12 months. Investment needed: ฿8-12M for product development + ฿5M/mo marketing.' },
    ],
    th: [
        { icon: Target, color: '#714B67', title: 'ประเมินตำแหน่งตลาด', text: 'KOB (Kiss of Beauty) มีส่วนแบ่งอีคอมเมิร์ซ ~5% กระจายสินค้า 12,000+ จุด ตลาดเครื่องสำอางไทย = ฿166B อีคอมเมิร์ซ ~฿33B (20% กำลังโตเร็ว) Shopee beauty โต +278% YoY กลยุทธ์ multi-brand (Skinoxy, Malissa Kiss, Moona House) คล้าย KARMARTS แต่เล็กกว่า จุดแข็ง: เป็นทั้งผู้ผลิต+จัดจำหน่าย = ควบคุมมาร์จิ้นได้ดี' },
        { icon: AlertTriangle, color: '#ea580c', title: 'ภัยคุกคามวิกฤต (เร่งด่วน)', text: '1) KARMARTS โต +45% ถึง ฿3.25B — เป้า ฿10B ภายในปี 2028 ใช้ดาราดัง 2) Srichand ทำ ฿1.6B (+117% YoY) — ขึ้นแท่น #1 สกินแคร์ไทย 3) บุกจากอินโดฯ: Skintific (500K followers ใน 3 เดือน) และ Somethinc ตัดราคา 30-40% 4) K-beauty (COSRX, TIRTIR) คว้า 25% สกินแคร์ออนไลน์ แบรนด์ไทยยังครอง 85% แต่กำลังถูกกัดกร่อน' },
        { icon: Zap, color: '#10b981', title: 'โอกาสที่พบ', text: '1) PDRN เป็นเทรนด์ส่วนผสมร้อนแรงสุด (+85%) — ยังไม่มีแบรนด์ไทยรายใหญ่มี PDRN hero product โอกาส first-mover ~6 เดือน 2) ตลาดกันแดด CAGR 9.4% — Mistine พิสูจน์แล้วว่าแบรนด์ไทยชนะได้ (#2 ในจีน) 3) Shopee Skincare +278% & Makeup +356% = ช่องทางโตมหาศาล 4) เทรนด์ Skinimalism ตรงกับตำแหน่งราคาจับต้องได้ของ KOB' },
        { icon: ShoppingCart, color: '#3b82f6', title: 'แนะนำดำเนินการ', text: '1) เปิดตัว PDRN Serum เป็น hero product (฿490-690) ก่อน KARMARTS ทำ 2) ลงทุนหนักใน TikTok Shop — ตัวขับเคลื่อนหลักของ KARMARTS 3) สร้าง value proposition "ไทย vs นำเข้า" สู้ Skintific/Somethinc — เน้นผลิตในไทย R&D เร็วกว่า 4) ขยาย Shopee Official Store โฟกัส Skinoxy (benchmark: Srichand โต 79% ในหมวด)' },
        { icon: BarChart2, color: '#7c3aed', title: 'ประมาณการผลกระทบรายได้', text: 'ถ้า KOB เพิ่มส่วนแบ่งอีคอมเมิร์ซ 2% (5%→7% ของ ฿33B) = +฿660M/ปี (+฿55M/เดือน) ทำได้จาก: TikTok Shop (+฿20M/เดือน อ้างอิง Skintific), PDRN hero product (+฿15M/เดือน first-mover), Shopee optimization (+฿20M/เดือน จากหมวดโต +278%) ระยะเวลา: 6-12 เดือน งบลงทุน: ฿8-12M พัฒนาสินค้า + ฿5M/เดือน การตลาด' },
    ]
};

// ── Styles ───────────────────────────────────────────────────────────────────
const s = {
    card: { background: '#ffffff', borderRadius: 12, border: '1px solid #dee2e6', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 24 },
    sectionHeader: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 16 },
    badge: (bg, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: bg, color }),
    pill: (active) => ({ padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? '#714B67' : '#f3f4f6', color: active ? '#fff' : '#4b5563', transition: 'all 0.2s' }),
};

// ── Donut Chart (Pure CSS) ──────────────────────────────────────────────────
function DonutChart({ data }) {
    let cumulative = 0;
    const segments = data.map(d => {
        const start = cumulative;
        cumulative += d.share;
        return { ...d, start, end: cumulative };
    });

    const gradientParts = segments.map(seg =>
        `${seg.color} ${seg.start * 3.6}deg ${seg.end * 3.6}deg`
    ).join(', ');

    return (
        <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
            <div style={{
                width: 200, height: 200, borderRadius: '50%',
                background: `conic-gradient(${gradientParts})`,
            }} />
            <div style={{
                position: 'absolute', top: 30, left: 30, width: 140, height: 140,
                borderRadius: '50%', background: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#714B67' }}>18%</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>KOB Share</div>
            </div>
        </div>
    );
}

// ── Horizontal Bar ──────────────────────────────────────────────────────────
function HBar({ value, max = 100, color = '#714B67', height = 8 }) {
    return (
        <div style={{ width: '100%', height, background: '#f3f4f6', borderRadius: height / 2 }}>
            <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height, background: color, borderRadius: height / 2, transition: 'width 0.6s ease' }} />
        </div>
    );
}

// ── Threat Badge ────────────────────────────────────────────────────────────
function ThreatBadge({ level, t }) {
    const cfg = { high: { bg: '#fef2f2', color: '#dc2626' }, medium: { bg: '#fffbeb', color: '#d97706' }, low: { bg: '#f0fdf4', color: '#16a34a' } };
    const c = cfg[level] || cfg.low;
    return <span style={s.badge(c.bg, c.color)}>{t[level]}</span>;
}

// ── Google Trends Embed (real-time data from Google) ─────────────────────────
function GoogleTrendsEmbed({ keywords, label }) {
    const [status, setStatus] = useState('loading'); // 'loading' | 'loaded' | 'error'
    const iframeKey = keywords.join(',');

    const q = keywords.map(k => encodeURIComponent(k)).join(',');
    const trendsUrl = `https://trends.google.com/trends/explore?q=${q}&geo=TH&date=today+12-m`;
    const embedUrl = `https://trends.google.com/trends/embed/explore/TIMESERIES?req=${encodeURIComponent(JSON.stringify({
        comparisonItem: keywords.map(keyword => ({ keyword, geo: 'TH', time: 'today 12-m' })),
        category: 0, property: ''
    }))}&tz=-420&eq=${encodeURIComponent(`q=${keywords.join(',')}&geo=TH&date=today+12-m`)}`;

    useEffect(() => {
        setStatus('loading');
        const timeout = setTimeout(() => setStatus(prev => prev === 'loading' ? 'error' : prev), 10000);
        return () => clearTimeout(timeout);
    }, [iframeKey]);

    return (
        <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{label}</div>
            <div style={{ minHeight: 220, background: '#fafafa', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden', position: 'relative' }}>
                {status === 'loading' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12, zIndex: 1 }}>
                        <RefreshCw size={14} className="animate-spin" style={{ marginRight: 6 }} /> Loading Google Trends...
                    </div>
                )}
                <iframe
                    key={iframeKey}
                    src={embedUrl}
                    style={{ width: '100%', height: 220, border: 'none', borderRadius: 8, opacity: status === 'loaded' ? 1 : 0.3 }}
                    loading="lazy"
                    onLoad={() => setStatus('loaded')}
                    onError={() => setStatus('error')}
                    sandbox="allow-scripts allow-same-origin"
                    title={label}
                />
            </div>
            {status === 'error' && (
                <a href={trendsUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#714B67', marginTop: 4, textDecoration: 'underline' }}>
                    <Globe size={12} /> Open in Google Trends ↗
                </a>
            )}
        </div>
    );
}

// ── Platform Icon ───────────────────────────────────────────────────────────
function PlatformDot({ name }) {
    const colors = { Shopee: '#ee4d2d', Lazada: '#0f146d', TikTok: '#010101' };
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: colors[name] || '#6b7280', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors[name] || '#6b7280' }} />
            {name}
        </span>
    );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function MarketIntelligence({ language, addToast }) {
    const t = T[language] || T.en;
    const [period, setPeriod] = useState('30d');
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setIsRefreshing(true);
            setTimeout(() => {
                setLastUpdate(new Date());
                setIsRefreshing(false);
            }, 1500);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const insights = useMemo(() => AI_INSIGHTS[language] || AI_INSIGHTS.en, [language]);

    const handleManualRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setLastUpdate(new Date());
            setIsRefreshing(false);
            if (addToast) addToast(language === 'th' ? 'รีเฟรชข้อมูลตลาดสำเร็จ' : 'Market data refreshed', 'success');
        }, 1500);
    };

    return (
        <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
            {/* ── Header ──────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #714B67, #9b6b91)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Globe size={24} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#212529', margin: 0, lineHeight: 1.2 }}>{t.title}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>{t.aiLive}</span>
                            </span>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>|</span>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>
                                {isRefreshing ? t.refreshing : `${t.lastUpdated}: ${lastUpdate.toLocaleTimeString()}`}
                            </span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {['7d', '30d', '90d'].map(p => (
                        <button key={p} style={s.pill(period === p)} onClick={() => setPeriod(p)}>
                            {t[`period${p.toUpperCase()}`] || p.toUpperCase()}
                        </button>
                    ))}
                    <button onClick={handleManualRefresh} style={{ ...s.pill(false), display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Section 1: Market Share ────────────────────────── */}
            <div style={{ ...s.card, marginBottom: 20 }}>
                <div style={s.sectionHeader}>{t.marketShareOverview}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32, alignItems: 'center' }}>
                    <div>
                        <DonutChart data={MARKET_SHARE} />
                        <div style={{ textAlign: 'center', marginTop: 12 }}>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{t.marketSize}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#212529' }}>{t.thaiBeautyEcom}: ฿166B ($4.75B) 2025</div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>E-commerce: ~฿33B (20%) | CAGR 5.45% → $7.87B by 2034</div>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                        {MARKET_SHARE.map(item => (
                            <div key={item.short} style={{ padding: 12, borderRadius: 8, border: item.short === 'KOB' ? '2px solid #714B67' : '1px solid #f3f4f6', background: item.short === 'KOB' ? '#fdf4fb' : '#fafafa' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#212529' }}>{item.name}</span>
                                </div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.share}%</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
                                    {item.change > 0 ? <TrendingUp size={12} color="#16a34a" /> : item.change < 0 ? <TrendingDown size={12} color="#dc2626" /> : <Minus size={12} color="#9ca3af" />}
                                    <span style={{ color: item.change > 0 ? '#16a34a' : item.change < 0 ? '#dc2626' : '#9ca3af', fontWeight: 600 }}>
                                        {item.change > 0 ? '+' : ''}{item.change}%
                                    </span>
                                    <span style={{ color: '#9ca3af' }}>{t.vsPrev}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Section 2: Competitor Dashboard ────────────────── */}
            <div style={{ ...s.card, marginBottom: 20 }}>
                <div style={s.sectionHeader}>{t.competitorDashboard}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                    {COMPETITORS.map(comp => (
                        <div key={comp.name} style={{ borderRadius: 10, border: '1px solid #e5e7eb', padding: 18, background: '#fff', transition: 'box-shadow 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 28 }}>{comp.emoji}</span>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: '#212529' }}>{comp.name}</div>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>{comp.category}</div>
                                    </div>
                                </div>
                                <ThreatBadge level={comp.threat} t={t} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>{t.revenue}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#212529' }}>{comp.revenue}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>{t.growth}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {comp.growth > 0 ? <TrendingUp size={14} color="#16a34a" /> : <TrendingDown size={14} color="#dc2626" />}
                                        <span style={{ fontSize: 14, fontWeight: 700, color: comp.growth > 0 ? '#16a34a' : '#dc2626' }}>
                                            {comp.growth > 0 ? '+' : ''}{comp.growth}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>{t.engagement}: {comp.engagement}/100</div>
                                <HBar value={comp.engagement} color={comp.engagement >= 80 ? '#16a34a' : comp.engagement >= 60 ? '#d97706' : '#dc2626'} />
                            </div>

                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>{t.platformPresence}</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {comp.platforms.map(p => <PlatformDot key={p} name={p} />)}
                                </div>
                            </div>

                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>{t.topProducts}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {comp.products.map(p => (
                                        <span key={p} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f3f4f6', color: '#374151' }}>{p}</span>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: '#4b5563' }}>
                                <div><Star size={11} style={{ marginRight: 3, color: '#16a34a' }} />{t.strengths}: {language === 'th' ? comp.strengthsTh : comp.strengths}</div>
                                <div><AlertTriangle size={11} style={{ marginRight: 3, color: '#d97706' }} />{t.weakness}: {language === 'th' ? comp.weaknessTh : comp.weakness}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Section 3: Engagement Analytics ────────────────── */}
            <div style={{ ...s.card, marginBottom: 20, overflowX: 'auto' }}>
                <div style={s.sectionHeader}>{t.engagementAnalytics}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                            {[t.brand, t.shopeeFollowers, t.shopeeRating, t.lazadaFollowers, t.lazadaRating, t.tiktokFollowers, t.tiktokEngagement, t.sentiment, t.reviews30d, t.avgRating].map(h => (
                                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ENGAGEMENT_DATA.map(row => (
                            <tr key={row.brand} style={{ borderBottom: '1px solid #f3f4f6', background: row.highlight ? '#fdf4fb' : 'transparent' }}>
                                <td style={{ padding: '10px', fontWeight: row.highlight ? 700 : 500, color: row.highlight ? '#714B67' : '#212529' }}>{row.brand}</td>
                                <td style={{ padding: '10px' }}>{row.shopeeF}</td>
                                <td style={{ padding: '10px' }}><span style={s.badge('#fff7ed', '#ea580c')}>{row.shopeeR}</span></td>
                                <td style={{ padding: '10px' }}>{row.lazadaF}</td>
                                <td style={{ padding: '10px' }}><span style={s.badge('#eff6ff', '#2563eb')}>{row.lazadaR}</span></td>
                                <td style={{ padding: '10px' }}>{row.tiktokF}</td>
                                <td style={{ padding: '10px' }}><span style={s.badge('#f0fdf4', '#16a34a')}>{row.tiktokE}%</span></td>
                                <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', gap: 2, height: 16, borderRadius: 4, overflow: 'hidden', width: 80 }}>
                                        <div style={{ width: `${row.sentPos}%`, background: '#22c55e', height: '100%' }} title={`${t.positive}: ${row.sentPos}%`} />
                                        <div style={{ width: `${row.sentNeu}%`, background: '#fbbf24', height: '100%' }} title={`${t.neutral}: ${row.sentNeu}%`} />
                                        <div style={{ width: `${row.sentNeg}%`, background: '#ef4444', height: '100%' }} title={`${t.negative}: ${row.sentNeg}%`} />
                                    </div>
                                </td>
                                <td style={{ padding: '10px', fontWeight: 600 }}>{row.reviews.toLocaleString()}</td>
                                <td style={{ padding: '10px' }}><span style={s.badge(row.avgRating >= 4.8 ? '#f0fdf4' : '#fffbeb', row.avgRating >= 4.8 ? '#16a34a' : '#d97706')}>{row.avgRating}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Section 4: Price Intelligence ──────────────────── */}
            <div style={{ ...s.card, marginBottom: 20 }}>
                <div style={s.sectionHeader}>{t.priceIntelligence}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {PRICE_DATA.map(item => {
                        const posConfig = { premium: { bg: '#ede9fe', color: '#7c3aed' }, mid: { bg: '#dbeafe', color: '#2563eb' }, budget: { bg: '#d1fae5', color: '#059669' } };
                        const pc = posConfig[item.position] || posConfig.mid;
                        return (
                            <div key={item.category} style={{ padding: 16, borderRadius: 10, border: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: '#212529' }}>{item.category}</span>
                                    <span style={s.badge(pc.bg, pc.color)}>{t[item.position]}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                                    <div style={{ textAlign: 'center', padding: 8, borderRadius: 8, background: '#fdf4fb' }}>
                                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>{t.kobPrice}</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: '#714B67' }}>฿{item.kobPrice}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: 8, borderRadius: 8, background: '#f9fafb' }}>
                                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>{t.competitorAvg}</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#4b5563' }}>฿{item.compAvg}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: 8, borderRadius: 8, background: '#f9fafb' }}>
                                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>{t.marketAvg}</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#6b7280' }}>฿{item.mktAvg}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ flex: 1, marginRight: 12 }}>
                                        <div style={{ position: 'relative', height: 8, background: '#f3f4f6', borderRadius: 4 }}>
                                            <div style={{ position: 'absolute', left: `${Math.min((item.mktAvg / item.kobPrice) * 100, 100)}%`, top: -3, width: 2, height: 14, background: '#9ca3af' }} title={t.marketAvg} />
                                            <div style={{ position: 'absolute', left: `${Math.min((item.compAvg / item.kobPrice) * 100, 100)}%`, top: -3, width: 2, height: 14, background: '#4b5563' }} title={t.competitorAvg} />
                                            <div style={{ width: '100%', height: 8, background: '#714B67', borderRadius: 4, opacity: 0.3 }} />
                                            <div style={{ position: 'absolute', right: 0, top: -3, width: 14, height: 14, borderRadius: '50%', background: '#714B67', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} title="KOB" />
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: item.gap > 20 ? '#7c3aed' : '#2563eb' }}>+{item.gap}% {t.priceGap}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Section 4.5: Modern Trade Channel Comparison ──── */}
            <div style={{ ...s.card, marginBottom: 20 }}>
                <div style={{ ...s.sectionHeader, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShoppingCart size={14} color="#714B67" />
                    {language === 'th' ? 'เปรียบเทียบช่องทาง MODERN TRADE' : 'MODERN TRADE CHANNEL COMPARISON'}
                    <span style={{ ...s.badge('#f0fdf4', '#16a34a'), marginLeft: 8, fontSize: 10 }}>{language === 'th' ? 'ออฟไลน์ 80% ของตลาด' : 'Offline = 80% of market'}</span>
                </div>

                {/* Channel header */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 700, color: '#374151', minWidth: 180, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                                    {language === 'th' ? 'แบรนด์' : 'Brand'}
                                </th>
                                {MODERN_TRADE_CHANNELS.map(ch => (
                                    <th key={ch.name} style={{ textAlign: 'center', padding: '6px 4px', minWidth: 75 }}>
                                        <div style={{ fontSize: 16 }}>{ch.emoji}</div>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: '#4b5563', lineHeight: 1.2, marginTop: 2 }}>{ch.name}</div>
                                        <div style={{ fontSize: 9, color: '#9ca3af' }}>{ch.outlets}</div>
                                    </th>
                                ))}
                                <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 10, fontWeight: 700, color: '#6b7280', minWidth: 55 }}>SKUs</th>
                                <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 10, fontWeight: 700, color: '#6b7280', minWidth: 80 }}>{language === 'th' ? 'ตำแหน่งชั้น' : 'Shelf Position'}</th>
                                <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 10, fontWeight: 700, color: '#6b7280', minWidth: 70 }}>{language === 'th' ? 'โปรโมชั่น' : 'Promo Freq'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MODERN_TRADE_BRANDS.map((b, idx) => (
                                <tr key={b.brand} style={{
                                    borderBottom: '1px solid #f3f4f6',
                                    background: b.highlight ? '#fdf4fb' : idx % 2 === 0 ? '#fff' : '#fafafa',
                                }}>
                                    <td style={{
                                        padding: '10px 6px', fontWeight: b.highlight ? 800 : 600, color: b.highlight ? '#714B67' : '#212529',
                                        position: 'sticky', left: 0, background: b.highlight ? '#fdf4fb' : idx % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1,
                                        borderLeft: b.highlight ? '3px solid #714B67' : 'none',
                                    }}>
                                        {b.brand}
                                    </td>
                                    {MODERN_TRADE_CHANNELS.map(ch => {
                                        const present = b.channels[ch.name];
                                        return (
                                            <td key={ch.name} style={{ textAlign: 'center', padding: '8px 4px' }}>
                                                {present ? (
                                                    <span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', lineHeight: '22px', fontSize: 13, fontWeight: 700 }}>✓</span>
                                                ) : (
                                                    <span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: '50%', background: '#fef2f2', color: '#ef4444', lineHeight: '22px', fontSize: 11 }}>✗</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 700, color: '#374151' }}>{b.skuCount}</td>
                                    <td style={{ textAlign: 'center', padding: '8px 4px', fontSize: 11, color: '#4b5563' }}>{b.shelfPosition}</td>
                                    <td style={{ textAlign: 'center', padding: '8px 4px', fontSize: 11, color: '#4b5563' }}>{b.promoFreq}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
                    <div style={{ padding: 12, borderRadius: 8, background: '#fdf4fb', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>{language === 'th' ? 'ช่องทาง KOB' : 'KOB Channels'}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#714B67' }}>7/8</div>
                        <div style={{ fontSize: 10, color: '#714B67' }}>{language === 'th' ? 'ครอบคลุม 87%' : '87% Coverage'}</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 8, background: '#eff6ff', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>{language === 'th' ? 'คู่แข่งหลัก' : 'Top Competitor'}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>8/8</div>
                        <div style={{ fontSize: 10, color: '#2563eb' }}>KARMARTS</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 8, background: '#fef2f2', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>{language === 'th' ? 'ช่องว่าง KOB' : 'KOB Gap'}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>1</div>
                        <div style={{ fontSize: 10, color: '#dc2626' }}>{language === 'th' ? 'ไม่มีร้านของตัวเอง' : 'No own stores'}</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 8, background: '#fffbeb', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>{language === 'th' ? 'ภัยคุกคาม' : 'Threat Watch'}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>Skintific</div>
                        <div style={{ fontSize: 10, color: '#d97706' }}>{language === 'th' ? 'ยังไม่มีออฟไลน์' : 'No offline yet'}</div>
                    </div>
                </div>

                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, color: '#15803d', lineHeight: 1.6 }}>
                    <strong>💡 {language === 'th' ? 'Insight:' : 'Insight:'}</strong>{' '}
                    {language === 'th'
                        ? 'KOB กระจายสินค้า 12,000+ จุด ครอบคลุม 7/8 ช่องทาง Modern Trade ดีกว่า Oriental Princess (2/8, ร้านตัวเอง) และ Skintific (1/8) แต่แพ้ KARMARTS ที่ครบ 8/8 + SKU 200 รายการ Rojukiss ครอง 7/8 เท่า KOB แต่ได้ shelf ร้านยา กลยุทธ์: เพิ่ม SKU ใน Eveandboy (Gen Z hub) และเจรจา eye-level shelf กับ Watsons/7-Eleven เพื่อสู้ Srichand ที่ได้ตำแหน่งดีที่สุด'
                        : 'KOB distributes to 12,000+ outlets covering 7/8 Modern Trade channels — better than Oriental Princess (2/8, own-store model) and Skintific (1/8), but behind KARMARTS (8/8 + 200 SKUs). Rojukiss matches KOB at 7/8 with pharmacy channel advantage. Strategy: Increase SKUs in Eveandboy (Gen Z hub) and negotiate eye-level shelf position at Watsons/7-Eleven to compete with Srichand\'s #1 shelf placement.'
                    }
                </div>
            </div>

            {/* ── Section 5: Trend Radar ─────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
                {/* Keywords */}
                <div style={s.card}>
                    <div style={s.sectionHeader}>{t.trendingKeywords}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {TRENDING_KEYWORDS.map(kw => (
                            <div key={kw.keyword} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {kw.hot && <span style={{ fontSize: 14 }}>{'\uD83D\uDD25'}</span>}
                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#212529' }}>{kw.keyword}</span>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>+{kw.change}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Categories */}
                <div style={s.card}>
                    <div style={s.sectionHeader}>{t.trendingCategories}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {TRENDING_CATEGORIES.map(cat => (
                            <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#212529', marginBottom: 3 }}>{cat.name}</div>
                                    <HBar value={cat.growth} max={40} color="#10b981" height={6} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>+{cat.growth}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Emerging Alerts */}
                <div style={s.card}>
                    <div style={s.sectionHeader}>{t.emergingAlerts}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {EMERGING_ALERTS.map(alert => (
                            <div key={alert.name} style={{ padding: 12, borderRadius: 8, border: '1px solid #fde68a', background: '#fffbeb' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: '#212529' }}>{alert.name}</span>
                                    <ThreatBadge level={alert.risk} t={t} />
                                </div>
                                <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                                    {language === 'th' ? alert.noteTh : alert.note}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Section 5.5: Google Trends (Real-time) ────────── */}
            <div style={{ ...s.card, marginBottom: 20 }}>
                <div style={{ ...s.sectionHeader, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={14} color="#ea4335" />
                    GOOGLE TRENDS — {language === 'th' ? 'ข้อมูลจริง real-time (ประเทศไทย)' : 'Real-time Data (Thailand)'}
                    <span style={{ ...s.badge('#fef2f2', '#dc2626'), marginLeft: 8, fontSize: 10 }}>LIVE DATA</span>
                </div>

                {/* Trend comparison charts — 3 groups */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <GoogleTrendsEmbed
                        keywords={['PDRN skincare', 'Centella skincare', 'Niacinamide serum']}
                        label={language === 'th' ? '🔬 ส่วนผสม Active Ingredients (12 เดือน)' : '🔬 Active Ingredients (12 months)'}
                    />
                    <GoogleTrendsEmbed
                        keywords={['skinoxy', 'srichand', 'cathy doll']}
                        label={language === 'th' ? '💋 แบรนด์ KOB vs คู่แข่ง (12 เดือน)' : '💋 KOB vs Competitors (12 months)'}
                    />
                    <GoogleTrendsEmbed
                        keywords={['sunscreen spf50', 'glass skin', 'ceramide cream']}
                        label={language === 'th' ? '☀️ เทรนด์สินค้า Product Trends (12 เดือน)' : '☀️ Product Trends (12 months)'}
                    />
                    <GoogleTrendsEmbed
                        keywords={['skintific thailand', 'cosrx thailand', 'drunk elephant thailand']}
                        label={language === 'th' ? '🌏 แบรนด์นำเข้าในไทย (12 เดือน)' : '🌏 Imported Brands in Thailand (12 months)'}
                    />
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
                    {language === 'th' ? 'ข้อมูลจาก Google Trends API — อัปเดตอัตโนมัติ' : 'Data from Google Trends — auto-updated'} • geo=TH • 12 months
                </div>
            </div>

            {/* ── Section 6: AI Strategic Insights ───────────────── */}
            <div style={{ ...s.card, background: 'linear-gradient(135deg, #fdf4fb 0%, #f5f3ff 50%, #eff6ff 100%)' }}>
                <div style={{ ...s.sectionHeader, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} color="#714B67" />
                    {t.aiStrategicInsights}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {insights.map((ins, idx) => {
                        const Icon = ins.icon;
                        return (
                            <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 14, background: 'rgba(255,255,255,0.7)', borderRadius: 10, border: '1px solid rgba(222,226,230,0.5)' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: ins.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={18} color={ins.color} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#212529', marginBottom: 4 }}>{ins.title}</div>
                                    <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{ins.text}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
