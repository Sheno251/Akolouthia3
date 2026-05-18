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

const statusText = {
    'present': 'حاضر ✅',
    'late': 'متأخر ⏰',
    'absent': 'غائب بدون عذر ❌',
    'excused': 'غائب بعذر 📝',
    'travel': 'مسافر ✈️'
};

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
    let lastLateRecord = null;
    let lastRecord = null;
    
    records.forEach(r => {
        const status = r[3];
        if (status === 'present' || status === 'late') present++;
        if (status === 'late') {
            lateCount++;
            totalLateMinutes += parseInt(r[5]) || 0;
            if (!lastLateRecord || new Date(r[2]) > new Date(lastLateRecord[2])) {
                lastLateRecord = r;
            }
        }
        if (status === 'excused') excused++;
        if (status === 'absent') absent++;
        if (status === 'travel') travel++;
        if (!lastRecord || new Date(r[2]) > new Date(lastRecord[2])) {
            lastRecord = r;
        }
    });
    
    const presentRate = total ? Math.round((present / total) * 100) : 0;
    const excusedRate = total ? Math.round((excused / total) * 100) : 0;
    const absentRate = total ? Math.round((absent / total) * 100) : 0;
    const travelRate = total ? Math.round((travel / total) * 100) : 0;
    
    return {
        presentRate, excusedRate, absentRate, travelRate,
        total, totalLateMinutes, lateCount,
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
            <h3>📝 ملاحظات عن ${memberName}</h3>
            <textarea id="memberNote" rows="6">${currentNote.replace(/</g, '&lt;')}</textarea>
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
        records.forEach(r => {
            if (r[3] === 'late') {
                lateRecords.push({
                    name: name,
                    time: r[4],
                    date: r[2],
                    minutes: r[5]
                });
            }
        });
    }
    return lateRecords;
}

function formatDateRange() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const todayFormatted = today.toLocaleDateString('ar-EG', options);
    
    if (currentFilter === 'weekly') {
        const daysToLastSat = (today.getDay() + 1) % 7;
        const lastSaturday = new Date(today);
        lastSaturday.setDate(today.getDate() - daysToLastSat);
        const saturdayFormatted = lastSaturday.toLocaleDateString('ar-EG', options);
        return `📅 التقرير الأسبوعي - ${saturdayFormatted}`;
    } else {
        return `📅 التقرير الشهري - شهر ${currentMonth + 1} - ${todayFormatted}`;
    }
}

// ---------- عرض المربعات ----------
async function displayCards() {
    await loadDataFromSheet();
    const stats = [];
    for (const name of allNames.slice(0, 19)) {
        stats.push(await calculatePersonalStats(name, currentMonth));
    }
    
    let html = '';
    for (let i = 0; i < allNames.slice(0, 19).length; i++) {
        const name = allNames[i];
        const s = stats[i];
        const memberNotes = getNoteForMember(name, currentMonth);
        const notePreview = memberNotes.length > 80 ? memberNotes.substring(0, 80) + '...' : memberNotes;
        
        let lateDetailsHtml = '';
        if (s.lastLateRecord) {
            const lateMins = s.lastLateRecord[5];
            const lateTime = s.lastLateRecord[4];
            lateDetailsHtml = `
                <div class="late-details">
                    <div class="late-minutes">⏰ تأخر مدة ${lateMins} دقيقة</div>
                    <div class="late-time">🕒 حضر الساعة ${lateTime}</div>
                </div>
            `;
        }
        
        let lastRecordHtml = '';
        if (s.lastRecord) {
            const statusIcon = {
                'present': '✅', 'late': '⏰', 'absent': '❌', 'excused': '📝', 'travel': '✈️'
            }[s.lastRecord[3]] || '';
            const statusTextAr = {
                'present': 'حاضر', 'late': 'متأخر', 'absent': 'غائب', 'excused': 'غائب بعذر', 'travel': 'مسافر'
            }[s.lastRecord[3]] || s.lastRecord[3];
            lastRecordHtml = `
                <div class="last-record">
                    📌 آخر حضور: ${statusIcon} ${statusTextAr} - ${s.lastRecord[2]}
                </div>
            `;
        }
        
        let notesHtml = notePreview ? `<div class="notes-preview">📝 ${notePreview}</div>` : '';
        
        html += `
            <div class="stat-card">
                <a href="javascript:editMemberFromAdmin('${name}')" class="card-link">
                    <div class="card-header">👤 ${name}</div>
                    <div class="card-body">
                        <div class="stats-row">
                            <div class="stat-box">
                                <div class="stat-number ${s.presentRate >= 70 ? 'good' : 'warning'}">${s.presentRate}%</div>
                                <div class="stat-label-sm">الحضور</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-number">${s.total}</div>
                                <div class="stat-label-sm">اجتماعات</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-number ${s.absentRate > 20 ? 'bad' : ''}">${s.absentRate}%</div>
                                <div class="stat-label-sm">غياب</div>
                            </div>
                        </div>
                        ${lateDetailsHtml}
                        ${lastRecordHtml}
                        ${notesHtml}
                    </div>
                </a>
            </div>
        `;
    }
    document.getElementById('cardsContainer').innerHTML = html;
}

function displayWeeklyLatecomers() {
    if (currentFilter !== 'weekly') {
        document.getElementById('weeklyLatecomers').innerHTML = '';
        return;
    }
    
    const latecomers = getLatecomersWithTime(currentMonth, 'weekly');
    if (latecomers.length === 0) {
        document.getElementById('weeklyLatecomers').innerHTML = `<div class="latecomers-box">✅ لا يوجد متأخرون هذا الأسبوع</div>`;
        return;
    }
    
    let html = `<div class="latecomers-box">
        <h3>⏰ المتأخرون هذا الأسبوع</h3>
        <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th>الاسم</th><th>وقت الحضور</th><th>التأخير (دق)</th><th>التاريخ</th></tr></thead>
            <tbody>`;
    latecomers.forEach(l => {
        html += `<tr><td>${l.name}</td><td>${l.time}</td><td>${l.minutes}鲜<td>${l.date}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    document.getElementById('weeklyLatecomers').innerHTML = html;
}

// ---------- حذف الشهر ----------
async function deleteCurrentMonthData() {
    if (!confirm(`⚠️ هل أنت متأكد من حذف جميع بيانات شهر ${currentMonth + 1}؟`)) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'delete', month: currentMonth + 1 })
        });
        dataLoaded = false;
        attendanceCache = [];
        await loadDataFromSheet();
        updateAdminView();
        alert(`✅ تم حذف شهر ${currentMonth + 1}`);
    } catch(e) { alert("حدث خطأ أثناء حذف البيانات"); }
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
    allNames.slice(0, 19).forEach(name => {
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
    allNames.slice(0, 19).forEach(name => {
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
        let lateInfo = lastRecord[3] === 'late' ? `<br><small>⏱️ تأخر ${lastRecord[5]} دقيقة - حضر الساعة ${lastRecord[4]}</small>` : '';
        currentStatusDiv.innerHTML = `<strong>آخر تسجيل:</strong><br>${statusText[lastRecord[3]]}${lateInfo}<br><small>${lastRecord[2]} - ${lastRecord[4]}</small>`;
    } else {
        currentStatusDiv.innerHTML = 'لا توجد تسجيلات لهذا الشهر';
    }
    
    const stats = await calculatePersonalStats(currentMember, currentMonth);
    const lastLate = getMemberRecords(currentMember, currentMonth).filter(r => r[3] === 'late').pop();
    let lastLateTime = lastLate ? `<p>⏱️ آخر مرة تأخرت: حضر الساعة ${lastLate[4]} بتاريخ ${lastLate[2]}</p>` : '';
    
    document.getElementById('personalStats').innerHTML = `
        <p>✅ الحضور (حاضر + متأخر): ${stats.presentRate}%</p>
        <p>📝 الغياب بعذر: ${stats.excusedRate}%</p>
        <p>❌ الغياب بدون عذر: ${stats.absentRate}%</p>
        <p>✈️ مسافر: ${stats.travelRate}%</p>
        <p>📊 إجمالي التسجيلات: ${stats.total}</p>
        ${stats.lateCount > 0 ? `<p>⏰ عدد مرات التأخير: ${stats.lateCount}</p><p>⏱️ متوسط التأخير: ${stats.avgLate} دقيقة</p>${lastLateTime}` : ''}
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
    const admin = admins.find(a => a.username === username && a.password === password);
    if (admin) {
        isAdminLoggedIn = true;
        showAdminDashboard();
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
    document.getElementById('currentOfficialTime').innerText = getOfficialTime();
    updateAdminView();
    
    const currentUsername = document.getElementById('adminUsername').value;
    if (currentUsername === 'shenouda') {
        document.getElementById('editableRecordsSection').style.display = 'block';
        loadEditableRecords();
    } else {
        document.getElementById('editableRecordsSection').style.display = 'none';
    }
}

function editMemberFromAdmin(memberName) {
    fromAdminEdit = true;
    openMemberDashboard(memberName);
}

async function updateAdminView() {
    await loadDataFromSheet();
    document.getElementById('reportDateRange').innerHTML = formatDateRange();
    
    const stats = [];
    for (const name of allNames) stats.push(await calculatePersonalStats(name, currentMonth));
    const bestAttendance = [...stats].sort((a,b) => b.presentRate - a.presentRate)[0];
    const worstAbsence = [...stats].sort((a,b) => b.absentRate - a.absentRate)[0];
    const mostLate = [...stats].sort((a,b) => b.lateCount - a.lateCount)[0];
    
    document.getElementById('adminStats').innerHTML = `
        <div style="background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:20px;border-radius:15px;margin-bottom:20px;">
            <h3>📊 إحصائيات ${currentFilter==='monthly'?`شهر ${currentMonth+1}`:'آخر سبت'}</h3>
            <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;">
                <div>🏆 أعلى حضور: <strong>${bestAttendance ? allNames[stats.indexOf(bestAttendance)] : '-'}</strong> (${bestAttendance?.presentRate || 0}%)</div>
                <div>⚠️ أعلى غياب بدون عذر: <strong>${worstAbsence ? allNames[stats.indexOf(worstAbsence)] : '-'}</strong> (${worstAbsence?.absentRate || 0}%)</div>
                <div>⏰ أكثر عضو تأخيراً: <strong>${mostLate ? allNames[stats.indexOf(mostLate)] : '-'}</strong> (${mostLate?.lateCount || 0} مرة)</div>
            </div>
        </div>
    `;
    
    await displayCards();
    displayWeeklyLatecomers();
}

// ---------- دوال تعديل التسجيلات الفردية (لـ shenouda) ----------
async function loadEditableRecords() {
    await loadDataFromSheet();
    const records = [...attendanceCache].reverse();
    if (records.length === 0) {
        document.getElementById('editableRecordsTable').innerHTML = '<p>لا توجد تسجيلات لعرضها</p>';
        return;
    }
    
    let html = `<table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead><tr style="background:#1e293b; color:white;">
            <th>التاريخ</th><th>الوقت</th><th>العضو</th><th>الشهر</th><th>الحالة</th>
            <th>وقت الحضور</th><th>التأخير(دق)</th><th>حفظ</th><th>حذف</th>
        </tr></thead><tbody>`;
    
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const statusOptions = `
            <select id="status_${i}" style="padding:4px;border-radius:8px;">
                <option value="present" ${r[3] === 'present' ? 'selected' : ''}>✅ حاضر</option>
                <option value="late" ${r[3] === 'late' ? 'selected' : ''}>⏰ متأخر</option>
                <option value="absent" ${r[3] === 'absent' ? 'selected' : ''}>❌ غائب</option>
                <option value="excused" ${r[3] === 'excused' ? 'selected' : ''}>📝 غائب بعذر</option>
                <option value="travel" ${r[3] === 'travel' ? 'selected' : ''}>✈️ مسافر</option>
            </select>
        `;
        html += `<tr><td>${r[2]}</td><td>${r[4]}</td><td>${r[0]}</td><td>${r[1]}</td>
            <td>${statusOptions}</td>
            <td><input type="time" id="time_${i}" value="${r[4]}" style="width:100px;"></td>
            <td><input type="number" id="late_${i}" value="${r[5]}" style="width:60px;"></td>
            <td><button onclick="updateSingleRecord(${i})" style="background:#3b82f6;color:white;border:none;padding:4px 12px;border-radius:20px;">💾 حفظ</button></td>
            <td><button onclick="deleteSingleRecord(${i})" style="background:#e53e3e;color:white;border:none;padding:4px 12px;border-radius:20px;">🗑️ حذف</button></td></tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('editableRecordsTable').innerHTML = html;
}

window.updateSingleRecord = async function(index) {
    const records = [...attendanceCache].reverse();
    const oldRecord = records[index];
    const newStatus = document.getElementById(`status_${index}`).value;
    const newTime = document.getElementById(`time_${index}`).value;
    const newLate = parseInt(document.getElementById(`late_${index}`).value) || 0;
    const originalIndex = attendanceCache.findIndex(r => r[0] === oldRecord[0] && r[2] === oldRecord[2] && r[4] === oldRecord[4]);
    
    if (originalIndex !== -1) {
        attendanceCache[originalIndex][3] = newStatus;
        attendanceCache[originalIndex][4] = newTime;
        attendanceCache[originalIndex][5] = newLate;
        await syncAttendanceToSheet();
        await loadDataFromSheet();
        updateAdminView();
        loadEditableRecords();
        alert('✅ تم تعديل هذا التسجيل بنجاح');
    }
}

window.deleteSingleRecord = async function(index) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا التسجيل فقط؟')) return;
    const records = [...attendanceCache].reverse();
    const oldRecord = records[index];
    const originalIndex = attendanceCache.findIndex(r => r[0] === oldRecord[0] && r[2] === oldRecord[2] && r[4] === oldRecord[4]);
    
    if (originalIndex !== -1) {
        attendanceCache.splice(originalIndex, 1);
        await syncAttendanceToSheet();
        await loadDataFromSheet();
        updateAdminView();
        loadEditableRecords();
        alert('✅ تم حذف هذا التسجيل فقط');
    }
}

async function syncAttendanceToSheet() {
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'delete_all' }) });
    for (const record of attendanceCache) {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(record) });
    }
}

// ---------- مراقبة الأزرار ----------
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
    if(e.target.id === 'deleteMonthBtn') deleteCurrentMonthData();
});

// ---------- تغيير كلمة المرور ----------
function showChangePasswordDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.id = 'tempPasswordDialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>🔒 تغيير كلمة المرور</h3>
            <p>متاح فقط لـ <strong>shenouda</strong></p>
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
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        const todayFormatted = today.toLocaleDateString('ar-EG', options);
        let periodText = '';
        
        if (currentFilter === 'weekly') {
            const daysToLastSat = (today.getDay() + 1) % 7;
            const lastSaturday = new Date(today);
            lastSaturday.setDate(today.getDate() - daysToLastSat);
            periodText = `تقرير أسبوعي - ${lastSaturday.toLocaleDateString('ar-EG', options)}`;
        } else {
            periodText = `تقرير شهري - شهر ${currentMonth + 1}`;
        }
        
        element.innerHTML = `
            <div style="text-align:center; margin-bottom:20px;">
                <h1 style="color:#667eea;">أكولوثيا – نظام المتابعة</h1>
                <h2>${periodText}</h2>
                <p>تاريخ الطباعة: ${todayFormatted}</p>
                <hr>
            </div>
            ${originalHTML}
        `;
        
        html2pdf().set({
            margin: 10,
            filename: `تقرير_${currentFilter === 'monthly' ? `شهر_${currentMonth+1}` : 'اسبوعي'}_${today.toISOString().slice(0,10)}.pdf`,
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
    if (isAdminLoggedIn) showMemberListForAdmin();
    else showMemberList();
}

loadDataFromSheet();
