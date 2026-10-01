# VR Tracker

เว็บ static สำหรับยืม–คืนและติดตามอุปกรณ์ VR ใช้ Firebase Hosting, Firebase Authentication, Firestore และ Cloudinary โดยไม่มี Express API หรือ Firebase Functions

## การทำงาน

- ผู้ใช้สมัครด้วยอีเมลนักศึกษาและรหัสผ่าน Firebase Auth พร้อมส่งรหัสนักศึกษา เบอร์โทร และสำเนาบัตรประชาชน
- ผู้ใช้ยืมด้วยการสแกน QR และแนบ selfie; คืนอุปกรณ์ได้เฉพาะแอดมินที่สแกน QR
- Firestore Security Rules จำกัดสิทธิ์ของผู้ใช้และแอดมิน รวมทั้งบังคับการยืม/คืนให้เขียนเอกสารที่เกี่ยวข้องพร้อมกัน
- รูปอุปกรณ์ทั่วไปอัปโหลดตรงไป Cloudinary ด้วย unsigned preset
- สำเนาบัตรและ selfie เก็บเป็น JPEG data URL ใน Firestore แยกเอกสาร และ Rules อนุญาตให้แอดมินอ่านเท่านั้น

รูปเอกสารและ selfie จำกัดไม่เกิน 500 KB ต่อรูป เพื่อให้ไม่เกินขนาดเอกสาร Firestore 1 MiB รูปเหล่านี้นับรวมในโควตา Firestore ของโปรเจกต์

## ตั้งค่า

1. สร้าง `.env` จาก `.env.example` แล้วกรอก Firebase Web App config และ Cloudinary cloud name/unsigned upload preset
2. ใน Firebase Authentication เปิดผู้ให้บริการ **Email/Password**
3. สร้าง Firestore database และตั้ง initial admin ผ่าน Firebase Console: สร้าง Auth account ก่อน แล้วสร้าง `users/{Auth UID}` โดยมี `name`, `nickname`, `studentId`, `studentEmail`, `phone`, `role: "admin"`, `status: "active"` จากนั้นเพิ่มเอกสาร claim สำหรับรหัสนักศึกษา/อีเมล/เบอร์โทร และ `registrationDocuments/{Auth UID}` พร้อมสำเนาบัตร รูปเริ่มต้นใส่จากหน้าเว็บหลังตั้ง Rules แล้วได้
4. ใช้ Firebase project `vr-tracking-a8847` และตั้งค่า Cloudinary unsigned upload preset ให้รับเฉพาะภาพ พร้อมจำกัดชนิด/ขนาดใน preset เท่าที่ Cloudinary รองรับ

## พัฒนาและ deploy

```sh
npm install
npm run dev
npm run build
firebase deploy --only hosting,firestore:rules --project vr-tracking-a8847
```

Firebase Hosting ให้บริการไฟล์ static; Firestore Rules อยู่ใน `firestore.rules` เว็บต้อง deploy จาก `dist/public` หลัง build

## ข้อมูลบัญชี

บัญชีที่สร้างด้วยหน้า signup จะได้ role `user` เท่านั้น ส่วน admin ต้อง bootstrap ผ่าน Firebase Console หรือสร้างโดย admin ที่ล็อกอินอยู่ การระงับบัญชีทำผ่าน `status: "suspend"`; เว็บไม่มี Admin SDK จึงไม่สามารถลบบัญชีออกจาก Firebase Authentication แทนแอดมินได้

ข้อมูลอุปกรณ์เดิมยังอยู่ collection `gas` เพื่อรองรับข้อมูลเก่า และเก็บประวัติยืมใน `loans` รูปแนบตอนยืมเก็บแยกใน `loanPhotos`; สำเนาบัตรเก็บใน `registrationDocuments`
