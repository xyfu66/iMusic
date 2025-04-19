import React from 'react';
import { useRecoilValue } from 'recoil';
import { userState } from '../state/userState';

interface LibraryGridProps {
  library: Array<{
    id: string;
    filename: string;
    user_id: string;
    username: string;
    uploaded_at?: string;
  }>;
  onSelect: (file_id: string) => void;
  onDelete: (file_id: string) => void;
}

const LibraryGrid: React.FC<LibraryGridProps> = ({ library, onSelect, onDelete }) => {
  const user = useRecoilValue(userState);

  if (library.length === 0) {
    return (
      <div className="flex justify-center items-center h-full text-gray-500">
        No tracks available. Please upload some files.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {library.map((file) => (
        <div
          key={file.id}
          className="border rounded-lg p-4 shadow hover:shadow-lg transition cursor-pointer"
          onClick={() => onSelect(file.id)}
        >
          <h3 className="font-bold text-lg truncate">{file.filename}</h3>
          <p className="text-sm text-gray-600">Uploaded by: {file.username}</p>
          {file.uploaded_at && (
            <p className="text-sm text-gray-500">Uploaded at: {new Date(file.uploaded_at).toLocaleString()}</p>
          )}
          <p className="text-sm text-gray-500">violin</p>
          {user.permissions.includes('delete_file') && (
            <button
              onClick={() => onDelete(file.id)}
              className="mt-2 bg-red-500 text-white px-4 py-2 rounded"
            >
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default LibraryGrid;