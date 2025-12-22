// lib/bigint-fix.ts
// @ts-expect-error - Adding toJSON to BigInt prototype for JSON serialization
BigInt.prototype.toJSON = function () {
  return Number(this);
};

export {};