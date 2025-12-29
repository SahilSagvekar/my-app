// app/api/upload/part-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const PRESIGNED_URL_EXPIRY = 86400;

export async function POST(request: NextRequest) {
  try {
    const { key, uploadId, partNumber } = await request.json();

    console.log(`🔑 Generating presigned URL for part ${partNumber}`, { key, uploadId });

    if (!key || !uploadId || !partNumber) {
      console.error("❌ Missing required fields:", { key, uploadId, partNumber });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const command = new UploadPartCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY, // 1 hour
    });

    console.log(`✅ Presigned URL generated for part ${partNumber}`);

    return NextResponse.json({ presignedUrl });
  } catch (error: any) {
    console.error('❌ Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL', message: error.message },
      { status: 500 }
    );
  }
}





// // app/api/upload/part-url/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// const s3Client = new S3Client({
//   region: process.env.AWS_S3_REGION!,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// });

// export async function POST(request: NextRequest) {
//   try {
//     const { key, uploadId, partNumber } = await request.json();

//     if (!key || !uploadId || !partNumber) {
//       return NextResponse.json(
//         { error: 'Missing required fields' },
//         { status: 400 }
//       );
//     }

//     const command = new UploadPartCommand({
//       Bucket: process.env.AWS_S3_BUCKET!,
//       Key: key,
//       UploadId: uploadId,
//       PartNumber: partNumber,
//     });

//     const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

//     return NextResponse.json({ presignedUrl });
//   } catch (error: any) {
//     console.error('Error generating part URL:', error);
//     return NextResponse.json(
//       { error: 'Failed to generate part URL', message: error.message },
//       { status: 500 }
//     );
//   }
// }