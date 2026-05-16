import { useRef } from 'react';
import { Upload, X } from 'lucide-react';

interface Props {
  currentImage: string;
  onImageChange: (base64: string) => void;
  size?: number;
  label?: string;
}

export default function ImageUpload({ currentImage, onImageChange, size = 96, label = '上传图片' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImageChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative rounded-full border-2 border-dashed border-gray-300 overflow-hidden cursor-pointer hover:border-primary transition-colors flex items-center justify-center bg-gray-50"
        style={{ width: size, height: size }}
        onClick={() => inputRef.current?.click()}
      >
        {currentImage ? (
          <>
            <img src={currentImage} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </>
        ) : (
          <Upload className="w-8 h-8 text-gray-400" />
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="text-xs text-primary hover:underline"
      >
        {label}
      </button>
      {currentImage && (
        <button
          type="button"
          onClick={() => onImageChange('')}
          className="text-xs text-danger hover:underline flex items-center gap-1"
        >
          <X className="w-3 h-3" /> 移除
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} />
    </div>
  );
}
