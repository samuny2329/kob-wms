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
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', marginBottom: '6px', position: 'relative', zIndex: 1 }}>คู่มือมาตรฐานการปฏิบัติงาน ระบบ Enterprise WMS Pro</h1>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontWeight: 500, position: 'relative', zIndex: 1 }}>(Kiss of Beauty) - Standard Operating Procedure (SOP)</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', marginTop: '12px', position: 'relative', zIndex: 1, backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px 16px', borderRadius: '4px', lineHeight: 1.6 }}>
                    เอกสารฉบับนี้จัดทำขึ้นเพื่อใช้เป็นมาตรฐานการปฏิบัติงาน สำหรับการบริหารจัดการระบบ Enterprise WMS Pro โดยมีวัตถุประสงค์เพื่อกำหนดขอบเขตและขั้นตอนการปฏิบัติงานของบุคลากรในแต่ละบทบาทหน้าที่ ระบบดังกล่าวได้รับการออกแบบโดยอ้างอิงมาตรฐานศูนย์กระจายสินค้าสากล เพื่อให้กระบวนการจัดการคลังสินค้าเป็นไปอย่างมีประสิทธิภาพสูงสุด มีความแม่นยำทางข้อมูล และลดอุบัติการณ์ความคลาดเคลื่อนเชิงปฏิบัติการ
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={sectionStyle}>
                    <h2 style={h2Style}><Lock className="w-5 h-5" style={{ color: '#714B67' }} /> 1. มาตรการรักษาความมั่นคงปลอดภัยและการเข้าสู่ระบบ (Authentication & Security Protocol)</h2>
                    <p style={pStyle}>ระบบ WMS Pro ถูกออกแบบโดยยึดหลักความมั่นคงปลอดภัยของข้อมูลสารสนเทศเป็นสำคัญ ผู้ปฏิบัติงานทุกภาคส่วนจำเป็นต้องดำเนินการยืนยันตัวตนเพื่อเข้าสู่ระบบผ่านกลไกการรักษาความปลอดภัยที่ได้รับการรับรอง</p>

                    <h3 style={h3Style}>1.1 ระเบียบปฏิบัติสำหรับการเข้าสู่ระบบ (System Authentication Procedure)</h3>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                        <li>เข้าถึงระบบแอปพลิเคชัน WMS Pro ผ่านเบราว์เซอร์หรืออุปกรณ์ปฏิบัติการเคลื่อนที่ ที่ศูนย์ข้อมูลกำหนด</li>
                        <li>ดำเนินการยืนยันตัวตนผ่านระบบเข้าสู่ระบบแบบรวมศูนย์ (Single Sign-On: SSO) หรือการสแกนบัตรประจำตัวพนักงาน</li>
                        <li>ในกรณีที่ไม่สามารถใช้ระบบอัตโนมัติ ให้ระบุ <strong>ชื่อผู้ใช้งาน (Username)</strong> และ <strong>รหัสผ่าน (Password)</strong></li>
                        <li>สำหรับการเข้าใช้งานครั้งแรก (Initial Login) ระบบจะระงับการเข้าถึงชั่วคราวและแสดงข้อความ <strong>Security Update Required</strong></li>
                        <li>ระบุรหัสผ่านส่วนบุคคล (ความยาวไม่น้อยกว่า 8 ตัวอักษร ประกอบด้วยอักขระพิเศษ) จำนวน 2 ครั้งให้ตรงกัน</li>
                        <li>กดคำสั่ง <strong>Update & Login</strong> เพื่อยืนยันข้อมูลและเข้าสู่ระบบปฏิบัติการ</li>
                    </ol>
                    <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#fff8e1', border: '1px solid #ffc107', borderLeft: '3px solid #ffac00', borderRadius: '4px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <Info className="w-5 h-5 shrink-0" style={{ color: '#856404', marginTop: '1px' }} />
                        <p style={{ fontSize: '13px', color: '#856404', fontWeight: 500 }}><strong>ข้อควรระวัง:</strong> ในกรณีที่บุคลากรสูญหายรหัสผ่าน หรืออุปกรณ์ยืนยันตัวตนเกิดความชำรุด โปรดติดต่อผู้ดูแลระบบ (Administrator) เพื่อดำเนินการเพิกถอนสิทธิ์เดิมและสร้างข้อมูลยืนยันตัวตนใหม่</p>
                    </div>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><Users className="w-5 h-5" style={{ color: '#714B67' }} /> 2. โครงสร้างสิทธิ์และบทบาทหน้าที่ (Role-based Access Control: RBAC)</h2>
                    <p style={pStyle}>ระบบจะดำเนินการจัดการสิทธิ์การเข้าถึงข้อมูลและเมนูคำสั่งโดยอัตโนมัติ ตามโครงสร้างบทบาทหน้าที่ของผู้ใช้งาน เพื่อบังคับใช้นโยบายการแบ่งแยกหน้าที่ความรับผิดชอบ (Segregation of Duties) ดังนี้:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        {[
                            { title: '👑 ผู้ดูแลระบบและผู้อำนวยการคลังสินค้า', desc: 'ได้รับสิทธิ์ขั้นสูงสุดในการเข้าถึงทุกระบบย่อย การอนุมัติข้อยกเว้น และเมนูควบคุมการตั้งค่าระบบ' },
                            { title: '🛒 เจ้าหน้าที่ปฏิบัติการจัดเตรียมสินค้า (Picking Specialist)', desc: 'ได้รับสิทธิ์ในการเข้าถึงเมนู Pick List และข้อมูลตำแหน่งจัดเก็บสินค้า (Location Data)' },
                            { title: '📦 เจ้าหน้าที่บรรจุภัณฑ์และควบคุมคุณภาพ (Packing & QC)', desc: 'ได้รับสิทธิ์ในการเข้าถึงเมนู Pack & Verify และระบบประมวลผลเอกสาร' },
                            { title: '🚚 เจ้าหน้าที่ปฏิบัติการนำจ่ายและคัดแยก (Outbound)', desc: 'ได้รับสิทธิ์ในการเข้าถึงเมนู Outbound Scan, Manifest และ Dispatch' },
                        ].map((item, i) => (
                            <div key={i} style={{ padding: '12px 14px', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: '#212529', marginBottom: '4px' }}>{item.title}</div>
                                <div style={{ fontSize: '12px', color: '#6c757d' }}>{item.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><ShoppingCart className="w-5 h-5" style={{ color: '#714B67' }} /> 3. กระบวนการปฏิบัติงาน: การจัดเตรียมสินค้า (System-Directed Picking Process)</h2>
                    <p style={pStyle}>กระบวนการนี้ได้รับการสนับสนุนด้วยอัลกอริทึมการประมวลผลเส้นทาง (Route Optimization) และการจัดกลุ่มคำสั่งซื้อ (Batch/Wave Picking) เพื่อลดระยะเวลาและระยะทางในการปฏิบัติงาน</p>
                    <span style={menuBadgeStyle}>เมนูปฏิบัติการ: Pick List (รายการจัดเตรียมสินค้า) หรือคีย์ลัด F1</span>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                        <li>นำทางไปยังเมนู <strong>Pick List</strong> ระบบจะแสดงรายการคำสั่งซื้อที่ได้รับการจัดกลุ่ม (Wave) และเรียงลำดับความสำคัญตามข้อตกลงระดับบริการ (SLA) อัตโนมัติ</li>
                        <li>ระบบจะเสนอแนะเส้นทางการเดิน (Pick Path) ที่มีประสิทธิภาพสูงสุดภายในคลังสินค้า</li>
                        <li>เมื่อถึงตำแหน่งจัดเก็บที่ระบุ ให้ผู้ปฏิบัติงานใช้เครื่องสแกนบาร์โค้ดสแกนที่ <strong>รหัสตำแหน่ง (Bin Location)</strong> และตามด้วย <strong>รหัสสินค้า (SKU Barcode)</strong></li>
                        <li>ระบบจะประมวลผลและหักลดยอดสินค้าคงคลัง (Inventory Deduction) แบบเรียลไทม์</li>
                        <li>เมื่อดำเนินการจัดเตรียมสินค้าครบถ้วน ระบบจะแจ้งข้อความยืนยันความสมบูรณ์ และถ่ายโอนข้อมูลสถานะไปยังแผนกบรรจุภัณฑ์โดยอัตโนมัติ</li>
                    </ol>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><Box className="w-5 h-5" style={{ color: '#714B67' }} /> 4. กระบวนการปฏิบัติงาน: การบรรจุภัณฑ์และทวนสอบคุณภาพ (Quality Assurance & Packing Process)</h2>
                    <p style={pStyle}>กระบวนการบรรจุภัณฑ์ได้รับการผสานรวมเข้ากับระบบแนะนำขนาดกล่องบรรจุภัณฑ์ (Cartonization Algorithm) เพื่อปรับสมดุลปริมาตรและลดต้นทุนค่าขนส่ง</p>
                    <span style={menuBadgeStyle}>เมนูปฏิบัติการ: Pack & Verify (บรรจุภัณฑ์และทวนสอบ) หรือคีย์ลัด F2</span>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                        <li>นำทางไปยังเมนู <strong>Pack & Verify</strong> เลือกคำสั่งซื้อ หรือสแกนรหัสตระกร้าสินค้ารอแพ็ค (Tote Barcode)</li>
                        <li>ระบบจะบังคับให้ผู้ปฏิบัติงาน <strong>สแกนรหัสสินค้า (SKU) ทีละรายการ</strong> เพื่อเป็นการทวนสอบความถูกต้อง (Double Verification)</li>
                        <li>ระบบจะประมวลผลผ่าน Cartonization Algorithm เพื่อ <strong>แสดงคำแนะนำขนาดกล่องบรรจุภัณฑ์ที่เหมาะสมที่สุด</strong></li>
                        <li>ภายหลังการบรรจุ ผู้ปฏิบัติงานต้องดำเนินการชั่งน้ำหนักพัสดุ (Weight Integration) และสแกนรหัสกล่องบรรจุภัณฑ์ที่ใช้</li>
                        <li>หากน้ำหนักจริงสอดคล้องกับน้ำหนักตามทฤษฎีในฐานข้อมูล ระบบจะอนุญาตให้เลือกคำสั่ง <strong>Confirm, RTS & Print AWB</strong></li>
                        <li>ระบบจะดำเนินการส่งมอบข้อมูลทางอิเล็กทรอนิกส์ (API Request) ไปยังแพลตฟอร์มอีคอมเมิร์ซ เพื่อขอรับเอกสารใบปะหน้าพัสดุและจัดพิมพ์โดยอัตโนมัติ</li>
                    </ol>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><ScanLine className="w-5 h-5" style={{ color: '#714B67' }} /> 5. กระบวนการปฏิบัติงาน: การคัดแยกและการสแกนนำจ่ายพัสดุ (Sortation and Outbound Scanning Process)</h2>
                    <span style={menuBadgeStyle}>เมนูปฏิบัติการ: Outbound Scan (สแกนนำจ่ายพัสดุ) หรือคีย์ลัด F3</span>
                    <ol style={{ ...ulStyle, paddingLeft: '20px', marginBottom: '12px' }}>
                        <li>นำกล่องพัสดุที่ดำเนินการติดเอกสารใบปะหน้า (AWB) เรียบร้อยแล้ว มาดำเนินการ ณ สถานีคัดแยก</li>
                        <li>ดำเนินการสแกนรหัสพัสดุ (Tracking Number) หรือส่งพัสดุผ่านระบบสายพานลำเลียงที่มีอุปกรณ์สแกนอัตโนมัติ (Automated Conveyor Scanner)</li>
                        <li>ระบบจะประมวลผลตรรกะการคัดแยก (Sortation Logic) และแสดงสีแจ้งเตือนหรือสั่งการไปยังระบบสายพานเพื่อคัดแยกพัสดุลงในพื้นที่จัดเก็บตามผู้ให้บริการขนส่ง (Carrier Sorting Bin) ดังนี้:</li>
                    </ol>
                    <div className="grid grid-cols-2 gap-2 ml-6 mb-3">
                        {[
                            { color: '#fff8e1', border: '#ffc107', text: '#856404', label: '🟡 FLASH EXPRESS: จุดคัดแยก BIN 1' },
                            { color: '#fff3e0', border: '#fd7e14', text: '#6d3a00', label: '🟠 SHOPEE / KERRY: จุดคัดแยก BIN 2' },
                            { color: '#fff5f5', border: '#f5c6cb', text: '#721c24', label: '🔴 J&T EXPRESS: จุดคัดแยก BIN 3' },
                            { color: '#fce4ec', border: '#f48fb1', text: '#880e4f', label: '🩷 THAILAND POST: จุดคัดแยก BIN 4' },
                        ].map((b, i) => (
                            <div key={i} style={{ padding: '10px 12px', backgroundColor: b.color, border: `1px solid ${b.border}`, borderRadius: '4px', fontSize: '13px', fontWeight: 700, color: b.text }}>{b.label}</div>
                        ))}
                    </div>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }} start={4}>
                        <li><strong>กรณีตรวจพบข้อยกเว้น (Exception Handling):</strong> หากพบพัสดุที่มีข้อมูลไม่สมบูรณ์ หรือสแกนซ้ำซ้อน ระบบจะส่งสัญญาณเตือน (Visual/Audio Alert) และระงับการทำงาน ผู้ปฏิบัติงานต้องนำพัสดุออกจากระบบสายพาน และกด <strong>Spacebar</strong> เพื่อบันทึกข้อผิดพลาดก่อนดำเนินการต่อ</li>
                    </ol>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><Truck className="w-5 h-5" style={{ color: '#714B67' }} /> 6. กระบวนการปฏิบัติงาน: การส่งมอบแก่บริษัทขนส่ง (Digital Dispatch & Proof of Handover)</h2>
                    <span style={menuBadgeStyle}>เมนูปฏิบัติการ: Dispatch (ส่งมอบพัสดุ) หรือคีย์ลัด F4</span>
                    <p style={pStyle}>เพื่อความโปร่งใสและตรวจสอบย้อนกลับได้ กระบวนการส่งมอบพัสดุจำเป็นต้องมีการบันทึกหลักฐานเชิงดิจิทัลอย่างเคร่งครัด:</p>
                    <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                        <li>นำทางไปยังเมนู <strong>Dispatch</strong></li>
                        <li>เลือกระบุผู้ให้บริการขนส่งที่เข้ารับพัสดุ ระบบจะแสดงรายงานสรุปปริมาณพัสดุที่สแกนนำจ่ายสำเร็จและพร้อมส่งมอบ (Ready to Dispatch)</li>
                        <li>ทวนสอบจำนวนพัสดุทางกายภาพให้ตรงกับข้อมูลในระบบ</li>
                        <li>ดำเนินการให้ตัวแทนบริษัทขนส่ง <strong>ลงลายมือชื่ออิเล็กทรอนิกส์ (Digital Driver Signature)</strong> พร้อมระบุรหัสพนักงานขนส่ง</li>
                        <li>เลือกคำสั่ง <strong>Confirm Dispatch</strong> ระบบจะบันทึกเวลาที่ส่งมอบ (Timestamp) ปิดรอบการจัดส่ง และทำการส่งข้อมูลสรุป (Electronic Manifest) ไปยังระบบของผู้ให้บริการขนส่งผ่าน API</li>
                    </ol>
                </div>

                <div style={sectionStyle}>
                    <h2 style={h2Style}><FileText className="w-5 h-5" style={{ color: '#714B67' }} /> 7. ระบบรายงานและการวิเคราะห์ข้อมูลเชิงลึก (Advanced Reporting & Analytics)</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <h3 style={h3Style}>7.1 เอกสารรายการจัดส่งอิเล็กทรอนิกส์ (Electronic Manifest)</h3>
                            <ul style={{ ...ulStyle, paddingLeft: '20px', listStyleType: 'disc' }}>
                                <li>ตรวจสอบรายการพัสดุทั้งหมดแบบเรียลไทม์ พร้อมความสามารถในการสอบทานย้อนกลับ (Traceability) ของพัสดุแต่ละรายการ</li>
                                <li>สถานะของพัสดุจะถูกตรวจสอบข้ามระบบ (Cross-referenced) กับข้อมูลของแพลตฟอร์มปลายทางเพื่อป้องกันการตกหล่น</li>
                            </ul>
                        </div>
                        <div style={{ height: '1px', backgroundColor: '#dee2e6' }} />
                        <div>
                            <h3 style={h3Style}>7.2 รายงานเชิงสถิติและการวิเคราะห์ (Statistical Reports)</h3>
                            <ul style={{ ...ulStyle, paddingLeft: '20px', listStyleType: 'disc' }}>
                                <li>ระบบรองรับการประมวลผลข้อมูลจำแนกตามผู้ให้บริการขนส่ง (Courier Filter) และเงื่อนไขระยะเวลา</li>
                                <li>อนุญาตให้ดำเนินการจัดทำรายงานในรูปแบบอิเล็กทรอนิกส์ (Export PDF/CSV) สำหรับการนำส่งข้อมูลต่อฝ่ายบัญชีและการเงินเพื่อการกระทบยอด (Reconciliation)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div style={{ ...sectionStyle, backgroundColor: '#f8f9fa' }}>
                    <h2 style={h2Style}><ShieldAlert className="w-5 h-5" style={{ color: '#714B67' }} /> 8. ส่วนการจัดการและประเมินผลระดับผู้ดูแลระบบ (Administrative & Performance Monitoring)</h2>
                    <p style={pStyle}>ระบบมีความสามารถในการวิเคราะห์ข้อมูลเชิงลึกเพื่อสนับสนุนการตัดสินใจเชิงกลยุทธ์สำหรับบุคลากรระดับบริหาร</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <h3 style={h3Style}>8.1 ศูนย์กลางการวิเคราะห์ดัชนีชี้วัด (Dashboard & KPI Analytics)</h3>
                            <ul style={{ ...ulStyle, paddingLeft: '20px', listStyleType: 'disc' }}>
                                <li>แสดงผลสถานะการดำเนินงานรวมเชิงภาพลักษณ์ (Data Visualization) สัดส่วนผู้ให้บริการขนส่ง และการเฝ้าระวังคำสั่งซื้อที่เสี่ยงต่อการละเมิดข้อตกลงระดับบริการ (Automated SLA Alerts)</li>
                                <li><strong>Team Performance KPI:</strong> จัดทำตารางดัชนีชี้วัดผลงานรายบุคคล <strong>โดยประมวลผลและแสดง "อัตราความเร็วเฉลี่ย (Units Per Hour - UPH)" อย่างเป็นระบบ</strong> เพื่อสนับสนุนกระบวนการวางแผนกำลังคน (Capacity Planning) และประเมินประสิทธิภาพการทำงานเชิงปริมาณอย่างยุติธรรม</li>
                            </ul>
                        </div>
                        <div style={{ height: '1px', backgroundColor: '#dee2e6' }} />
                        <div>
                            <h3 style={h3Style}>8.2 การกำหนดค่าระบบและการบำรุงรักษา (System Configuration & Maintenance)</h3>
                            <ol style={{ ...ulStyle, paddingLeft: '20px' }}>
                                <li><strong>System Language:</strong> กำหนดเกณฑ์ภาษาสำหรับการแสดงผล</li>
                                <li><strong>User Access Management (การบริหารจัดการข้อมูลบุคลากร):</strong>
                                    <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '6px' }}>
                                        <li>บันทึก ระงับ หรือเพิกถอนสิทธิ์การใช้งานของบุคลากรตามนโยบายรักษาความมั่นคงปลอดภัย</li>
                                        <li>ดำเนินการคืนค่ารหัสผ่าน (Password Reset) ในกรณีฉุกเฉิน</li>
                                    </ul>
                                </li>
                                <li><strong>API Integrations (การบูรณาการสถาปัตยกรรมระบบ):</strong> บริหารจัดการรหัสความปลอดภัย (API Keys) และพารามิเตอร์การเชื่อมต่อระหว่างระบบนิเวศซอฟต์แวร์ทั้งหมด (Odoo ERP, Shopee, Lazada, TikTok)</li>
                                <li><strong>Data Purging (พื้นที่ควบคุมและทำลายข้อมูล):</strong> ดำเนินการลบข้อมูลชั่วคราวออกจากระบบปฏิบัติการ เพื่อบำรุงรักษาประสิทธิภาพของฐานข้อมูล (Database Optimization)</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Manual;
