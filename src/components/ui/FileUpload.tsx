"use client";

import { useState } from "react";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
}

export default function FileUpload({ onFilesChange }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setSelectedFiles(files);
    onFilesChange(files);
  };

  return (
    <div className="border border-gray-300 rounded p-4">
      <label className="block text-gray-700 mb-2 font-medium">
        Attach Files
      </label>
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        className="block w-full text-gray-700"
      />

      {selectedFiles.length > 0 && (
        <ul className="mt-2 text-sm text-gray-600">
          {selectedFiles.map((file, index) => (
            <li key={index}>{file.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
