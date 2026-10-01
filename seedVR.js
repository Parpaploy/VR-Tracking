import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seedVR() {
  const batch = db.batch();
  const vrCollection = db.collection("gas");

  for (let i = 1; i <= 100; i++) {
    const gasId = `VR-${String(i).padStart(3, "0")}`;
    const docRef = vrCollection.doc(gasId);

    batch.set(docRef, {
      locationId: "WAREHOUSE-001",
      locationType: "warehouse",
      status: "good",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log("✅ เพิ่ม vr 100 เครื่องเรียบร้อยแล้ว");
  process.exit(0);
}

seedVR().catch(console.error);
