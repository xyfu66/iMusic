import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import FileCard from './FileCard';
import { api } from '../services/api';

interface LibraryGridProps {
  onShowMore?: () => void;
}

const LibraryGrid = forwardRef<any, LibraryGridProps>(({ onShowMore }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const [library, setLibrary] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLibrary = async () => {
    try {
      setIsLoading(true);
      const data = await api.fetchLibrary();
      setLibrary(data);
    } catch (error) {
      console.error('Error fetching library:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    fetchLibrary
  }));

  useEffect(() => {
    fetchLibrary();
  }, []);

  useEffect(() => {
    const calculateVisibleCount = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const cardElement = containerRef.current.querySelector('.file-card');
        const cardWidth = cardElement ? cardElement.getBoundingClientRect().width : 200;
        const gap = 16;
        const count = Math.floor((containerWidth + gap) / (cardWidth + gap));
        setVisibleCount(Math.max(1, count));
      }
    };

    setTimeout(calculateVisibleCount, 100);
    window.addEventListener('resize', calculateVisibleCount);
    return () => window.removeEventListener('resize', calculateVisibleCount);
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (library.length === 0) {
    return (
      <div className="flex justify-center items-center h-48 text-gray-500">
        暂无乐谱，请上传文件。
      </div>
    );
  }

  const visibleLibrary = library.slice(0, visibleCount);

  return (
    <div className="flex-1 bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Library</h2>
          {library.length > visibleCount && onShowMore && (
            <button
              onClick={onShowMore}
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              显示更多
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        <div className="relative">
          <div className="overflow-hidden">
            <div ref={containerRef}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-min">
                {visibleLibrary.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    type="library"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

LibraryGrid.displayName = 'LibraryGrid';

export default LibraryGrid;