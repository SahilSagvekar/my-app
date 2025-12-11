import crypto from 'crypto';

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function isOTPExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate;
}

export function getOTPExpiryTime(): Date {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
}