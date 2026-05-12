const allNames = ["ماري","بيتر","جورج","مايكل","أندرو","مارك","جون","بول","توماس","فيليب","برثولماوس","متى","سمعان","يعقوب","يوحنا","اندرواس","فيلبس","توما","متى","admin1","admin2","admin3"];

let admins = [
    { username: "admin1", password: "admin123" },
    { username: "admin2", password: "admin123" },
    { username: "admin3", password: "admin123" }
];

const savedAdmins = localStorage.getItem('customAdmins');
if(savedAdmins) {
    const parsed = JSON.parse(savedAdmins);
    if(parsed.find(a=>a.username==='admin1')) admins = parsed;
}

const MONTHS_COUNT = 12;
let currentMember = null, currentMonth = 0, currentFilter = 'monthly';
let attendanceCache = [];
let dataLoaded = false;

// ---------- تحميل البيانات مرة واحدة ----------
async function loadDataOnce() {
    if(dataLoaded) return { attendance: attendanceCache };
    try {
        const res = await fetch(window.SCRIPT_URL);
        const json = await res.json();
        if(json.attendance) attendanceCache = json.attendance;
        dataLoaded = true;
        return json;
    } catch(e) { console.error(e); return { attendance: [] }; }
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

window.updateOfficialTime = function() {
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

// ---------- دوال البيانات ----------
function getMemberRecords(name, month, filter='monthly') {
    let records = attendanceCache.filter(r => r[0]===name && r[1]==month+1);
    if(filter==='weekly'){
        const today = new Date();
        const daysToLastSat = (today.getDay() + 1) % 7;
        const lastSaturday = new Date(today);
        lastSaturday.setDate(today.getDate() - daysToLastSat);
        const saturdayStr = lastSaturday.toISOString().slice(0,10);
        records = records.filter(r => r[2] === saturdayStr);
    }
    return records;
}

function calcStats(name, month, filter='monthly') {
    const recs = getMemberRecords(name, month, filter);
    let present=0, late=0, excused=0, absent=0, travel=0;
    let lateMins=0;
    recs.forEach(r=>{
        const st = r[3];
        if(st==='present') present++;
        else if(st==='late') { late++; lateMins += parseInt(r[5])||0; }
        else if(st==='excused') excused++;
        else if(st==='absent') absent++;
        else if(st==='travel') travel++;
    });
    const total = recs.length;
    const totalPresent = present + late;
    return {
        presentRate: total ? Math.round(totalPresent/total*100) : 0,
        excusedRate: total ? Math.round(excused/total*100) : 0,
        absentRate: total ? Math.round(absent/total*100) : 0,
        travelRate: total ? Math.round(travel/total*100) : 0,
        total, lateCount: late, avgLate: late ? Math.round(lateMins/late) : 0
    };
}

async function saveAttendance(record) {
    try {
        await fetch(window.SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(record) });
        attendanceCache.push(record);
    } catch(e) { console.error(e); }
}

// ---------- تسجيل الحضور ----------
window.recordStatus = async function(status) {
    if(!currentMember) {
        alert("لا يوجد عضو محدد");
        return;
    }
    const now = new Date();
    let lateMinutes = 0;
    let actualTime = now.toLocaleTimeString('ar-EG');
    
    if(status === 'late') {
        lateMinutes = calculateLateMinutes();
    }
    
    const record = [
        currentMember, currentMonth+1,
        now.toISOString().slice(0,10),
        status,
        actualTime,
        lateMinutes,
        ''
    ];
    await saveAttendance(record);
    updateMemberView();
    if(!document.getElementById('adminDashboard').classList.contains('hidden')) updateAdminView();
    alert(`✅ تم تسجيل ${status === 'present' ? 'الحضور' : status === 'late' ? 'التأخير' : status === 'absent' ? 'الغياب بدون عذر' : status === 'excused' ? 'الغياب بعذر' : 'السفر'} بنجاح`);
}

window.recordLateAuto = async function() {
    await window.recordStatus('late');
}

// ---------- واجهة العضو ----------
function showMemberList() {
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    document.getElementById('memberScreen').classList.remove('hidden');
    const container = document.getElementById('memberList');
    container.innerHTML = '';
    allNames.slice(0,19).forEach(name=>{
        const div = document.createElement('div');
        div.className = 'member-card';
        div.textContent = name;
        div.onclick = ()=>openMemberDashboard(name);
        container.appendChild(div);
    });
}

function openMemberDashboard(name) {
    currentMember = name; currentMonth=0;
    const isAdmin = name.includes('أدمن');
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    document.getElementById('memberDashboard').classList.remove('hidden');
    document.getElementById('memberName').innerText = name;
    renderTabs('memberMonthsTabs', true);
    const btnsDiv = document.getElementById('attendanceButtons');
    if(btnsDiv) btnsDiv.style.display = isAdmin ? 'grid' : 'none';
    updateMemberView();
}

async function updateMemberView() {
    await loadDataOnce();
    const stats = calcStats(currentMember, currentMonth);
    const records = getMemberRecords(currentMember, currentMonth);
    const last = records[records.length-1];
    const statusDiv = document.getElementById('currentStatus');
    if(last){
        let lateInfo = last[3]==='late' ? `<br>⏱️ تأخر ${last[5]} دقيقة` : '';
        let statusText = {
            'present':'✅ حاضر', 'late':'⏰ متأخر', 
            'absent':'❌ غائب بدون عذر', 'excused':'📝 غائب بعذر',
            'travel':'✈️ مسافر'
        }[last[3]];
        statusDiv.innerHTML = `<strong>آخر تسجيل:</strong><br>${statusText}${lateInfo}<br><small>${last[2]} - ${last[4]}</small>`;
    } else statusDiv.innerHTML = 'لا توجد تسجيلات هذا الشهر';
    document.getElementById('personalStats').innerHTML = `
        <p>✅ نسبة الحضور (حاضر+متأخر): ${stats.presentRate}%</p>
        <p>📝 غياب بعذر: ${stats.excusedRate}%</p>
        <p>❌ غياب بدون عذر: ${stats.absentRate}%</p>
        <p>✈️ مسافر: ${stats.travelRate}%</p>
        <p>📊 إجمالي التسجيلات: ${stats.total}</p>
        ${stats.lateCount? `<p>⏰ عدد مرات التأخير: ${stats.lateCount} (متوسط ${stats.avgLate} دقيقة)</p>`:''}
    `;
}

function renderTabs(containerId, isMember=true){
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML='';
    for(let i=0;i<MONTHS_COUNT;i++){
        const btn = document.createElement('button');
        btn.className = `month-tab ${i===currentMonth?'active':''}`;
        btn.innerText = `شهر ${i+1}`;
        btn.onclick = ()=>{
            document.querySelectorAll(`#${containerId} .month-tab`).forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            currentMonth = i;
            if(isMember) updateMemberView();
            else updateAdminView();
        };
        container.appendChild(btn);
    }
}

// ---------- الأدمن ----------
function showAdminLogin() {
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    document.getElementById('adminLoginScreen').classList.remove('hidden');
}

window.verifyAdmin = function() {
    const user = document.getElementById('adminUsername').value;
    const pass = document.getElementById('adminPassword').value;
    const found = admins.find(a=>a.username===user && a.password===pass);
    if(found){
        showAdminDashboard();
    } else alert('بيانات دخول خاطئة');
}

async function showAdminDashboard(){
    await loadDataOnce();
    currentMember = null;
    currentMonth=0; currentFilter='monthly';
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('currentOfficialTime').innerText = getOfficialTime();
    document.getElementById('newOfficialTime').value = getOfficialTime();
    renderTabs('adminMonthsTabs', false);
    document.getElementById('filterMonthly').classList.add('active');
    document.getElementById('filterWeekly').classList.remove('active');
    updateAdminView();
}

window.editMemberFromAdmin = function(memberName) {
    openMemberDashboard(memberName);
}

async function updateAdminView(){
    const stats = [];
    for(let name of allNames){
        stats.push(calcStats(name, currentMonth, currentFilter));
    }
    const bestIdx = stats.reduce((iMax, x, i, arr)=> x.presentRate > arr[iMax].presentRate ? i : iMax, 0);
    const worstIdx = stats.reduce((iMax, x, i, arr)=> x.absentRate > arr[iMax].absentRate ? i : iMax, 0);
    const lateIdx = stats.reduce((iMax, x, i, arr)=> x.lateCount > arr[iMax].lateCount ? i : iMax, 0);
    
    document.getElementById('adminStats').innerHTML = `
        <div style="background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:20px;border-radius:24px;margin:16px 0">
            <h3>📊 إحصائيات ${currentFilter==='monthly'?`شهر ${currentMonth+1}`:'آخر سبت'}</h3>
            <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between">
                <div>🏆 أعلى حضور: <strong>${allNames[bestIdx]}</strong> (${stats[bestIdx].presentRate}%)</div>
                <div>⚠️ أعلى غياب بدون عذر: <strong>${allNames[worstIdx]}</strong> (${stats[worstIdx].absentRate}%)</div>
                <div>⏰ أكثر تأخير: <strong>${allNames[lateIdx]}</strong> (${stats[lateIdx].lateCount} مرات)</div>
            </div>
        </div>
    `;
    let html = `<div style="overflow-x:auto"><table><thead><th>العضو</th><th>حضور</th><th>غياب بعذر</th><th>غياب بدون عذر</th><th>مسافر</th><th>عدد التأخير</th><th>متوسط التأخير</th><th>إجمالي</th><th>تعديل</th></thead><tbody>`;
    allNames.forEach((name,i)=>{
        html += `<tr>
            <td style="font-weight:bold">${name}</td>
            <td style="color:#16a34a">${stats[i].presentRate}%</td>
            <td style="color:#3b82f6">${stats[i].excusedRate}%</td>
            <td style="color:#dc2626">${stats[i].absentRate}%</td>
            <td style="color:#805ad5">${stats[i].travelRate}%</td>
            <td>${stats[i].lateCount}</td>
            <td>${stats[i].avgLate}</td>
            <td>${stats[i].total}</td>
            <td><button class="btn-edit" onclick="editMemberFromAdmin('${name.replace(/'/g, "\\'")}')">✏️ تعديل</button></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    document.getElementById('allMembersTable').innerHTML = html;
}

// ---------- فلتر شهري/أسبوعي ----------
document.addEventListener('click', (e)=>{
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
            <p style="font-size:14px">متاح فقط لـ <strong>admin1</strong></p>
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

window.changeAdminPasswordTemp = function() {
    const current = document.getElementById('currentPass').value;
    const newPass = document.getElementById('newPass').value;
    const confirm = document.getElementById('confirmNewPass').value;
    const admin1 = admins.find(a=>a.username==='admin1');
    if(!admin1 || admin1.password !== current) return alert('⚠️ كلمة المرور الحالية غير صحيحة');
    if(newPass !== confirm) return alert('⚠️ كلمة المرور الجديدة غير متطابقة');
    admin1.password = newPass;
    localStorage.setItem('customAdmins', JSON.stringify(admins));
    alert('✅ تم تغيير كلمة المرور بنجاح');
    closeTempDialog();
}

// ---------- PDF ----------
function downloadPDF() {
    const element = document.getElementById('pdf-content');
    if(element && typeof html2pdf !== 'undefined') {
        html2pdf().set({
            margin: 10,
            filename: `تقرير_${currentFilter==='monthly'?`شهر_${currentMonth+1}`:'اسبوعي'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        }).from(element).save();
    } else {
        alert('مكتبة PDF لم يتم تحميلها بعد، حاول مرة أخرى');
    }
}

// ---------- دوال الرجوع ----------
function backToLogin() {
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    document.getElementById('loginScreen').classList.remove('hidden');
}
function backToMemberList() { showMemberList(); }

// تحميل البيانات أول ما الموقع يفتح
loadDataOnce();
