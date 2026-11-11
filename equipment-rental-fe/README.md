# Equipment Rental — Frontend (React / Create React App)

หน้าเว็บที่คุยกับ BE (Go): ดูอุปกรณ์/ค้นหา/กรองหมวดหมู่ · สมัคร/login · ขอยืม · Profile + ประวัติ + เปลี่ยนรหัสผ่าน · Admin (Dashboard, CRUD อุปกรณ์ + อัปโหลดรูป, อนุมัติ/ปฏิเสธ/รับคืน)

```bash
cp .env.example .env     # แก้ REACT_APP_API_URL = URL ของ BE
npm install
npm start                # เปิดที่พอร์ต 5173
```

- Build: `npm run build` (ผลลัพธ์อยู่ใน `build/`)
- **Vercel:** Framework Preset = Create React App · ตั้ง env `REACT_APP_API_URL` = URL ของ Render (ไม่มี `/` ท้าย) แล้ว Deploy
  (ตัวแปรถูกฝังตอน build แก้แล้วต้อง Redeploy) จากนั้นนำ URL ของ Vercel ไปใส่ `ALLOWED_ORIGINS` ของ BE
- โค้ดทั้งหมดอยู่ใน `src/App.jsx` · สีและสไตล์อยู่ใน `src/style.css`
