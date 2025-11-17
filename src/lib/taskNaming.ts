// /src/lib/taskNaming.ts

type BuildTaskTitleParams = {
  clientName: string;        // e.g. "E8 Productions"
  createdAt?: Date;          // defaults to now
  deliverableType: string;   // e.g. "Short Form Videos"
  index: number;             // 1-based: 1,2,3...
};

function toPascalNoSpaces(str: string): string {
  return str
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, " ")       // remove weird chars
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
    )
    .join("");
}

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildTaskTitle({
  clientName,
  createdAt,
  deliverableType,
  index,
}: BuildTaskTitleParams): string {
  const date = createdAt ?? new Date();

  const clientPart = toPascalNoSpaces(clientName);       // "E8Productions"
  const datePart = formatDateYYYYMMDD(date);             // "2025-11-19"
  const typePart = toPascalNoSpaces(deliverableType);    // "ShortFormVideos"
  const numPart = `#${index}`;                           // "#1"

  // Final: ClientNameCreatedDateDeliverableTypeDeliverableNumber
  // I’m adding underscores only between sections for readability
  return `${clientPart}_${datePart}_${typePart}_${numPart}`;
}
