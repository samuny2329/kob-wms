import React from 'react';
import { BookOpen, Lock, Users, Info, ShoppingCart, Box, ScanLine, Truck, FileText, ShieldAlert } from 'lucide-react';

const Manual = () => {
    const sectionStyle = { backgroundColor: '#ffffff', border: '1px solid #dee2e6', borderRadius: '4px', padding: '24px 32px' };
    const h2Style = { fontSize: '15px', fontWeight: 700, color: '#212529', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' };
    const h3Style = { fontSize: '13px', fontWeight: 700, color: '#212529', marginBottom: '8px', marginTop: '20px' };
    const pStyle = { fontSize: '13px', color: '#6c757d', fontWeight: 500, marginBottom: '12px', lineHeight: 1.6 };
    const ulStyle = { fontSize: '13px', color: '#6c757d', lineHeight: 1.7 };
    const menuBadgeStyle = { display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#714B67', textTransform: 'uppercase', letterSpacing: '0.08em', backgroundColor: '#f3edf7', border: '1px solid #c9a8bc', borderRadius: '4px', padding: '3px 10px', marginBottom: '12px' };

    return (
        <div className="max-w-4xl mx-auto animate-slide-up pb-12 w-full">
            {/* Hero header */}
            <div style={{ backgroundColor: '#714B67', borderRadius: '4px', padding: '28px 32px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
                <BookOpen className="w-48 h-48 absolute -top-10 -right-10 opacity-10 text-white transform -rotate-12" style={{ color: '#ffffff' }} />
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', marginBottom: '6px', position: 'relative', zIndex: 1 }}>Standard Operating Procedure Manual — Enterprise WMS Pro</h1>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontWeight: 500, position: 'relative', zIndex: 1 }}>(Kiss of Beauty / SKINOXY) - Standard Operating Procedure (SOP)</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', marginTop: '12px', position: 'relative', zIndex: 1, backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px 16px', borderRadius: '4px', lineHeight: 1.6 }}>
                    This document has been prepared as the official Standard Operating Procedure for the administration and operation of the Enterprise WMS Pro system. Its purpose is to define the scope of responsibilities and operational procedures for personnel in each designated role. The system has been designed in accordance with international distribution center standards to ensure maximum warehouse management efficiency, data accuracy, and minimization of operational discrepancies.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={sectionStyle}>
                    <h2 style={h2Style}><Lock className="w-5 h-5" style={{ color: '#714B67' }} /> 1. Authentication & Security Protocol</h2>
                    <p style={pStyle}>The WMS Pro system is designed with information security as a core principle. All operational personnel are required to complete identity verification before accessing the system through certified security mechanisms.</p>

                    <h3 style={h3Style}>1.1 System Authentication Procedure</h3>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                        <li>Access the WMS Pro application through the designated browser or authorized mobile device as specified by the data center</li>
                        <li>Authenticate via the Single Sign-On (SSO) system or by scanning your employee identification badge</li>
                        <li>If automated authentication is unavailable, enter your <strong>Username</strong> and <strong>Password</strong> manually</li>
                        <li>For the initial login, the system will temporarily suspend access and display a <strong>Security Update Required</strong> prompt</li>
                        <li>Set a personal password (minimum 8 characters, including special characters) and confirm by entering it twice</li>
                        <li>Click <strong>Update & Login</strong> to confirm credentials and enter the operational system</li>
                    </ol>
                    <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#fff8e1', border: '1px solid #ffc107', borderLeft: '3px solid #ffac00', borderRadius: '4px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <Info className="w-5 h-5 shrink-0" style={{ color: '#856404', marginTop: '1px' }} />
                        <p style={{ fontSize: '13px', color: '#856404', fontWeight: 500 }}><strong>Important Note:</strong> If personnel lose their password or their authentication device is damaged, please contact the System Administrator to revoke existing credentials and issue new authentication details.</p>
                    </div>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><Users className="w-5 h-5" style={{ color: '#714B67' }} /> 2. Role-based Access Control (RBAC)</h2>
                    <p style={pStyle}>The system automatically manages data access permissions and menu commands based on the user's assigned role structure, enforcing the Segregation of Duties policy as follows:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        {[
                            { title: '👑 Administrator & Warehouse Director', desc: 'Granted the highest level of access to all subsystems, exception approvals, and system configuration controls' },
                            { title: '🛒 Picking Specialist', desc: 'Granted access to the Pick List menu and warehouse location data' },
                            { title: '📦 Packing & Quality Control Officer', desc: 'Granted access to the Pack & Verify menu and document processing system' },
                            { title: '🚚 Outbound & Sortation Officer', desc: 'Granted access to the Outbound Scan, Manifest, and Dispatch menus' },
                        ].map((item, i) => (
                            <div key={i} style={{ padding: '12px 14px', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#212529', marginBottom: '4px' }}>{item.title}</div>
                                <div style={{ fontSize: '12px', color: '#6c757d' }}>{item.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><ShoppingCart className="w-5 h-5" style={{ color: '#714B67' }} /> 3. System-Directed Picking Process</h2>
                    <p style={pStyle}>This process is supported by route optimization algorithms and batch/wave picking to reduce operational time and travel distance within the warehouse.</p>
                    <span style={menuBadgeStyle}>Operations Menu: Pick List or Shortcut F1</span>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                        <li>Navigate to the <strong>Pick List</strong> menu. The system will display grouped (Wave) orders automatically prioritized by Service Level Agreement (SLA)</li>
                        <li>The system will suggest the most efficient pick path within the warehouse</li>
                        <li>Upon reaching the designated storage location, use the barcode scanner to scan the <strong>Bin Location</strong> code followed by the <strong>SKU Barcode</strong></li>
                        <li>The system will process real-time inventory deduction automatically</li>
                        <li>Once all items have been picked, the system will display a completion confirmation and automatically transfer the status data to the Packing department</li>
                    </ol>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><Box className="w-5 h-5" style={{ color: '#714B67' }} /> 4. Quality Assurance & Packing Process</h2>
                    <p style={pStyle}>The packing process is integrated with a cartonization algorithm to optimize volume utilization and reduce shipping costs.</p>
                    <span style={menuBadgeStyle}>Operations Menu: Pack & Verify or Shortcut F2</span>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                        <li>Navigate to the <strong>Pack & Verify</strong> menu. Select the order or scan the tote barcode</li>
                        <li>The system requires the operator to <strong>scan each SKU item individually</strong> for double verification</li>
                        <li>The cartonization algorithm will process and <strong>recommend the most suitable box size</strong></li>
                        <li>After packing, the operator must perform weight integration and scan the box barcode used</li>
                        <li>If the actual weight matches the theoretical weight in the database, the system will enable the <strong>Confirm, RTS & Print AWB</strong> command</li>
                        <li>The system will submit an electronic API request to the e-commerce platform to retrieve and automatically print the shipping label (AWB)</li>
                    </ol>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><ScanLine className="w-5 h-5" style={{ color: '#714B67' }} /> 5. Sortation and Outbound Scanning Process</h2>
                    <span style={menuBadgeStyle}>Operations Menu: Outbound Scan or Shortcut F3</span>
                    <ol style={{ ...ulStyle, paddingLeft: '20px', marginBottom: '12px' }}>
                        <li>Bring the parcels with affixed shipping labels (AWB) to the sortation station</li>
                        <li>Scan the tracking number or feed the parcel through the automated conveyor scanner</li>
                        <li>The system will execute sortation logic and display a color indicator or direct the conveyor to sort parcels into the designated carrier sorting bin as follows:</li>
                    </ol>
                    <div className="grid grid-cols-2 gap-2 ml-6 mb-3">
                        {[
                            { color: '#fff8e1', border: '#ffc107', text: '#856404', label: '🟡 FLASH EXPRESS: Sorting BIN 1' },
                            { color: '#fff3e0', border: '#fd7e14', text: '#6d3a00', label: '🟠 SHOPEE / KERRY: Sorting BIN 2' },
                            { color: '#fff5f5', border: '#f5c6cb', text: '#721c24', label: '🔴 J&T EXPRESS: Sorting BIN 3' },
                            { color: '#fce4ec', border: '#f48fb1', text: '#880e4f', label: '🩷 THAILAND POST: Sorting BIN 4' },
                        ].map((b, i) => (
                            <div key={i} style={{ padding: '10px 12px', backgroundColor: b.color, border: `1px solid ${b.border}`, borderRadius: '4px', fontSize: '13px', fontWeight: 700, color: b.text }}>{b.label}</div>
                        ))}
                    </div>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }} start={4}>
                        <li><strong>Exception Handling:</strong> If a parcel with incomplete data or a duplicate scan is detected, the system will trigger a visual/audio alert and halt operations. The operator must remove the parcel from the conveyor and press <strong>Spacebar</strong> to log the error before proceeding</li>
                    </ol>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><Truck className="w-5 h-5" style={{ color: '#714B67' }} /> 6. Digital Dispatch & Proof of Handover</h2>
                    <span style={menuBadgeStyle}>Operations Menu: Dispatch or Shortcut F4</span>
                    <p style={pStyle}>To ensure transparency and full traceability, the dispatch process requires strict digital evidence recording:</p>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                        <li>Navigate to the <strong>Dispatch</strong> menu</li>
                        <li>Select the carrier picking up the parcels. The system will display a summary report of successfully scanned parcels ready for dispatch</li>
                        <li>Physically verify the parcel count against the system data</li>
                        <li>Have the carrier representative provide a <strong>Digital Driver Signature</strong> along with their driver ID</li>
                        <li>Click <strong>Confirm Dispatch</strong>. The system will record the handover timestamp, close the dispatch cycle, and transmit the electronic manifest to the carrier system via API</li>
                    </ol>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><FileText className="w-5 h-5" style={{ color: '#714B67' }} /> 7. Advanced Reporting & Analytics</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <h3 style={h3Style}>7.1 Electronic Manifest</h3>
                            <ul style={{ ...ulStyle, paddingLeft: '20px', listStyleType: 'disc' }}>
                                <li>Review all parcels in real-time with full traceability for each individual item</li>
                                <li>Parcel statuses are cross-referenced with destination platform data to prevent omissions</li>
                            </ul>
                        </div>
                        <div style={{ height: '1px', backgroundColor: '#dee2e6' }} />
                        <div>
                            <h3 style={h3Style}>7.2 Statistical Reports</h3>
                            <ul style={{ ...ulStyle, paddingLeft: '20px', listStyleType: 'disc' }}>
                                <li>The system supports data processing filtered by carrier and time period conditions</li>
                                <li>Reports can be exported in electronic format (PDF/CSV) for submission to the Finance and Accounting department for reconciliation</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div style={{ ...sectionStyle, backgroundColor: '#f8f9fa' }}>
                    <h2 style={h2Style}><ShieldAlert className="w-5 h-5" style={{ color: '#714B67' }} /> 8. Administrative & Performance Monitoring</h2>
                    <p style={pStyle}>The system provides advanced analytics capabilities to support strategic decision-making for management-level personnel.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <h3 style={h3Style}>8.1 Dashboard & KPI Analytics</h3>
                            <ul style={{ ...ulStyle, paddingLeft: '20px', listStyleType: 'disc' }}>
                                <li>Displays an operational overview with data visualization, carrier distribution ratios, and automated SLA alerts for at-risk orders</li>
                                <li><strong>Team Performance KPI:</strong> Generates individual performance scorecards that <strong>systematically calculate and display the "Units Per Hour (UPH)" metric</strong> to support capacity planning and fair quantitative performance evaluation</li>
                            </ul>
                        </div>
                        <div style={{ height: '1px', backgroundColor: '#dee2e6' }} />
                        <div>
                            <h3 style={h3Style}>8.2 System Configuration & Maintenance</h3>
                            <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                                <li><strong>System Language:</strong> Configure the display language settings</li>
                                <li><strong>User Access Management:</strong>
                                    <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '6px' }}>
                                        <li>Create, suspend, or revoke personnel access rights in accordance with the security policy</li>
                                        <li>Perform emergency password resets when required</li>
                                    </ul>
                                </li>
                                <li><strong>API Integrations:</strong> Manage API keys and connection parameters across the entire software ecosystem (Odoo ERP, Shopee, Lazada, TikTok)</li>
                                <li><strong>Data Purging:</strong> Remove temporary data from the operational system to maintain database optimization and performance</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Manual;
