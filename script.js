// الأسماء الكاملة (19 عضو + 3 أدمن)
const allNames = [
    "مارتيروس جمال", "نرمين فرج الله", "ميرنا فام", "بيشوي صفوت", "شنوده نصحي", "سيلفيا طلعت", 
    "سيمون سمعان", "كرستينا ميلاد", "ماري بشاي", "ابانوب فرج الله", "امال عادل", "باسم جابر",
    "هاله عادل", "دميانه سمعان", "فام روماني", "ويصا مرزق", "ماري هاني", "مينا فام", "فيولا طلعت",
    "shenouda", "admin2", "admin3"
];

// الأدمن
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
let currentFilter = 'monthly';

// ---------- بيانات Google Sheets ----------
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
    if(status === 'late') lateMinutes = calculateLateMinutes();
    const record = [
        currentMember, currentMonth + 1, now.toISOString().slice(0,10),
        status, actualTime, lateMinutes, ""
    ];
    await saveToSheet(record);
    await updateMemberView();
    if(document.getElementById('adminDashboard') && !document.getElementById('adminDashboard').classList.contains('hidden')) updateAdminView();
    alert(`✅ تم تسجيل ${status === 'present' ? 'الحضور' : status === 'late' ? 'التأخير' : status === 'absent' ? 'الغياب بدون عذر' : status === 'excused' ? 'الغياب بعذر' : 'السفر'} بنجاح`);
}

async function recordLateAuto() { await recordStatus('late'); }

// ---------- حساب الإحصائيات الكاملة لكل عضو ----------
async function calculateFullStats(name, month) {
    await loadDataFromSheet();
    const records = attendanceCache.filter(r => r[0] === name && r[1] === month + 1);
    const total = records.length;
    
    let presentCount = 0, lateCount = 0, excusedCount = 0, absentCount = 0, travelCount = 0;
    let totalLateMinutes = 0;
    let lastLateRecord = null;
    let lastRecord = null;
    
    records.forEach(r => {
        const status = r[3];
        if (status === 'present') presentCount++;
        if (status === 'late') { 
            lateCount++; 
            totalLateMinutes += parseInt(r[5]) || 0;
            if (!lastLateRecord || new Date(r[2]) > new Date(lastLateRecord[2])) lastLateRecord = r;
        }
        if (status === 'excused') excusedCount++;
        if (status === 'absent') absentCount++;
        if (status === 'travel') travelCount++;
        if (!lastRecord || new Date(r[2]) > new Date(lastRecord[2])) lastRecord = r;
    });
    
    const totalPresent = presentCount + lateCount;
    const presentRate = total ? Math.round((totalPresent / total) * 100) : 0;
    const excusedRate = total ? Math.round((excusedCount / total) * 100) : 0;
    const absentRate = total ? Math.round((absentCount / total) * 100) : 0;
    const travelRate = total ? Math.round((travelCount / total) * 100) : 0;
    
    return {
        presentCount, lateCount, excusedCount, absentCount, travelCount,
        presentRate, excusedRate, absentRate, travelRate,
        total, totalPresent, totalLateMinutes, lateCount,
        avgLate: lateCount ? Math.round(totalLateMinutes / lateCount) : 0,
        lastRecord, lastLateRecord
    };
}

// ---------- دوال الملاحظات ----------
function getNoteForMember(memberName, month) {
    const memberRecords = attendanceCache.filter(r => r[0] === memberName && r[1] === month + 1);
    const notes = memberRecords.filter(r => r[6] && r[6].trim() !== '').map(r => r[6]);
    return notes.join('\n---\n');
}

function showNoteDialog(memberName) {
    const currentNote = getNoteForMember(memberName, currentMonth);
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.id = 'noteDialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>📝 ملاحظات</h3>
            <textarea id="memberNote" rows="5">${currentNote.replace(/</g, '&lt;')}</textarea>
            <button onclick="saveNote('${memberName}')" class="btn-primary">💾 حفظ</button>
            <button onclick="closeNoteDialog()" class="btn-secondary">إلغاء</button>
        </div>
    `;
    document.body.appendChild(dialog);
}

function closeNoteDialog() { const d = document.getElementById('noteDialog'); if(d) d.remove(); }

async function saveNote(memberName) {
    const noteText = document.getElementById('memberNote').value;
    if (!noteText.trim()) { closeNoteDialog(); return; }
    const now = new Date();
    const record = [memberName, currentMonth+1, now.toISOString().slice(0,10), 'note', now.toLocaleTimeString('ar-EG'), 0, noteText];
    await saveToSheet(record);
    await loadDataFromSheet();
    if(document.getElementById('adminDashboard') && !document.getElementById('adminDashboard').classList.contains('hidden')) updateAdminView();
    closeNoteDialog();
    alert('✅ تم حفظ الملاحظة');
}

// ---------- وظائف التصفية ----------
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
        records.forEach(r => { if (r[3] === 'late') lateRecords.push({ name, time: r[4], date: r[2], minutes: r[5] }); });
    }
    return lateRecords;
}

function formatDateRange() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    if (currentFilter === 'weekly') {
        const daysToLastSat = (today.getDay() + 1) % 7;
        const lastSaturday = new Date(today);
        lastSaturday.setDate(today.getDate() - daysToLastSat);
        return `📅 التقرير الأسبوعي - ${lastSaturday.toLocaleDateString('ar-EG', options)}`;
    }
    return `📅 التقرير الشهري - شهر ${currentMonth + 1} - ${today.toLocaleDateString('ar-EG', options)}`;
}

// ---------- عرض المربعات في التقرير (أسماء فقط للطباعة) ----------
async function displayCards() {
    await loadDataFromSheet();
    let html = '';
    for (const name of allNames.slice(0, 19)) {
        html += `
            <div class="stat-card">
                <a href="javascript:editMemberFromAdmin('${name}')" class="card-link">
                    <div class="card-header">👤 ${name}</div>
                </a>
            </div>
        `;
    }
    document.getElementById('cardsContainer').innerHTML = html;
}

function displayWeeklyLatecomers() {
    if (currentFilter !== 'weekly') { document.getElementById('weeklyLatecomers').innerHTML = ''; return; }
    const latecomers = getLatecomersWithTime(currentMonth, 'weekly');
    if (latecomers.length === 0) {
        document.getElementById('weeklyLatecomers').innerHTML = `<div class="latecomers-box">✅ لا يوجد متأخرون هذا الأسبوع</div>`;
        return;
    }
    let html = `<div class="latecomers-box"><h3>⏰ المتأخرون هذا الأسبوع</h3><table><thead><tr><th>الاسم</th><th>وقت الحضور</th><th>التأخير(دق)</th><th>التاريخ</th></tr></thead><tbody>`;
    latecomers.forEach(l => { html += `<tr><td>${l.name}</td><td>${l.time}鲜<td>${l.minutes}鲜<td>${l.date}鲜</tr>`; });
    html += `</tbody></table></div>`;
    document.getElementById('weeklyLatecomers').innerHTML = html;
}

// ---------- حذف الشهر ----------
async function deleteCurrentMonthData() {
    if (!confirm(`⚠️ هل أنت متأكد من حذف جميع بيانات شهر ${currentMonth + 1}؟`)) return;
    try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'delete', month: currentMonth + 1 }) });
        dataLoaded = false; attendanceCache = []; await loadDataFromSheet(); updateAdminView();
        alert(`✅ تم حذف شهر ${currentMonth + 1}`);
    } catch(e) { alert("حدث خطأ أثناء حذف البيانات"); }
}

// ---------- عرض الأعضاء ----------
function showMemberList() {
    document.getElementById('adminPanelBtn').style.display = 'none';
    document.getElementById('backToAdminBtn').style.display = 'none';
    isAdminLoggedIn = false; fromAdminEdit = false;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('memberScreen').classList.remove('hidden');
    const container = document.getElementById('memberList');
    container.innerHTML = '';
    allNames.slice(0, 19).forEach(name => {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.textContent = name;
        card.onclick = () => openMemberDashboard(name);
        container.appendChild(card);
    });
}

function showMemberListForAdmin() {
    document.getElementById('adminPanelBtn').style.display = 'inline-block';
    isAdminLoggedIn = true;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('memberScreen').classList.remove('hidden');
    const container = document.getElementById('memberList');
    container.innerHTML = '';
    allNames.slice(0, 19).forEach(name => {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.textContent = name;
        card.onclick = () => { fromAdminEdit = true; openMemberDashboard(name); };
        container.appendChild(card);
    });
}

function openMemberDashboard(name) {
    const isAdminPerson = (name === "shenouda" || name === "admin2" || name === "admin3");
    currentMember = name; currentMonth = 0;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('memberDashboard').classList.remove('hidden');
    document.getElementById('memberName').textContent = name;
    document.getElementById('backToAdminBtn').style.display = (isAdminLoggedIn || fromAdminEdit || isAdminPerson) ? 'inline-block' : 'none';
    renderMonthsTabs('memberMonthsTabs', true);
    const btns = document.querySelectorAll('.status-btn');
    btns.forEach(btn => btn.style.display = (fromAdminEdit || isAdminLoggedIn || isAdminPerson) ? 'flex' : 'none');
    fromAdminEdit = false;
    updateMemberView();
}

function backToAdminPanel() { showAdminDashboard(); }

async function updateMemberView() {
    await loadDataFromSheet();
    const records = getMemberRecords(currentMember, currentMonth);
    const last = records[records.length - 1];
    const statusDiv = document.getElementById('currentStatus');
    if (last) {
        let lateInfo = last[3] === 'late' ? `<br><small>⏱️ تأخر ${last[5]} دقيقة - حضر الساعة ${last[4]}</small>` : '';
        const texts = { present:'✅ حاضر', late:'⏰ متأخر', absent:'❌ غائب', excused:'📝 غائب بعذر', travel:'✈️ مسافر' };
        statusDiv.innerHTML = `<strong>آخر تسجيل:</strong><br>${texts[last[3]]}${lateInfo}<br><small>${last[2]} - ${last[4]}</small>`;
    } else statusDiv.innerHTML = 'لا توجد تسجيلات لهذا الشهر';
    const stats = await calculateFullStats(currentMember, currentMonth);
    const lastLate = records.filter(r => r[3] === 'late').pop();
    const notes = getNoteForMember(currentMember, currentMonth);
    document.getElementById('personalStats').innerHTML = `
        <p>✅ الحضور: ${stats.presentCount} مرة (${stats.presentRate}%)</p>
        <p>⏰ متأخر: ${stats.lateCount} مرة (متوسط ${stats.avgLate} دقيقة)</p>
        <p>📝 غياب بعذر: ${stats.excusedCount} مرة (${stats.excusedRate}%)</p>
        <p>❌ غياب بدون عذر: ${stats.absentCount} مرة (${stats.absentRate}%)</p>
        <p>✈️ مسافر: ${stats.travelCount} مرة (${stats.travelRate}%)</p>
        <p>📊 إجمالي التسجيلات: ${stats.total}</p>
        ${lastLate ? `<p>⏱️ آخر تأخير: حضر الساعة ${lastLate[4]} بتاريخ ${lastLate[2]}</p>` : ''}
        ${notes ? `<p>📝 ملاحظات: ${notes}</p>` : ''}
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

// ---------- مشغل الأدمن ----------
function showAdminLogin() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('adminLoginScreen').classList.remove('hidden');
}

function verifyAdmin() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    if (admins.find(a => a.username === username && a.password === password)) {
        isAdminLoggedIn = true;
        showAdminDashboard();
    } else alert('بيانات دخول خاطئة');
}

function showAdminDashboard() {
    currentMember = null; currentMonth = 0;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('adminDashboard').classList.remove('hidden');
    renderMonthsTabs('adminMonthsTabs', false);
    document.getElementById('currentOfficialTime').innerText = getOfficialTime();
    updateAdminView();
    if (document.getElementById('adminUsername').value === 'shenouda') {
        document.getElementById('editableRecordsSection').style.display = 'block';
        loadEditableRecords();
    } else document.getElementById('editableRecordsSection').style.display = 'none';
}

function editMemberFromAdmin(memberName) { fromAdminEdit = true; openMemberDashboard(memberName); }

async function updateAdminView() {
    await loadDataFromSheet();
    document.getElementById('reportDateRange').innerHTML = formatDateRange();
    const stats = [];
    for (const name of allNames) stats.push(await calculateFullStats(name, currentMonth));
    const best = [...stats].sort((a,b) => b.presentRate - a.presentRate)[0];
    const worst = [...stats].sort((a,b) => b.absentRate - a.absentRate)[0];
    const mostLate = [...stats].sort((a,b) => b.lateCount - a.lateCount)[0];
    document.getElementById('adminStats').innerHTML = `
        <div style="background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:20px;border-radius:24px;margin-bottom:20px;">
            <h3>📊 إحصائيات ${currentFilter==='monthly'?`شهر ${currentMonth+1}`:'آخر سبت'}</h3>
            <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between">
                <div>🏆 أعلى حضور: <strong>${allNames[stats.indexOf(best)]}</strong> (${best.presentRate}%)</div>
                <div>⚠️ أعلى غياب بدون عذر: <strong>${allNames[stats.indexOf(worst)]}</strong> (${worst.absentRate}%)</div>
                <div>⏰ أكثر تأخير: <strong>${allNames[stats.indexOf(mostLate)]}</strong> (${mostLate.lateCount} مرات)</div>
            </div>
        </div>
    `;
    await displayCards();
    displayWeeklyLatecomers();
}

// ---------- جدول تعديل التسجيلات (لـ shenouda) ----------
async function loadEditableRecords() {
    await loadDataFromSheet();
    const records = [...attendanceCache].reverse();
    if (records.length === 0) { document.getElementById('editableRecordsTable').innerHTML = '<p>لا توجد تسجيلات</p>'; return; }
    let html = `<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#1e293b;color:white"><th>التاريخ</th><th>الوقت</th><th>العضو</th><th>الحالة</th><th>وقت الحضور</th><th>التأخير</th><th>حفظ</th><th>حذف</th></tr></thead><tbody>`;
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        html += `<tr style="border-bottom:1px solid #e2e8f0">
            <td>${r[2]}</td><td>${r[4]}</td><td>${r[0]}</td>
            <td><select id="stat_${i}"><option ${r[3]==='present'?'selected':''}>✅ حاضر</option><option ${r[3]==='late'?'selected':''}>⏰ متأخر</option><option ${r[3]==='absent'?'selected':''}>❌ غائب</option><option ${r[3]==='excused'?'selected':''}>📝 غائب بعذر</option><option ${r[3]==='travel'?'selected':''}>✈️ مسافر</option></select></td>
            <td><input type="time" id="time_${i}" value="${r[4]}"></td>
            <td><input type="number" id="late_${i}" value="${r[5]}" style="width:70px"></td>
            <td><button onclick="updateRecord(${i})" style="background:#3b82f6;color:white;border:none;padding:4px 12px;border-radius:20px">💾 حفظ</button></td>
            <td><button onclick="deleteRecord(${i})" style="background:#ef4444;color:white;border:none;padding:4px 12px;border-radius:20px">🗑️ حذف</button></td>
        </tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('editableRecordsTable').innerHTML = html;
}

window.updateRecord = async function(i) {
    const records = [...attendanceCache].reverse();
    const old = records[i];
    const newStatus = document.getElementById(`stat_${i}`).value === '✅ حاضر' ? 'present' : document.getElementById(`stat_${i}`).value === '⏰ متأخر' ? 'late' : document.getElementById(`stat_${i}`).value === '❌ غائب' ? 'absent' : document.getElementById(`stat_${i}`).value === '📝 غائب بعذر' ? 'excused' : 'travel';
    const newTime = document.getElementById(`time_${i}`).value;
    const newLate = parseInt(document.getElementById(`late_${i}`).value) || 0;
    const idx = attendanceCache.findIndex(r => r[0] === old[0] && r[2] === old[2] && r[4] === old[4]);
    if (idx !== -1) {
        attendanceCache[idx][3] = newStatus;
        attendanceCache[idx][4] = newTime;
        attendanceCache[idx][5] = newLate;
        await syncAttendanceToSheet();
        await loadDataFromSheet();
        updateAdminView();
        loadEditableRecords();
        alert('✅ تم التعديل');
    }
}

window.deleteRecord = async function(i) {
    if (!confirm('حذف هذا التسجيل؟')) return;
    const records = [...attendanceCache].reverse();
    const old = records[i];
    const idx = attendanceCache.findIndex(r => r[0] === old[0] && r[2] === old[2] && r[4] === old[4]);
    if (idx !== -1) {
        attendanceCache.splice(idx, 1);
        await syncAttendanceToSheet();
        await loadDataFromSheet();
        updateAdminView();
        loadEditableRecords();
        alert('✅ تم الحذف');
    }
}

async function syncAttendanceToSheet() {
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'delete_all' }) });
    for (const rec of attendanceCache) await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(rec) });
}

// ---------- مراقبة الأزرار ----------
document.addEventListener('click', (e) => {
    if(e.target.id === 'filterMonthly') { currentFilter = 'monthly'; document.getElementById('filterMonthly').classList.add('active'); document.getElementById('filterWeekly').classList.remove('active'); updateAdminView(); }
    if(e.target.id === 'filterWeekly') { currentFilter = 'weekly'; document.getElementById('filterWeekly').classList.add('active'); document.getElementById('filterMonthly').classList.remove('active'); updateAdminView(); }
    if(e.target.id === 'changePasswordBtn') showChangePasswordDialog();
    if(e.target.id === 'downloadPDFBtn') downloadPDF();
    if(e.target.id === 'deleteMonthBtn') deleteCurrentMonthData();
});

// ---------- تغيير كلمة المرور ----------
function showChangePasswordDialog() {
    const dialog = document.createElement('div'); dialog.className = 'dialog'; dialog.innerHTML = `
        <div class="dialog-content"><h3>🔒 تغيير كلمة المرور</h3>
        <input type="password" id="curPass" placeholder="كلمة المرور الحالية">
        <input type="password" id="newPass1" placeholder="كلمة المرور الجديدة">
        <input type="password" id="newPass2" placeholder="تأكيد كلمة المرور">
        <button onclick="changePass()" class="btn-primary">تغيير</button>
        <button onclick="this.parentElement.parentElement.remove()" class="btn-secondary">إلغاء</button></div>`;
    document.body.appendChild(dialog);
}
function changePass() {
    const cur = document.getElementById('curPass').value;
    const new1 = document.getElementById('newPass1').value;
    const new2 = document.getElementById('newPass2').value;
    const admin = admins.find(a => a.username === 'shenouda');
    if (!admin || admin.password !== cur) return alert('كلمة المرور الحالية خطأ');
    if (new1 !== new2) return alert('كلمة المرور الجديدة غير متطابقة');
    admin.password = new1;
    localStorage.setItem('customAdmins', JSON.stringify(admins));
    alert('✅ تم تغيير كلمة المرور');
    document.querySelector('.dialog').remove();
}

// ---------- PDF ----------
function downloadPDF() {
    const element = document.getElementById('pdf-content');
    if (element && typeof html2pdf !== 'undefined') {
        const original = element.innerHTML;
        const today = new Date();
        let period = '';
        if (currentFilter === 'weekly') {
            const daysToLastSat = (today.getDay() + 1) % 7;
            const lastSaturday = new Date(today);
            lastSaturday.setDate(today.getDate() - daysToLastSat);
            period = `تقرير أسبوعي - ${lastSaturday.toLocaleDateString('ar-EG')}`;
        } else {
            period = `تقرير شهري - شهر ${currentMonth+1}`;
        }
        element.innerHTML = `<div style="text-align:center;margin-bottom:20px"><h1 style="color:#667eea">أكولوثيا – نظام المتابعة</h1><h2>${period}</h2><p>تاريخ الطباعة: ${today.toLocaleDateString('ar-EG')}</p><hr></div>${original}`;
        html2pdf().set({ margin: 10, filename: `تقرير_${currentFilter === 'monthly' ? `شهر_${currentMonth+1}` : 'اسبوعي'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(element).save().then(() => element.innerHTML = original);
    }
}

function backToLogin() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('loginScreen').classList.remove('hidden');
}
function backToMemberList() { if (isAdminLoggedIn) showMemberListForAdmin(); else showMemberList(); }

loadDataFromSheet();
