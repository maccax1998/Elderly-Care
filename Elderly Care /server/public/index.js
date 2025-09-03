const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

// ===== Config =====
const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "",
  database: "eldercare",
  waitForConnections: true,
  connectionLimit: 5,
};
const JWT_SECRET = "change_this_in_env"; // งานจริงแนะนำ .env
const PORT = 4000;

app.use(cors());
app.use(express.json());

// เสิร์ฟไฟล์เว็บจากโฟลเดอร์ /public
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// หน้าแรก -> ส่ง login.html จาก /public
app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

// ===== DB Pool =====
const db = mysql.createPool(DB_CONFIG);

// ===== API =====
app.get("/api/healthcheck", async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT 1+1 AS ok");
    res.json({ ok: true, db: rows[0].ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "ต้องกรอกอีเมลและรหัสผ่าน" });

    const [dup] = await db.query("SELECT id FROM users WHERE email=?", [email]);
    if (dup.length) return res.status(409).json({ error: "อีเมลนี้ถูกใช้แล้ว" });

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password_hash) VALUES (?,?,?)",
      [name || null, email, hash]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "ต้องกรอกอีเมลและรหัสผ่าน" });

    const [rows] = await db.query("SELECT * FROM users WHERE email=?", [email]);
    if (!rows.length) return res.status(401).json({ error: "ไม่พบผู้ใช้" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: "ไม่มี token" });
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query(
      "SELECT id, name, email, role FROM users WHERE id=?",
      [payload.id]
    );
    if (!rows.length) return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    res.json({ user: rows[0] });
  } catch (e) {
    res.status(401).json({ error: "token ไม่ถูกต้องหรือหมดอายุ" });
  }
});

// ===== Start =====
app.listen(PORT, () => {
  console.log(`✅ Server: http://localhost:${PORT}`);
});
