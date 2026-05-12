// الأسماء الكاملة (12 عضو + 3 أدمن)
const allNames = [
    "مارتيروس جمال", "نرمين فرج الله", "ميرنا فام", "بيشوي صفوت", "شنوده نصحي", "سيلفيا طلعت", "سيمون سمعان", "كرستينا ميلاد", "ماري بشاي", "ابانوب فرج الله", "امال عادل", "باسم جابر",  // 12 عضو
    "هاله عادل", "دميانه سمعان", "فام روماني",",ويصا مرزق","ماري هاني ","مينا فام","فيولا طلعت"  // 3 أدمن
];


// الأدمن
const admins = [
    { username: "admin1", password: "admin123" },
    { username: "admin2", password: "admin123" },
    { username: "admin3", password: "admin123" }
];

const MONTHS_COUNT = 12;
let currentMember = null;
let currentMonth = 0;

const statusText = {
    'present': 'حاضر ✅',
    'late': 'متأخر ⏰',
    'absent': 'غائب بدون عذر ❌',
    'excused': 'غائب بعذر 📝'
};

// -------------------- تخزين البيانات --------------------
function loadData() {
    let data = localStorage.getItem('attendanceData');
    if (!data) {
        data = {};
        allNames.forEach(name => {
            data[name] = [];
            for (let i = 0; i < MONTHS_COUNT; i++) {
                data[name][i] = [];
            }
        });
    } else {
        data = JSON.parse(data);
        allNames.forEach(name => {
            if (!data[name]) data[name] = [];
            for (let i = 0; i < MONTHS_COUNT; i++) {
                if (!data[name][i]) data[name][i] = [];
            }
        });
    }
    return data;
}

function saveData(data) {
    localStorage.setItem('attendanceData', JSON.stringify(data));
}

// -------------------- الموعد الرسمي --------------------
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
    if (!newTime) {
        alert('اختر الوقت أولاً');
        return;
    }
    localStorage.setItem('officialTime', newTime);
    document.getElementById('currentOfficialTime').textContent = newTime;
    alert(`تم تغيير الموعد الرسمي إلى ${newTime}`);
}

function calculateLateMinutes(actualHour, actualMinute) {
    const officialTime = getOfficialTime();
    const [officialHour, officialMinute] = officialTime.split(':').map(Number);
    let lateMinutes = (actualHour - officialHour) * 60 + (actualMinute - officialMinute);
    return lateMinutes > 0 ? lateMinutes : 0;
}

// -------------------- نافذة التأخير --------------------
function showLateDialog() {
    document.getElementById('lateDialog').classList.remove('hidden');
    const officialTime = getOfficialTime();
    document.querySelector('#lateDialog p').innerHTML = `الموعد الرسمي: ${officialTime}`;
}

function closeLateDialog() {
    document.getElementById('lateDialog').classList.add('hidden');
}

function recordLate() {
    const actualTime = document.getElementById('actualTime').value;
    if (!actualTime) {
        alert('يرجى إدخال وقت الحضور');
        return;
    }
    const [hour, minute] = actualTime.split(':').map(Number);
    const lateMinutes = calculateLateMinutes(hour, minute);
    
    const data = loadData();
    if (!data[currentMember][currentMonth]) data[currentMember][currentMonth] = [];
    
    data[currentMember][currentMonth].push({
        status: 'late',
        time: new Date().toLocaleTimeString('ar-EG'),
        date: new Date().toLocaleDateString('ar-EG'),
        lateMinutes: lateMinutes,
        actualTime: actualTime
    });
    
    saveData(data);
    closeLateDialog();
    updateMemberView();
}

// -------------------- تسجيل الحالات --------------------
function recordStatus(status) {
    if (!currentMember) return;
    
    const data = loadData();
    if (!data[currentMember][currentMonth]) data[currentMember][currentMonth] = [];
    
    data[currentMember][currentMonth].push({
        status: status,
        time: new Date().toLocaleTimeString('ar-EG'),
        date: new Date().toLocaleDateString('ar-EG')
    });
    
    saveData(data);
    updateMemberView();
}

// -------------------- إعادة تعيين شهر --------------------
function resetCurrentMonth() {
    if (!confirm(`هل أنت متأكد من حذف جميع بيانات شهر ${currentMonth + 1}؟ لا يمكن التراجع.`)) return;
    
    const data = loadData();
    allNames.forEach(name => {
        data[name][currentMonth] = [];
    });
    saveData(data);
    alert(`تم حذف بيانات شهر ${currentMonth + 1} بنجاح`);
    updateAdminView();
}

// -------------------- حساب النسب --------------------
function calculatePersonalStats(name, month) {
    const data = loadData();
    const records = data[name][month] || [];
    const total = records.length;
    
    let present = 0, excused = 0, absent = 0;
    let totalLateMinutes = 0;
    let lateCount = 0;
    
    records.forEach(r => {
        if (r.status === 'present' || r.status === 'late') {
            present++;
            if (r.status === 'late') {
                lateCount++;
                totalLateMinutes += r.lateMinutes || 0;
            }
        }
        else if (r.status === 'excused') excused++;
        else if (r.status === 'absent') absent++;
    });
    
    return {
        presentRate: total ? Math.round((present / total) * 100) : 0,
        excusedRate: total ? Math.round((excused / total) * 100) : 0,
        absentRate: total ? Math.round((absent / total) * 100) : 0,
        total: total,
        totalLateMinutes: totalLateMinutes,
        lateCount: lateCount,
        avgLate: lateCount ? Math.round(totalLateMinutes / lateCount) : 0
    };
}

// -------------------- عرض الأعضاء --------------------
function showMemberList() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('memberScreen').classList.remove('hidden');
    
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '';
    
    // عرض الأعضاء العاديين فقط (أول 19 اسم)
    const normalMembers = allNames.slice(0, 19);
    normalMembers.forEach(name => {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.textContent = name;
        card.onclick = () => openMemberDashboard(name);
        memberList.appendChild(card);
    });
}

function openMemberDashboard(name) {
    // التحقق إذا كان الشخص أدمن
    const isAdminPerson = name.includes("أدمن");
    
    currentMember = name;
    currentMonth = 0;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('memberDashboard').classList.remove('hidden');
    document.getElementById('memberName').textContent = name;
    renderMonthsTabs('memberMonthsTabs', true);
    
    if (isAdminPerson) {
        // أدمن: يقدر يغير
        document.querySelectorAll('.status-btn').forEach(btn => {
            btn.style.display = 'flex';
        });
    } else {
        // عضو عادي: يشوف بس ميقدرش يغير
        document.querySelectorAll('.status-btn').forEach(btn => {
            btn.style.display = 'none';
        });
    }
    
    updateMemberView();
}

function updateMemberView() {
    const data = loadData();
    const records = data[currentMember][currentMonth] || [];
    const lastRecord = records[records.length - 1];
    
    const currentStatusDiv = document.getElementById('currentStatus');
    if (lastRecord) {
        let lateInfo = '';
        if (lastRecord.status === 'late') {
            lateInfo = `<br><small>⏱️ تأخر ${lastRecord.lateMinutes} دقيقة - حضر الساعة ${lastRecord.actualTime}</small>`;
        }
        currentStatusDiv.innerHTML = `
            <strong>آخر تسجيل:</strong><br>
            ${statusText[lastRecord.status]}${lateInfo}<br>
            <small>${lastRecord.date} - ${lastRecord.time}</small>
        `;
    } else {
        currentStatusDiv.innerHTML = 'لا توجد تسجيلات لهذا الشهر';
    }
    
    const stats = calculatePersonalStats(currentMember, currentMonth);
    document.getElementById('personalStats').innerHTML = `
        <p>✅ الحضور (حاضر + متأخر): ${stats.presentRate}%</p>
        <p>📝 الغياب بعذر: ${stats.excusedRate}%</p>
        <p>❌ الغياب بدون عذر: ${stats.absentRate}%</p>
        <p>📊 إجمالي التسجيلات: ${stats.total}</p>
        ${stats.lateCount > 0 ? `<p>⏰ عدد مرات التأخير: ${stats.lateCount}</p>
        <p>⏱️ متوسط التأخير: ${stats.avgLate} دقيقة</p>` : ''}
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
        btn.dataset.month = i;
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

// -------------------- الأدمن --------------------
function showAdminLogin() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('adminLoginScreen').classList.remove('hidden');
}

function verifyAdmin() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    const admin = admins.find(a => a.username === username && a.password === password);
    if (admin) {
        showAdminDashboard();
    } else {
        alert('اسم المستخدم أو كلمة السر خطأ');
    }
}

function showAdminDashboard() {
    currentMonth = 0;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('adminDashboard').classList.remove('hidden');
    renderMonthsTabs('adminMonthsTabs', false);
    const officialTimeElement = document.getElementById('currentOfficialTime');
    if (officialTimeElement) officialTimeElement.textContent = getOfficialTime();
    updateAdminView();
}

function editMemberFromAdmin(memberName) {
    currentMember = memberName;
    currentMonth = 0;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('memberDashboard').classList.remove('hidden');
    document.getElementById('memberName').textContent = memberName;
    renderMonthsTabs('memberMonthsTabs', true);
    
    // إظهار أزرار التسجيل للأدمن
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.style.display = 'flex';
    });
    
    updateMemberView();
}

function downloadPDF() {
    const element = document.getElementById('pdf-content');
    if (!element) {
        alert('خطأ في إنشاء التقرير');
        return;
    }
    
    const monthName = `شهر ${currentMonth + 1}`;
    const date = new Date().toLocaleDateString('ar-EG');
    
    const originalHTML = element.innerHTML;
    element.innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
            <h1 style="color:#667eea;">تقرير حضور وغياب الكنيسة</h1>
            <h2>${monthName}</h2>
            <p>تاريخ التقرير: ${date}</p>
            <hr>
        </div>
        ${originalHTML}
        <div style="text-align:center; margin-top:30px; font-size:12px; color:#999;">
            تم إنشاء التقرير بواسطة نظام الحضور والغياب
        </div>
    `;
    
    const options = {
        margin: [10, 10, 10, 10],
        filename: `تقرير_${monthName}_${date}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    
    html2pdf().set(options).from(element).save().then(() => {
        element.innerHTML = originalHTML;
    }).catch(() => {
        element.innerHTML = originalHTML;
        alert('حدث خطأ في تحميل PDF');
    });
}

function updateAdminView() {
    const stats = [];
    
    allNames.forEach(name => {
        const personalStats = calculatePersonalStats(name, currentMonth);
        stats.push({ name, ...personalStats });
    });
    
    const bestAttendance = [...stats].sort((a,b) => b.presentRate - a.presentRate)[0];
    const worstAbsence = [...stats].sort((a,b) => b.absentRate - a.absentRate)[0];
    const mostLate = [...stats].sort((a,b) => b.lateCount - a.lateCount)[0];
    
    const adminStatsDiv = document.getElementById('adminStats');
    if (adminStatsDiv) {
        adminStatsDiv.innerHTML = `
            <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:20px; border-radius:15px; margin-bottom:20px;">
                <h3 style="margin:0 0 10px 0;">📊 إحصائيات شهر ${currentMonth + 1}</h3>
                <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between;">
                    <div>🏆 أعلى نسبة حضور: <strong>${bestAttendance?.name || '-'}</strong> (${bestAttendance?.presentRate || 0}%)</div>
                    <div>⚠️ أعلى غياب بدون عذر: <strong>${worstAbsence?.name || '-'}</strong> (${worstAbsence?.absentRate || 0}%)</div>
                    <div>⏰ أكثر عضو تأخيراً: <strong>${mostLate?.name || '-'}</strong> (${mostLate?.lateCount || 0} مرة - متوسط ${mostLate?.avgLate || 0} دقيقة)</div>
                </div>
            </div>
        `;
    }
    
    let html = `<div style="overflow-x:auto; border-radius:15px; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
        <table style="width:100%; border-collapse:collapse; background:white;">
            <thead>
                <tr style="background:#667eea; color:white;">
                    <th style="padding:12px; text-align:center;">الاسم</th>
                    <th style="padding:12px; text-align:center;">حضور + متأخر</th>
                    <th style="padding:12px; text-align:center;">غياب بعذر</th>
                    <th style="padding:12px; text-align:center;">غياب بدون عذر</th>
                    <th style="padding:12px; text-align:center;">عدد مرات التأخير</th>
                    <th style="padding:12px; text-align:center;">متوسط التأخير(دق)</th>
                    <th style="padding:12px; text-align:center;">إجمالي</th>
                    <th style="padding:12px; text-align:center;">تعديل</th>
                </tr>
            </thead>
            <tbody>`;
    
    stats.forEach((s, index) => {
        const bgColor = index % 2 === 0 ? '#f7fafc' : 'white';
        html += `<tr style="background:${bgColor}; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px; text-align:center; font-weight:bold;">${s.name}</td>
            <td style="padding:10px; text-align:center; color:#48bb78; font-weight:bold;">${s.presentRate}%</td>
            <td style="padding:10px; text-align:center; color:#4299e1;">${s.excusedRate}%</td>
            <td style="padding:10px; text-align:center; color:#f56565;">${s.absentRate}%</td>
            <td style="padding:10px; text-align:center;">${s.lateCount}</td>
            <td style="padding:10px; text-align:center;">${s.avgLate}</td>
            <td style="padding:10px; text-align:center;">${s.total}</td>
            <td style="padding:10px; text-align:center;"><button onclick="editMemberFromAdmin('${s.name}')" style="background:#667eea;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">✏️ تعديل</button></td>
        </tr>`;
    });
    
    html += `</tbody>
        </table>
    </div>`;
    const tableDiv = document.getElementById('allMembersTable');
    if (tableDiv) tableDiv.innerHTML = html;
}

// -------------------- دوال التنقل --------------------
function backToLogin() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('loginScreen').classList.remove('hidden');
}

function backToMemberList() {
    showMemberList();
}
