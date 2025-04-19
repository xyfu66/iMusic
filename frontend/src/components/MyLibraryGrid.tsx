import React from 'react';

interface MyLibraryGridProps {
  myLibrary: Array<{
    id: string;
    filename: string;
    uploaded_at?: string;
    is_public?: boolean;
  }>;
  onSelect: (file_id: string) => void;
  onDelete: (file_id: string) => void; // 删除回调
}

const MyLibraryGrid: React.FC<MyLibraryGridProps> = ({ myLibrary, onSelect, onDelete }) => {
  if (myLibrary.length === 0) {
    return (
      <div className="flex justify-center items-center h-full text-gray-500">
        You haven't uploaded any tracks yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {myLibrary.map((file) => (
        <div
          key={file.id}
          className="border rounded-lg p-4 shadow hover:shadow-lg transition cursor-pointer"
          onClick={() => onSelect(file.id)}
        >
          <h3 className="font-bold text-lg truncate">{file.filename}</h3>
          {file.uploaded_at && (
            <p className="text-sm text-gray-500">Uploaded at: {new Date(file.uploaded_at).toLocaleString()}</p>
          )}
          <p className="text-sm text-gray-500">Status: {file.is_public ? 'Public' : 'Private'}</p>
          <button
            onClick={() => onDelete(file.id)}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

export default MyLibraryGrid;