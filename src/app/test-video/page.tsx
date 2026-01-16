// app/test-video/page.tsx
'use client';

export default function TestVideo() {
  const testUrl = "https://e8-app-s3-prod.s3.us-east-1.amazonaws.com/Soda%20City%20Simpson/outputs/SodaCitySimpson_01-12-2026_LF1/1768223875098-Ep%2314%20Draft%202%20Revised%20Output%204k%20Resolution.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAQUFLQPQRZULI4RHZ%2F20260115%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260115T024530Z&X-Amz-Expires=7200&X-Amz-Signature=9deca7c2ee0a5e7c51075bdfe30c973a9309f19f22ce3e4d5ca135bf941cf9b1&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject";
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Video Test</h1>
      <video controls width="800" style={{ maxWidth: '100%' }}>
        <source src={testUrl} type="video/mp4" />
      </video>
    </div>
  );
}

  const testUrl = "https://e8-app-s3-prod.s3.us-east-1.amazonaws.com/Soda%20City%20Simpson/outputs/SodaCitySimpson_01-12-2026_LF1/1768223875098-Ep%2314%20Draft%202%20Revised%20Output%204k%20Resolution.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAQUFLQPQRZULI4RHZ%2F20260115%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260115T024530Z&X-Amz-Expires=7200&X-Amz-Signature=9deca7c2ee0a5e7c51075bdfe30c973a9309f19f22ce3e4d5ca135bf941cf9b1&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject";


