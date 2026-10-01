const admin = require("firebase-admin");
const fs = require("fs");
const csv = require("csv-parser");

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
});

const db = admin.firestore();

const rows = [];

fs.createReadStream("customer.csv")
  .pipe(
    csv({
      mapHeaders: ({ header }) => header.replace(/^\uFEFF/, "").trim(),
      mapValues: ({ value }) => value.replace(/\u00A0/g, "").trim(),
    }),
  )
  .on("data", (row) => {
    rows.push(row);
  })
  .on("end", async () => {
    console.log("อ่านไฟล์เสร็จ:", rows.length, "แถว");

    for (const row of rows) {
      const name = (row.name || "").trim();

      if (!name) {
        console.log("⛔ ข้ามแถวว่าง:", row);
        continue;
      }

      await db.collection("stores").add({
        name,
        latitude: parseFloat(row.latitude) || 0,
        longitude: parseFloat(row.longitude) || 0,
      });
    }

    console.log("✅ Import เสร็จสมบูรณ์");
    process.exit(0);
  });
