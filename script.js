// الأسماء الكاملة (19 عضو + 3 أدمن)
const allNames = [
    "مارتيروس جمال", "نرمين فرج الله", "ميرنا فام", "بيشوي صفوت", "شنوده نصحي", "سيلفيا طلعت", 
    "سيمون سمعان", "كرستينا ميلاد", "ماري بشاي", "ابانوب فرج الله", "امال عادل", "باسم جابر",
    "هاله عادل", "دميانه سمعان", "فام روماني", "ويصا مرزق", "ماري هاني", "مينا فام", "فيولا طلعت",
    "shenouda", "admin2", "admin3"
];

// الأدمن (3 أدمن)
const admins = [
    { username: "shenouda", password: "admin123" },
    { username: "admin2", password: "admin123" },
    { username: "admin3", password: "admin123" }
];

const MONTHS_COUNT = 12;
let currentMember = null;
let currentMonth = 0;
let fromAdminEdit = false;
let isAdminLoggedIn = false;

const statusText = {
    'present': 'حاضر ✅',
    'late': 'متأخر ⏰',
    'absent': 'غائب بدون عذر ❌',
    'excused': 'غائب بعذر 📝',
    'travel': 'مسافر ✈️'
};

// ---------- بيانات Google Sheets (مركزية) ----------
let attendanceCache = [];
let dataLoaded = false;

async function loadDataFromSheet() {
    if(dataLoaded) return attendanceCache;
    try {
        const res = await fetch(SCRIPT_URL);
        const json = await res.json();
        if(json.attendance) attendanceCache = json.attendance;
        dataLoaded = true;
    } catch(e) { console.error("خطأ في تحميل البيانات:", e); }
    return attendanceCache;
}

async function saveToSheet(record) {
    try {
        await fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(record) 
        });
        attendanceCache.push(record);
    } catch(e) { console.error("خطأ في الحفظ:", e); }
}

// ---------- الموعد الرسمي ----------
function getOfficialTime() {
    let time = localStorage.getItem('officialTime');
    if (!time) {
        time = '09:00';
        localStorage.setItem('officialTime', time);
    }
    return time;
}

function updateOfficialTime() {
    const newTime = document.getElementById('newOfficialTime').value;
    if (!newTime) return alert('اختر الوقت أولاً');
    localStorage.setItem('officialTime', newTime);
    document.getElementById('currentOfficialTime').innerText = newTime;
    alert(`✅ تم تغيير الموعد الرسمي إلى ${newTime}`);
}

function calculateLateMinutes() {
    const officialTime = getOfficialTime();
    const now = new Date();
    const [officialHour, officialMinute] = officialTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    let lateMinutes = (currentHour - officialHour) * 60 + (currentMinute - officialMinute);
    return lateMinutes > 0 ? lateMinutes : 0;
}

// ---------- تسجيل الحالات ----------
async function recordStatus(status) {
    if (!currentMember) return;
    
    const now = new Date();
    let lateMinutes = 0;
    let actualTime = now.toLocaleTimeString('ar-EG');
    
    if(status === 'late') {
        lateMinutes = calculateLateMinutes();
    }
    
    const record = [
        currentMember,
        currentMonth + 1,
        now.toISOString().slice(0,10),
        status,
        actualTime,
        lateMinutes,
        ""
    ];
    
    await saveToSheet(record);
    await updateMemberView();
    if(document.getElementById('adminDashboard') && !document.getElementById('adminDashboard').classList.contains('hidden')) updateAdminView();
    alert(`✅ تم تسجيل ${status === 'present' ? 'الحضور' : status === 'late' ? 'التأخير' : status === 'absent' ? 'الغياب بدون عذر' : status === 'excused' ? 'الغياب بعذر' : 'السفر'} بنجاح`);
}

async function recordLateAuto() {
    await recordStatus('late');
}

// ---------- حساب النسب ----------
async function calculatePersonalStats(name, month) {
    await loadDataFromSheet();
    const records = attendanceCache.filter(r => r[0] === name && r[1] === month + 1);
    const total = records.length;
    
    let present = 0, excused = 0, absent = 0, travel = 0;
    let totalLateMinutes = 0;
    let lateCount = 0;
    
    records.forEach(r => {
        const status = r[3];
        if (status === 'present' || status === 'late') present++;
        if (status === 'late') {
            lateCount++;
            totalLateMinutes += parseInt(r[5]) || 0;
        }
        if (status === 'excused') excused++;
        if (status === 'absent') absent++;
        if (status === 'travel') travel++;
    });
    
    const presentRate = total ? Math.round((present / total) * 100) : 0;
    const excusedRate = total ? Math.round((excused / total) * 100) : 0;
    const absentRate = total ? Math.round((absent / total) * 100) : 0;
    const travelRate = total ? Math.round((travel / total) * 100) : 0;
    
    return {
        presentRate, excusedRate, absentRate, travelRate,
        total, totalLateMinutes, lateCount,
        avgLate: lateCount ? Math.round(totalLateMinutes / lateCount) : 0
    };
}

// ---------- دوال الملاحظات ----------
function showNoteDialog(memberName) {
    const currentNote = getNoteForMember(memberName, currentMonth);
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.id = 'noteDialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>📝 ملاحظات عن ${memberName}</h3>
            <textarea id="memberNote" rows="4" style="width:100%; padding:10px; border-radius:10px; border:1px solid #ccc;">${currentNote}</textarea>
            <br><br>
            <button onclick="saveNote('${memberName}')" class="btn-primary">💾 حفظ</button>
            <button onclick="closeNoteDialog()" class="btn-secondary">إلغاء</button>
        </div>
    `;
    document.body.appendChild(dialog);
}

function closeNoteDialog() {
    const dialog = document.getElementById('noteDialog');
    if(dialog) dialog.remove();
}

function getNoteForMember(memberName, month) {
    const memberRecords = attendanceCache.filter(r => r[0] === memberName && r[1] === month + 1);
    const notes = memberRecords.filter(r => r[6] && r[6].trim() !== '').map(r => r[6]);
    return notes.join('\n---\n');
}

async function saveNote(memberName) {
    const noteText = document.getElementById('memberNote').value;
    if (!noteText.trim()) {
        closeNoteDialog();
        return;
    }
    
    const now = new Date();
    const record = [
        memberName,
        currentMonth + 1,
        now.toISOString().slice(0,10),
        'note',
        now.toLocaleTimeString('ar-EG'),
        0,
        noteText
    ];
    
    await saveToSheet(record);
    await loadDataFromSheet();
    if(document.getElementById('adminDashboard') && !document.getElementById('adminDashboard').classList.contains('hidden')) updateAdminView();
    closeNoteDialog();
    alert('✅ تم حفظ الملاحظة');
}

// ---------- وظائف أخرى ----------
function getMemberRecords(name, month, filter='monthly') {
    let records = attendanceCache.filter(r => r[0] === name && r[1] === month + 1);
    if(filter === 'weekly'){
        const today = new Date();
        const daysToLastSat = (today.getDay() + 1) % 7;
        const lastSaturday = new Date(today);
        lastSaturday.setDate(today.getDate() - daysToLastSat);
        const saturdayStr = lastSaturday.toISOString().slice(0,10);
        records = records.filter(r => r[2] === saturdayStr);
    }
    return records;
}

function getLatecomersWithTime(month, filter='weekly') {
    const lateRecords = [];
    for (const name of allNames.slice(0, 19)) {
        const records = getMemberRecords(name, month, filter);
        records.forEach(r => {
            if (r[3] === 'late') {
                lateRecords.push({
                    name: name,
                    time: r[4],
                    date: r[2]
                });
            }
        });
    }
    return lateRecords;
}

// ---------- عرض الأعضاء ----------
function showMemberList() {
    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) adminBtn.style.display = 'none';
    const backToAdminBtn = document.getElementById('backToAdminBtn');
    if (backToAdminBtn) backToAdminBtn.style.display = 'none';
    
    isAdminLoggedIn = false;
    fromAdminEdit = false;
    
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('memberScreen').classList.remove('hidden');
    
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '';
    
    const normalMembers = allNames.slice(0, 19);
    normalMembers.forEach(name => {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.textContent = name;
        card.onclick = () => openMemberDashboard(name);
        memberList.appendChild(card);
    });
}

function showMemberListForAdmin() {
    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) adminBtn.style.display = 'inline-block';
    
    isAdminLoggedIn = true;
    
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('memberScreen').classList.remove('hidden');
    
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '';
    
    const normalMembers = allNames.slice(0, 19);
    normalMembers.forEach(name => {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.textContent = name;
        card.onclick = () => {
            fromAdminEdit = true;
            openMemberDashboard(name);
        };
        memberList.appendChild(card);
    });
}

function openMemberDashboard(name) {
    const isAdminPerson = (name === "shenouda" || name === "admin2" || name === "admin3");
    
    currentMember = name;
    currentMonth = 0;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('memberDashboard').classList.remove('hidden');
    document.getElementById('memberName').textContent = name;
    
    const backToAdminBtn = document.getElementById('backToAdminBtn');
    if (backToAdminBtn) {
        backToAdminBtn.style.display = (isAdminLoggedIn || fromAdminEdit || isAdminPerson) ? 'inline-block' : 'none';
    }
    
    renderMonthsTabs('memberMonthsTabs', true);
    
    if (fromAdminEdit || isAdminLoggedIn || isAdminPerson) {
        document.querySelectorAll('.status-btn').forEach(btn => btn.style.display = 'flex');
        fromAdminEdit = false;
    } else {
        document.querySelectorAll('.status-btn').forEach(btn => btn.style.display = 'none');
    }
    
    updateMemberView();
}

function backToAdminPanel() {
    showAdminDashboard();
}

async function updateMemberView() {
    await loadDataFromSheet();
    const records = getMemberRecords(currentMember, currentMonth);
    const lastRecord = records[records.length - 1];
    
    const currentStatusDiv = document.getElementById('currentStatus');
    if (lastRecord) {
        let lateInfo = '';
        if (lastRecord[3] === 'late') {
            lateInfo = `<br><small>⏱️ تأخر ${lastRecord[5]} دقيقة - حضر الساعة ${lastRecord[4]}</small>`;
        }
        currentStatusDiv.innerHTML = `
            <strong>آخر تسجيل:</strong><br>
            ${statusText[lastRecord[3]]}${lateInfo}<br>
            <small>${lastRecord[2]} - ${lastRecord[4]}</small>
        `;
    } else {
        currentStatusDiv.innerHTML = 'لا توجد تسجيلات لهذا الشهر';
    }
    
    const stats = await calculatePersonalStats(currentMember, currentMonth);
    const userRecords = getMemberRecords(currentMember, currentMonth);
    const lastLate = userRecords.filter(r => r[3] === 'late').pop();
    let lastLateTime = '';
    if (lastLate) {
        lastLateTime = `<p>⏱️ آخر مرة تأخرت: حضر الساعة ${lastLate[4]} بتاريخ ${lastLate[2]}</p>`;
    }
    
    document.getElementById('personalStats').innerHTML = `
        <p>✅ الحضور (حاضر + متأخر): ${stats.presentRate}%</p>
        <p>📝 الغياب بعذر: ${stats.excusedRate}%</p>
        <p>❌ الغياب بدون عذر: ${stats.absentRate}%</p>
        <p>✈️ مسافر: ${stats.travelRate}%</p>
        <p>📊 إجمالي التسجيلات: ${stats.total}</p>
        ${stats.lateCount > 0 ? `<p>⏰ عدد مرات التأخير: ${stats.lateCount}</p>
        <p>⏱️ متوسط التأخير: ${stats.avgLate} دقيقة</p>
        ${lastLateTime}` : ''}
    `;
}

function renderMonthsTabs(containerId, isMember = true) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < MONTHS_COUNT; i++) {
        const btn = document.createElement('button');
        btn.className = `month-tab ${i === currentMonth ? 'active' : ''}`;
        btn.textContent = `شهر ${i + 1}`;
        btn.onclick = () => {
            document.querySelectorAll(`#${containerId} .month-tab`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMonth = i;
            if (isMember) updateMemberView();
            else updateAdminView();
        };
        container.appendChild(btn);
    }
}

// ---------- الأدمن ----------
function showAdminLogin() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('adminLoginScreen').classList.remove('hidden');
}

function verifyAdmin() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    const admin = admins.find(a => a.username === username && a.password === password);
    if (admin) {
        showMemberListForAdmin();
    } else {
        alert('اسم المستخدم أو كلمة السر خطأ');
    }
}

function showAdminDashboard() {
    currentMember = null;
    currentMonth = 0;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('adminDashboard').classList.remove('hidden');
    renderMonthsTabs('adminMonthsTabs', false);
    const officialTimeElement = document.getElementById('currentOfficialTime');
    if (officialTimeElement) officialTimeElement.textContent = getOfficialTime();
    updateAdminView();
}

function backToMemberListForAdmin() {
    showMemberListForAdmin();
}

function editMemberFromAdmin(memberName) {
    fromAdminEdit = true;
    openMemberDashboard(memberName);
}

async function updateAdminView() {
    await loadDataFromSheet();
    const stats = [];
    
    for (const name of allNames) {
        stats.push(await calculatePersonalStats(name, currentMonth));
    }
    
    const bestAttendance = [...stats].sort((a,b) => b.presentRate - a.presentRate)[0];
    const worstAbsence = [...stats].sort((a,b) => b.absentRate - a.absentRate)[0];
    const mostLate = [...stats].sort((a,b) => b.lateCount - a.lateCount)[0];
    
    let latecomersHtml = '';
    if (currentFilter === 'weekly') {
        const latecomers = getLatecomersWithTime(currentMonth, 'weekly');
        if (latecomers.length > 0) {
            latecomersHtml = `
                <div style="background:#fff3e0; padding:15px; border-radius:15px; margin-top:20px; border-right:4px solid #ed8936;">
                    <h3 style="color:#ed8936; margin-bottom:10px;">⏰ المتأخرون هذا الأسبوع</h3>
                    <table style="width:100%; border-collapse:collapse;">
                        <thead><tr style="background:#ed8936; color:white;">
                            <th style="padding:8px;">الاسم</th>
                            <th style="padding:8px;">وقت الحضور</th>
                            <th style="padding:8px;">التاريخ</th>
                        </tr></thead>
                        <tbody>
                            ${latecomers.map(l => `
                                <tr style="border-bottom:1px solid #ffe0b3;">
                                    <td style="padding:8px;">${l.name}</td>
                                    <td style="padding:8px;">${l.time}</td>
                                    <td style="padding:8px;">${l.date}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            latecomersHtml = `<div style="background:#e6fffa; padding:15px; border-radius:15px; margin-top:20px; border-right:4px solid #38b2ac;">
                                ✅ لا يوجد متأخرون هذا الأسبوع
                              </div>`;
        }
    }
    
    document.getElementById('adminStats').innerHTML = `
        <div style="background:linear-gradient(135deg, #1e293b 0%, #334155 100%); color:white; padding:20px; border-radius:15px; margin-bottom:20px;">
            <h3 style="margin:0 0 10px 0;">📊 إحصائيات ${currentFilter==='monthly'?`شهر ${currentMonth+1}`:'آخر سبت'}</h3>
            <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between;">
                <div>🏆 أعلى حضور: <strong>${bestAttendance ? allNames[stats.indexOf(bestAttendance)] : '-'}</strong> (${bestAttendance?.presentRate || 0}%)</div>
                <div>⚠️ أعلى غياب بدون عذر: <strong>${worstAbsence ? allNames[stats.indexOf(worstAbsence)] : '-'}</strong> (${worstAbsence?.absentRate || 0}%)</div>
                <div>⏰ أكثر عضو تأخيراً: <strong>${mostLate ? allNames[stats.indexOf(mostLate)] : '-'}</strong> (${mostLate?.lateCount || 0} مرة)</div>
            </div>
        </div>
        ${latecomersHtml}
    `;
    
    let html = `<div style="overflow-x:auto; border-radius:15px; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
        <table style="width:100%; border-collapse:collapse; background:white;">
            <thead>
                <tr style="background:#1e293b; color:white;">
                    <th style="padding:12px;">الاسم</th>
                    <th style="padding:12px;">حضور</th>
                    <th style="padding:12px;">غياب بعذر</th>
                    <th style="padding:12px;">غياب بدون عذر</th>
                    <th style="padding:12px;">مسافر</th>
                    <th style="padding:12px;">عدد التأخير</th>
                    <th style="padding:12px;">متوسط التأخير</th>
                    <th style="padding:12px;">ملاحظات</th>
                    <th style="padding:12px;">تعديل</th>
                </tr>
            </thead>
            <tbody>`;
    
    for (let i = 0; i < allNames.length; i++) {
        const name = allNames[i];
        const s = stats[i];
        const bgColor = i % 2 === 0 ? '#f7fafc' : 'white';
        const memberNotes = getNoteForMember(name, currentMonth);
        const notePreview = memberNotes.length > 40 ? memberNotes.substring(0, 40) + '...' : memberNotes;
        
        html += `<tr style="background:${bgColor};">
            <td style="padding:10px; font-weight:bold;">${name}</td>
            <td style="padding:10px; color:#48bb78;">${s.presentRate}%</td>
            <td style="padding:10px; color:#4299e1;">${s.excusedRate}%</td>
            <td style="padding:10px; color:#f56565;">${s.absentRate}%</td>
            <td style="padding:10px; color:#805ad5;">${s.travelRate}%</td>
            <td style="padding:10px;">${s.lateCount}</td>
            <td style="padding:10px;">${s.avgLate}</td>
            <td style="padding:10px; min-width:200px; max-width:250px; word-break:break-word; background:#fefce8;">
                ${notePreview || '—'}
                <button class="btn-edit" onclick="showNoteDialog('${name}')" style="margin-top:8px; display:inline-block; background:#eab308; color:#1e293b;">📝 ملاحظة</button>
            </td>
            <td style="padding:10px;"><button class="btn-edit" onclick="editMemberFromAdmin('${name}')">تعديل</button></td>
        </tr>`;
    }
    
    html += `</tbody>
    </table>
    </div>`;
    const tableDiv = document.getElementById('allMembersTable');
    if (tableDiv) tableDiv.innerHTML = html;
}

// ---------- الفلتر الشهري والأسبوعي ----------
let currentFilter = 'monthly';

document.addEventListener('click', (e) => {
    if(e.target.id === 'filterMonthly'){
        currentFilter = 'monthly';
        document.getElementById('filterMonthly').classList.add('active');
        document.getElementById('filterWeekly').classList.remove('active');
        updateAdminView();
    }
    if(e.target.id === 'filterWeekly'){
        currentFilter = 'weekly';
        document.getElementById('filterWeekly').classList.add('active');
        document.getElementById('filterMonthly').classList.remove('active');
        updateAdminView();
    }
    if(e.target.id === 'changePasswordBtn') showChangePasswordDialog();
    if(e.target.id === 'downloadPDFBtn') downloadPDF();
});

// ---------- تغيير كلمة المرور ----------
function showChangePasswordDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.id = 'tempPasswordDialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>🔒 تغيير كلمة المرور</h3>
            <p style="font-size:14px">متاح فقط لـ <strong>shenouda</strong></p>
            <input type="password" id="currentPass" placeholder="كلمة المرور الحالية">
            <input type="password" id="newPass" placeholder="كلمة المرور الجديدة">
            <input type="password" id="confirmNewPass" placeholder="تأكيد كلمة المرور">
            <button onclick="changeAdminPasswordTemp()" class="btn-primary">تغيير</button>
            <button onclick="closeTempDialog()" class="btn-secondary">إلغاء</button>
        </div>
    `;
    document.body.appendChild(dialog);
}

function closeTempDialog() {
    const dialog = document.getElementById('tempPasswordDialog');
    if(dialog) dialog.remove();
}

function changeAdminPasswordTemp() {
    const current = document.getElementById('currentPass').value;
    const newPass = document.getElementById('newPass').value;
    const confirm = document.getElementById('confirmNewPass').value;
    const mainAdmin = admins.find(a => a.username === 'shenouda');
    if(!mainAdmin || mainAdmin.password !== current) return alert('⚠️ كلمة المرور الحالية غير صحيحة');
    if(newPass !== confirm) return alert('⚠️ كلمة المرور الجديدة غير متطابقة');
    mainAdmin.password = newPass;
    localStorage.setItem('customAdmins', JSON.stringify(admins));
    alert('✅ تم تغيير كلمة المرور بنجاح');
    closeTempDialog();
}

// ---------- PDF ----------
function downloadPDF() {
    const element = document.getElementById('pdf-content');
    if (element && typeof html2pdf !== 'undefined') {
        const originalHTML = element.innerHTML;
        element.innerHTML = `
            <div style="text-align:center; margin-bottom:20px;">
                <h1 style="color:#667eea;">أكولوثيا – نظام المتابعة</h1>
                <h2>${currentFilter === 'monthly' ? `تقرير شهر ${currentMonth+1}` : 'تقرير أسبوعي'}</h2>
                <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
                <hr>
            </div>
            ${originalHTML}
        `;
        
        html2pdf().set({
            margin: 10,
            filename: `تقرير_${currentFilter === 'monthly' ? `شهر_${currentMonth+1}` : 'اسبوعي'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        }).from(element).save().then(() => {
            element.innerHTML = originalHTML;
        });
    } else {
        alert('مكتبة PDF لم يتم تحميلها بعد');
    }
}

// ---------- دوال التنقل ----------
function backToLogin() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('loginScreen').classList.remove('hidden');
}

function backToMemberList() {
    if (isAdminLoggedIn) {
        showMemberListForAdmin();
    } else {
        showMemberList();
    }
}

// تحميل البيانات أول ما الموقع يفتح
loadDataFromSheet();
