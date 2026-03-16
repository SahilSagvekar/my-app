
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import "dotenv/config";

async function diagnose() {
  console.log("🔍 Diagnosing R2 Connectivity...");
  
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_S3_REGION || "auto";

  console.log(`📡 Endpoint: ${endpoint}`);
  console.log(`🪣 Bucket: ${bucket}`);
  console.log(`🌍 Region: ${region}`);

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error("❌ Missing required environment variables in .env");
    process.exit(1);
  }

  const client = new S3Client({
    region: region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint: endpoint,
    forcePathStyle: true,
  });

  try {
    console.log("⏳ Sending ListObjectsV2Command...");
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 1,
    });
    
    const response = await client.send(command);
    console.log("✅ Success! Backend can connect to R2.");
    console.log(`📄 Found ${response.Contents ? response.Contents.length : 0} objects (max 1 checked).`);
    
    console.log("\n💡 CONSCLUSION: Backend connectivity is GOOD.");
    console.log("🚨 If uploads still fail with 503/Failed to fetch in the browser, it is a CORS issue.");
    console.log("👉 Go to Cloudflare R2 -> Your Bucket -> Settings -> CORS Policy.");
    console.log("👉 Add a policy that allows Origin: http://localhost:3000, Method: PUT, Headers: Content-Type, ETag.");
    
  } catch (err) {
    console.error("❌ Backend Connection Failed!");
    console.error("Error Code:", err.Code || err.name);
    console.error("Error Message:", err.message);
    
    if (err.message.includes("403")) {
      console.log("👉 Tip: Check if your Access Key ID and Secret Access Key are correct.");
    } else if (err.message.includes("ENOTFOUND") || err.message.includes("EHOSTUNREACH")) {
      console.log("👉 Tip: Check if your R2_ENDPOINT is correct.");
    }
  }
}

diagnose();
