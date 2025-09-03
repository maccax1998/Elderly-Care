// ====== CONFIG ======
const API_BASE = location.origin + "/api";

// ====== DOM helpers ======
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v);
  }
  if (!Array.isArray(children)) children = [children];
  for (const c of children) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

// ====== Auth helpers ======
function getToken() { return localStorage.getItem("token"); }
function setToken(t) { t ? localStorage.setItem("token", t) : localStorage.removeItem("token"); }
// ใช้ในหน้า feature แต่ละหน้าเท่านั้น (กันไปชนหน้า login)
function requireAuth(){ if (!getToken()) window.location.href = "./login.html"; }

// ====== API helper ======
async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = "Bearer " + getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// ====== State (สำหรับ login/register) ======
let view = "login";                 // 'login' | 'register'
let lastRegisteredEmail = "";       // อีเมลที่สมัครล่าสุด
let showSuccessOnLogin = false;     // แสดง "เสร็จสิ้น" ทีหน้า login หนึ่งครั้ง
function goto(v){ view = v; render(); }

// ====== Password field with eye toggle (ใช้ได้ซ้ำ) ======
function makePwField(placeholderText){
  const input = h("input", { class:"input", type:"password", placeholder: placeholderText });
  const btn = h("button", {
    type:"button",
    class:"pw-toggle",
    style:{
      position:"absolute", right:"12px", top:"50%",
      transform:"translateY(-50%)", border:"none",
      background:"transparent", cursor:"pointer", fontSize:"14px"
    },
    "aria-label":"แสดง/ซ่อนรหัสผ่าน"
  }, "👁");

  btn.onclick = () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "🙈" : "👁";
  };

  const wrap = h("div", { class:"input-wrap", style:{ position:"relative" }}, [input, btn]);
  return { wrap, input };
}

// ====== Screens: Login / Register ======
function render(){
  const root = document.body;
  clear(root);

  if (!getToken()){
    if (view === "register") renderRegister(root);
    else renderLogin(root);
  } else {
    // มี token แล้ว ถ้ายังอยู่หน้านี้ก็ส่งไป home แทน (กันเผื่อ)
    window.location.href = "./home.html";
  }
}

function renderLogin(root){
  const msg = h("div", { id: "msg" });

  const email = h("input", { class: "input", id: "email", type: "email", placeholder: "Email" });
  const pass  = h("input", { class: "input", id: "password", type: "password", placeholder: "Password" });

  if (lastRegisteredEmail) email.value = lastRegisteredEmail;

  const btnLogin = h("button", { class: "btn btn-primary" }, "เข้าสู่ระบบ");
  btnLogin.onclick = async () => {
    await doLogin({ email: email.value.trim(), password: pass.value }, msg, btnLogin);
  };

  const showPwBox = h("label", { class: "checkbox" }, [
    h("input", { type: "checkbox", id: "toggle-pw" }),
    "แสดงรหัสผ่าน",
  ]);
  showPwBox.querySelector("input").addEventListener("change", (e)=> {
    pass.type = e.target.checked ? "text" : "password";
  });

  const forgot = h("a", { href:"#", class:"link" }, "ลืมรหัสผ่าน");

  const card = h("div", { class:"login-card" }, [
    h("div", { class:"brand" }, [
      h("img", { src:"./images/logo.png", alt:"Elder Care", onerror:"this.style.display='none'" }),
    ]),
    h("h1", { class:"title" }, "Elderly Care"),
    h("p", { class:"subtitle" }, "เว็บแอปพลิเคชันสำหรับดูแลผู้สูงอายุ"),

    email,
    pass,

    h("div", { class:"row-between" }, [ showPwBox, forgot ]),

    btnLogin,
    msg,

    h("div", { class:"footer" }, [
      "ยังไม่มีบัญชี? ",
      (() => {
        const a = h("a", { href:"#", class:"link" }, "สมัครสมาชิก");
        a.onclick = (e)=>{ e.preventDefault(); goto("register"); };
        return a;
      })()
    ]),
  ]);

  const page = h("div", { class:"page" }, card);
  root.appendChild(page);

  if (showSuccessOnLogin){
    msg.style.color = "green";
    msg.textContent = "เสร็จสิ้น — กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่สมัครไว้";
    showSuccessOnLogin = false;
  } else {
    msg.textContent = "";
  }

  [email, pass].forEach(el => el.addEventListener("keydown", e=>{
    if (e.key === "Enter") btnLogin.click();
  }));
}

function renderRegister(root){
  const msg = h("div", { id:"msg" });

  const name  = h("input", { class:"input", type:"text",  placeholder:"ชื่อ (ไม่บังคับ)" });
  const email = h("input", { class:"input", type:"email", placeholder:"Email" });

  // ใช้ช่องรหัสแบบมีปุ่ม 👁
  const pw1 = makePwField("Password (อย่างน้อย 6 ตัว)");
  const pw2 = makePwField("ยืนยันรหัสผ่าน");
  const pass  = pw1.input;
  const pass2 = pw2.input;

  const btnRegister = h("button", { class:"btn btn-primary" }, "สมัครสมาชิก");
  btnRegister.onclick = async ()=>{
    msg.style.color = "#c62828"; msg.textContent = "";

    const emailVal = email.value.trim();
    const passVal  = pass.value;
    const pass2Val = pass2.value;

    if (!emailVal) return msg.textContent = "กรุณากรอกอีเมล";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) return msg.textContent = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!passVal || passVal.length < 6) return msg.textContent = "รหัสผ่านต้องยาวอย่างน้อย 6 ตัว";
    if (passVal !== pass2Val) return msg.textContent = "รหัสผ่านไม่ตรงกัน";

    const old = btnRegister.textContent;
    btnRegister.disabled = true; btnRegister.textContent = "กำลังสมัคร...";
    try{
      await api("/register", { method:"POST", body:{ name: name.value.trim() || null, email: emailVal, password: passVal } });
      lastRegisteredEmail = emailVal;
      showSuccessOnLogin = true;
      goto("login");
    }catch(e){
      msg.textContent = e.message || "สมัครสมาชิกไม่สำเร็จ";
    }finally{
      btnRegister.disabled = false; btnRegister.textContent = old;
    }
  };

  const backToLogin = h("a", { href:"#", class:"link" }, "กลับไปหน้าเข้าสู่ระบบ");
  backToLogin.onclick = (e)=>{ e.preventDefault(); goto("login"); };

  const card = h("div", { class:"login-card" }, [
    h("div", { class:"brand" }, [
      h("img", { src:"./images/logo.png", alt:"Elder Care", onerror:"this.style.display='none'" }),
    ]),
    h("h1", { class:"title" }, "สมัครสมาชิก"),
    h("p", { class:"subtitle" }, "กรอกรายละเอียดของคุณเพื่อเริ่มต้นใช้งาน"),

    name, email, 
    pw1.wrap, pw2.wrap,

    btnRegister,
    msg,

    h("div", { class:"footer" }, [ backToLogin ]),
  ]);

  const page = h("div", { class:"page" }, card);
  root.appendChild(page);

  [name,email,pass,pass2].forEach(el => el.addEventListener("keydown", e=>{
    if (e.key === "Enter") btnRegister.click();
  }));
}

// ====== เข้าสู่ระบบ → ไปหน้า Home ======
async function doLogin({ email, password }, msgEl, btn) {
  msgEl.style.color = "crimson";
  msgEl.textContent = "";
  if (!email) return msgEl.textContent = "กรุณากรอกอีเมล";
  if (!password) return msgEl.textContent = "กรุณากรอกรหัสผ่าน";

  const oldText = btn.textContent;
  btn.disabled = true; btn.textContent = "กำลังเข้าสู่ระบบ...";
  try {
    const data = await api("/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    window.location.href = "./home.html";
    return;
  } catch (e) {
    msgEl.textContent = e.message || "เข้าสู่ระบบไม่สำเร็จ";
  } finally {
    btn.disabled = false; btn.textContent = oldText;
  }
}

/* ----------------- เปลี่ยนตรงนี้ -----------------
   เรียก render() เฉพาะหน้า login/register เท่านั้น
--------------------------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  const page = location.pathname.split("/").pop().toLowerCase();
  const isAuthPage = page === "login.html" || page === "register.html" || page === "";
  if (isAuthPage) render();
});

// ---------------------------------------------------------
// ========== ส่วน Feature ทั้ง 4 ==========
// ---------------------------------------------------------

// utils เสริมสำหรับหน้า features
function fmtDateTimeLocal(dtStr){
  const d = dtStr ? new Date(dtStr) : new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// ใช้ชื่อ el() เพื่อไม่ชนกับ h()
function el(tag, attrs={}, children=[]){
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) (k==="class") ? e.className=v : e.setAttribute(k,v);
  if (!Array.isArray(children)) children=[children];
  children.forEach(c=>e.append(c instanceof Node ? c : document.createTextNode(c)));
  return e;
}
function load(key, def){ try{ return JSON.parse(localStorage.getItem(key)) ?? def; }catch{ return def; } }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

// ====== 1) ตารางนัดหมาย ======
function scheduleInit(){
  requireAuth();
  const listKey = "ec_schedule";
  const form  = document.getElementById("schedule-form");
  const tbody = document.getElementById("schedule-tbody");
  const items = load(listKey, []);

  function renderRows(){
    tbody.innerHTML = "";
    if(!items.length){
      tbody.append(el("tr",{}, el("td",{colspan:5,class:"empty"},"ยังไม่มีนัดหมาย")));
      return;
    }
    // แสดงตามเวลา
    items.sort((a,b)=> new Date(a.when) - new Date(b.when));

    items.forEach((it,idx)=>{
      const tr = el("tr",{},[
        el("td",{}, it.title),
        el("td",{}, new Date(it.when).toLocaleString()),
        el("td",{}, it.place || "-"),
        el("td",{}, it.note || "-"),
        el("td",{}, [
          el("button",{type:"button",class:"btn btn-secondary", "data-act":"edit", "data-i":idx}, "แก้ไข"),
          " ",
          el("button",{type:"button",class:"btn btn-danger",   "data-act":"del",  "data-i":idx}, "ลบ")
        ])
      ]);
      tbody.append(tr);
    });
  }

  // ใช้ event delegation เพื่อให้คลิกได้เสมอ
  tbody.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-act]");
    if(!btn) return;
    const i = Number(btn.dataset.i);
    if(btn.dataset.act === "del"){
      items.splice(i,1);
      save(listKey, items);
      renderRows();
    }else if(btn.dataset.act === "edit"){
      const it = items[i];
      form.title.value = it.title || "";
      form.when.value  = fmtDateTimeLocal(it.when);
      form.place.value = it.place || "";
      form.note.value  = it.note  || "";
      form.index.value = i;
      form.title.focus();
    }
  });

  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const it = {
      title: form.title.value.trim(),
      when:  new Date(form.when.value).toISOString(),
      place: form.place.value.trim(),
      note:  form.note.value.trim(),
    };
    if(!it.title) return alert("กรุณากรอกหัวข้อ");
    const idx = form.index.value;
    if(idx === "") items.push(it); else items[idx]=it;
    save(listKey, items);
    form.reset(); form.when.value = fmtDateTimeLocal(); form.index.value="";
    renderRows();
  });

  form.when.value = fmtDateTimeLocal();
  renderRows();
}

// ====== 2) การใช้ยา ======
function medsInit(){
  requireAuth();
  const key   = "ec_meds";
  const form  = document.getElementById("meds-form");
  const tbody = document.getElementById("meds-tbody");
  const items = load(key, []);

  function renderRows(){
    tbody.innerHTML = "";
    if(!items.length){
      tbody.append(el("tr",{}, el("td",{colspan:6,class:"empty"},"ยังไม่มียา")));
      return;
    }
    items.forEach((it,idx)=>{
      const tr = el("tr",{},[
        el("td",{}, it.name),
        el("td",{}, `${it.dose} ${it.unit}`.trim()),
        el("td",{}, it.freq),
        el("td",{}, (it.times && it.times.length) ? it.times.join(", ") : "-"),
        el("td",{}, it.note || "-"),
        el("td",{}, [
          el("button",{type:"button",class:"btn btn-secondary","data-act":"edit","data-i":idx},"แก้ไข"),
          " ",
          el("button",{type:"button",class:"btn btn-danger","data-act":"del","data-i":idx},"ลบ")
        ])
      ]);
      tbody.append(tr);
    });
  }

  tbody.addEventListener("click",(e)=>{
    const btn = e.target.closest("button[data-act]");
    if(!btn) return;
    const i = Number(btn.dataset.i);
    if(btn.dataset.act === "del"){
      items.splice(i,1); save(key, items); renderRows();
    }else if(btn.dataset.act === "edit"){
      const it = items[i];
      form.name.value  = it.name || "";
      form.dose.value  = it.dose || "";
      form.unit.value  = it.unit || "เม็ด";
      form.freq.value  = it.freq || "วันละ 1 ครั้ง";
      form.times.value = (it.times||[]).join(",");
      form.note.value  = it.note || "";
      form.index.value = i;
      form.name.focus();
    }
  });

  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    const it = {
      name: form.name.value.trim(),
      dose: form.dose.value,
      unit: form.unit.value,
      freq: form.freq.value,
      times: form.times.value.split(",").map(s=>s.trim()).filter(Boolean),
      note: form.note.value.trim(),
    };
    if(!it.name) return alert("กรุณากรอกชื่อยา");
    const idx = form.index.value;
    if(idx==="") items.push(it); else items[idx]=it;
    save(key, items); form.reset(); form.index.value=""; renderRows();
  });

  renderRows();
}

// ====== 3) บันทึกสุขภาพ ======
function healthInit(){
  requireAuth();
  const key   = "ec_health";
  const form  = document.getElementById("health-form");
  const tbody = document.getElementById("health-tbody");
  const items = load(key, []);

  function renderRows(){
    tbody.innerHTML = "";
    if(!items.length){
      tbody.append(el("tr",{}, el("td",{colspan:7,class:"empty"},"ยังไม่มีบันทึก")));
      return;
    }
    items.sort((a,b)=> new Date(b.dt) - new Date(a.dt));
    items.forEach((it,idx)=>{
      const tr = el("tr",{},[
        el("td",{}, new Date(it.dt).toLocaleString()),
        el("td",{}, it.bp || "-"),
        el("td",{}, it.hr || "-"),
        el("td",{}, it.weight || "-"),
        el("td",{}, it.temp || "-"),
        el("td",{}, it.mood || "-"),
        el("td",{}, [
          el("button",{type:"button",class:"btn btn-danger","data-act":"del","data-i":idx},"ลบ")
        ])
      ]);
      tbody.append(tr);
    });
  }

  tbody.addEventListener("click",(e)=>{
    const btn = e.target.closest("button[data-act='del']");
    if(!btn) return;
    const i = Number(btn.dataset.i);
    items.splice(i,1); save(key, items); renderRows();
  });

  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    const it = {
      dt: new Date(form.dt.value || new Date()).toISOString(),
      bp: form.bp.value.trim(),
      hr: form.hr.value.trim(),
      weight: form.weight.value.trim(),
      temp: form.temp.value.trim(),
      mood: form.mood.value,
      note: form.note.value.trim(),
    };
    items.push(it); save(key, items); form.reset(); form.dt.value = fmtDateTimeLocal(); renderRows();
  });

  form.dt.value = fmtDateTimeLocal();
  renderRows();
}


// ====== 4) การแจ้งเตือน (แก้ใหม่) ======
function alertsInit(){
  requireAuth();
  const key   = "ec_alerts";
  const form  = document.getElementById("alerts-form");
  const tbody = document.getElementById("alerts-tbody");
  const items = load(key, []);

  function renderRows(){
    tbody.innerHTML = "";
    if (!items.length){
      tbody.append(el("tr",{}, el("td",{colspan:5,class:"empty"},"ยังไม่มีรายการแจ้งเตือน")));
      return;
    }
    items.sort((a,b)=> new Date(a.when) - new Date(b.when));
    items.forEach((it,idx)=>{
      const tr = el("tr",{},[
        el("td",{}, it.type),
        el("td",{}, it.title),
        el("td",{}, new Date(it.when).toLocaleString()),
        el("td",{}, it.note || "-"),
        el("td",{}, [
          el("button",{type:"button",class:"btn btn-secondary","data-act":"edit","data-i":idx},"แก้ไข"),
          " ",
          el("button",{type:"button",class:"btn btn-danger","data-act":"del","data-i":idx},"ลบ")
        ])
      ]);
      tbody.append(tr);
    });
  }

  // ใช้ event delegation ให้ปุ่มทำงานหลัง re-render ทุกครั้ง
  tbody.addEventListener("click",(e)=>{
    const btn = e.target.closest("button[data-act]");
    if(!btn) return;
    const i = Number(btn.dataset.i);
    if (btn.dataset.act === "del"){
      items.splice(i,1);
      save(key, items);
      renderRows();
    } else if (btn.dataset.act === "edit"){
      const it = items[i];
      form.type.value  = it.type;
      form.title.value = it.title;
      form.when.value  = fmtDateTimeLocal(it.when);
      form.note.value  = it.note || "";
      // เก็บ index ไว้แก้ไข
      if (!form.index){
        const h = document.createElement("input");
        h.type = "hidden"; h.name = "index";
        form.appendChild(h);
      }
      form.index.value = i;
      form.title.focus();
    }
  });

  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    const it = {
      type:  form.type.value,
      title: form.title.value.trim(),
      when:  new Date(form.when.value).toISOString(),
      note:  form.note.value.trim(),
    };
    if (!it.title) return alert("กรุณากรอกหัวข้อ");

    const idx = form.index && form.index.value !== "" ? Number(form.index.value) : -1;
    if (idx >= 0) items[idx] = it; else items.push(it);

    save(key, items);
    form.reset();
    form.when.value = fmtDateTimeLocal();  // ใส่ค่าเริ่มต้นใหม่
    if (form.index) form.index.value = "";
    renderRows();
  });

  // ค่าเริ่มต้นช่องเวลา และ render ครั้งแรก
  form.when.value = fmtDateTimeLocal();
  renderRows();

  // แสดงคำแนะนำเปิด Notifications ของเบราว์เซอร์
  const tip = document.getElementById("notif-tip");
  if ("Notification" in window){
    tip.innerHTML = (Notification.permission === "granted")
      ? "สถานะ: อนุญาตการแจ้งเตือนแล้ว ✅"
      : `สถานะ: ยังไม่ได้อนุญาต ❌ 
         <a class="link" href="#" id="askPerm">กดเพื่อขอสิทธิ</a>`;
    const ask = document.getElementById("askPerm");
    if (ask) ask.onclick = async (ev)=>{
      ev.preventDefault();
      const p = await Notification.requestPermission();
      alert("ผลการขอสิทธิ: " + p);
      // refresh ข้อความสถานะ
      alertsInit();
    };
  } else {
    tip && (tip.textContent = "เบราว์เซอร์นี้ไม่รองรับ Web Notifications");
  }
}

/* ให้เรียกจาก <script> ในหน้า HTML ได้ */
window.scheduleInit = scheduleInit;
window.medsInit     = medsInit;
window.healthInit   = healthInit;
window.alertsInit   = alertsInit;