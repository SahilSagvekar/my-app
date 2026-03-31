// FFmpeg Compression Utilities
import { spawn } from 'child_process';
import { COMPRESSION_CONFIG } from './config';

export interface CompressionProgress {
  percent: number;
  fps: number;
  speed: string;
  time: string;
}

export interface CompressionResult {
  success: boolean;
  inputSize: number;
  outputSize: number;
  compressionRatio: number;
  duration: number; // seconds
  error?: string;
}

/**
 * Get FFmpeg command arguments for fast compression
 */
export function getFfmpegArgs(inputPath: string, outputPath: string, mode: 'fast' | 'nuclear' = 'fast'): string[] {
  const settings = mode === 'nuclear' 
    ? COMPRESSION_CONFIG.ffmpeg.nuclear 
    : COMPRESSION_CONFIG.ffmpeg.fast;

  const args = [
    '-i', inputPath,
    '-vf', `scale=${settings.scale}`,
    '-c:v', 'libx264',
    '-preset', settings.preset,
    '-crf', settings.crf,
    '-threads', settings.threads,
  ];

  if ('noAudio' in settings && settings.noAudio) {
    args.push('-an');
  } else {
    args.push('-c:a', 'aac', '-b:a', '128k');
  }

  args.push(
    '-movflags', '+faststart',
    '-y', // Overwrite output
    outputPath
  );

  return args;
}

/**
 * Compress a video file using FFmpeg
 */
export async function compressVideo(
  inputPath: string,
  outputPath: string,
  onProgress?: (progress: CompressionProgress) => void,
  mode: 'fast' | 'nuclear' = 'fast'
): Promise<CompressionResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const args = getFfmpegArgs(inputPath, outputPath, mode);
    
    console.log(`[FFmpeg] Starting compression: ${inputPath}`);
    console.log(`[FFmpeg] Command: ffmpeg ${args.join(' ')}`);
    
    const ffmpeg = spawn('ffmpeg', args);
    
    let duration = 0;
    let lastProgress = 0;
    let stderr = '';

    ffmpeg.stderr.on('data', (data: Buffer) => {
      const str = data.toString();
      stderr += str;

      // Extract duration (only once)
      if (duration === 0) {
        const durMatch = str.match(/Duration: (\d+):(\d+):(\d+)/);
        if (durMatch) {
          duration = 
            parseInt(durMatch[1]) * 3600 + 
            parseInt(durMatch[2]) * 60 + 
            parseInt(durMatch[3]);
        }
      }

      // Extract progress
      const timeMatch = str.match(/time=(\d+):(\d+):(\d+)/);
      const fpsMatch = str.match(/fps=\s*(\d+)/);
      const speedMatch = str.match(/speed=\s*([\d.]+x)/);

      if (timeMatch && duration > 0) {
        const currentTime = 
          parseInt(timeMatch[1]) * 3600 + 
          parseInt(timeMatch[2]) * 60 + 
          parseInt(timeMatch[3]);
        
        const percent = Math.min(99, Math.round((currentTime / duration) * 100));
        
        // Only report if changed
        if (percent > lastProgress && onProgress) {
          lastProgress = percent;
          onProgress({
            percent,
            fps: fpsMatch ? parseInt(fpsMatch[1]) : 0,
            speed: speedMatch ? speedMatch[1] : '0x',
            time: `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
          });
        }
      }
    });

    ffmpeg.on('close', async (code) => {
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      
      if (code === 0) {
        // Get file sizes
        const fs = await import('fs/promises');
        let inputSize = 0;
        let outputSize = 0;
        
        try {
          const inputStats = await fs.stat(inputPath);
          const outputStats = await fs.stat(outputPath);
          inputSize = inputStats.size;
          outputSize = outputStats.size;
        } catch (e) {
          // Ignore stat errors
        }
        
        const compressionRatio = inputSize > 0 ? (1 - outputSize / inputSize) * 100 : 0;
        
        console.log(`[FFmpeg] Compression complete in ${elapsedSeconds.toFixed(1)}s`);
        console.log(`[FFmpeg] ${(inputSize / 1024 / 1024).toFixed(1)}MB → ${(outputSize / 1024 / 1024).toFixed(1)}MB (${compressionRatio.toFixed(1)}% reduction)`);
        
        resolve({
          success: true,
          inputSize,
          outputSize,
          compressionRatio,
          duration: elapsedSeconds,
        });
      } else {
        console.error(`[FFmpeg] Failed with code ${code}`);
        resolve({
          success: false,
          inputSize: 0,
          outputSize: 0,
          compressionRatio: 0,
          duration: elapsedSeconds,
          error: `FFmpeg exited with code ${code}`,
        });
      }
    });

    ffmpeg.on('error', (err) => {
      console.error('[FFmpeg] Process error:', err);
      resolve({
        success: false,
        inputSize: 0,
        outputSize: 0,
        compressionRatio: 0,
        duration: (Date.now() - startTime) / 1000,
        error: err.message,
      });
    });
  });
}

/**
 * Check if FFmpeg is available
 */
export async function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    
    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
    
    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get video info using FFprobe
 */
export async function getVideoInfo(filePath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
} | null> {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);
    
    let output = '';
    
    ffprobe.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      
      try {
        const info = JSON.parse(output);
        const videoStream = info.streams?.find((s: any) => s.codec_type === 'video');
        
        resolve({
          duration: parseFloat(info.format?.duration || '0'),
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          codec: videoStream?.codec_name || 'unknown',
          bitrate: parseInt(info.format?.bit_rate || '0'),
        });
      } catch (e) {
        resolve(null);
      }
    });
    
    ffprobe.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Estimate compression time based on file size and processor
 */
export function estimateCompressionTime(sizeBytes: number, processor: 'spot' | 'local'): number {
  const sizeGB = sizeBytes / 1024 / 1024 / 1024;
  
  // Rough estimates (in seconds)
  if (processor === 'spot') {
    return sizeGB * 120; // ~2 min per GB
  } else {
    return sizeGB * 360; // ~6 min per GB
  }
}