import { Search, X } from 'lucide-react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// 목록 화면 공용 검색 입력. 아이콘과 글자가 겹치지 않도록 좌우 여백을 직접 잡는다.
export function SearchBox({ value, onChange, placeholder = 'Search...', className = '' }: SearchBoxProps) {
  return (
    <div className={`relative max-w-sm ${className}`}>
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        className="input pl-9 pr-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          title="Clear"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
