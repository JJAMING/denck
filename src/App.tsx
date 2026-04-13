import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Type, List, CalendarDays, CheckSquare, Plus, Trash2,
  Settings, Save, FileText, Download, Upload,
  Copy, Lock, Unlock, MousePointer2, Image as ImageIcon, RotateCcw, Eye, Pencil,
  LayoutDashboard, ChevronRight, Clock, PlusCircle, Maximize2, Minimize2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Group } from 'react-konva';
import useImage from 'use-image';
import { useAppStore } from './store/useAppStore';

// --- URLImage ---
const URLImage = ({ src, x = 0, y = 0, width, height }: { src: string; x?: number; y?: number; width: number; height: number }) => {
  const [image] = useImage(src);
  if (!image) return null;
  return <KonvaImage image={image} x={x} y={y} width={width} height={height} />;
};

// --- Helper for Adaptive Font Size ---
const calculateAdaptiveFontSize = (text: string, width: number, height: number, isDropdown: boolean = false, manualFontSize?: number) => {
  if (manualFontSize) return manualFontSize;
  if (!text) return Math.max(11, Math.floor(height * 0.38));
  // 너비가 아주 좁을 때는 패딩을 더 줄여서 공간 확보
  const padding = isDropdown ? (width < 60 ? 12 : 22) : (width < 40 ? 4 : 8); 
  const availableWidth = Math.max(2, width - padding);
  const heightBased = height * 0.52;
  const widthBased = availableWidth / ((text.length || 1) * 0.48); 
  
  // 박스가 너무 작으면 최소 7px까지 허용 (전에는 9px)
  return Math.max(7, Math.min(Math.floor(heightBased), Math.floor(widthBased), 22));
};

// --- Main App ---
function App() {
  const {
    appMode, setAppMode,
    currentTemplateId, currentTemplateName, setCurrentTemplateName,
    uploadedImageSrc, setUploadedImageSrc,
    selectedTool, setSelectedTool,
    fields, addField, updateField, removeField, duplicateField,
    selectedFieldId, setSelectedFieldId,
    setFieldValue, clearAllValues,
    savedTemplates, loadSavedTemplatesList, saveCurrentTemplate,
    loadTemplate, createNewTemplate, deleteTemplate, renameTemplate, isLoading,
    isGroupMoveEnabled, setIsGroupMoveEnabled,
    savedRecords, loadSavedRecordsList, saveCurrentRecord, loadRecord, deleteRecord, currentRecordId
  } = useAppStore();

  const [dashboardMode, setDashboardMode] = useState<'templates' | 'records'>('templates');

  const [isDrawing, setIsDrawing] = useState(false);
  const [newFieldRect, setNewFieldRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 794, height: 1123 });
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renamingTemplateId, setRenamingTemplateId] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<'fit' | 'original'>('original');
  const [zoomScale, setZoomScale] = useState(1);

  const stageRef = useRef<any>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const MAX_WIDTH = 794;

  useEffect(() => { 
    loadSavedTemplatesList(); 
    loadSavedRecordsList();
  }, [loadSavedTemplatesList, loadSavedRecordsList]);

  useEffect(() => {
    if (uploadedImageSrc) {
      const img = new window.Image();
      img.onload = () => {
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        setImageSize(prev => (prev.width === w && prev.height === h) ? prev : { width: w, height: h });
      };
      img.src = uploadedImageSrc;
    }
  }, [uploadedImageSrc]);

  useEffect(() => {
    if (!mainContentRef.current || scaleMode === 'original') {
      setZoomScale(1);
      return;
    }

    const updateScale = () => {
      if (!mainContentRef.current) return;
      const container = mainContentRef.current;
      const padding = 32; // p-4 or similar
      const availableW = container.clientWidth - padding;
      const availableH = container.clientHeight - padding;
      
      const s = Math.min(availableW / imageSize.width, availableH / imageSize.height);
      setZoomScale(Math.min(s, 1.2)); // 최대 1.2배까지만 자동 확대
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(mainContentRef.current);
    updateScale();

    return () => observer.disconnect();
  }, [scaleMode, imageSize, uploadedImageSrc]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles?.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setUploadedImageSrc(reader.result);
      };
      reader.readAsDataURL(acceptedFiles[0]);
    }
  }, [setUploadedImageSrc]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
    noClick: uploadedImageSrc !== null || appMode === 'fill',
    noKeyboard: true
  });

  const handleMouseDown = (e: any) => {
    if (appMode === 'fill' || selectedTool === 'select') return;
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.className === 'Image';
    if (!clickedOnEmpty) return;
    const pos = e.target.getStage().getPointerPosition();
    const adjustedPos = { x: pos.x / zoomScale, y: pos.y / zoomScale };
    setIsDrawing(true);
    setNewFieldRect({ x: adjustedPos.x, y: adjustedPos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !newFieldRect) return;
    const pos = e.target.getStage().getPointerPosition();
    const adjustedPos = { x: pos.x / zoomScale, y: pos.y / zoomScale };
    setNewFieldRect({ ...newFieldRect, width: adjustedPos.x - newFieldRect.x, height: adjustedPos.y - newFieldRect.y });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !newFieldRect) return;
    setIsDrawing(false);
    if (Math.abs(newFieldRect.width) < 20 || Math.abs(newFieldRect.height) < 10) { setNewFieldRect(null); return; }
    const finalX = newFieldRect.width < 0 ? newFieldRect.x + newFieldRect.width : newFieldRect.x;
    const finalY = newFieldRect.height < 0 ? newFieldRect.y + newFieldRect.height : newFieldRect.y;
    const finalW = Math.abs(newFieldRect.width);
    const finalH = Math.abs(newFieldRect.height);

    if (selectedTool === 'date') {
      addField({
        type: 'date',
        x: finalX,
        y: finalY,
        width: finalW,
        height: finalH,
        label: '날짜',
        yearWidth: 33,
        monthWidth: 33,
        dayWidth: 34,
      });
    } else if (selectedTool === 'image') {
      addField({
        type: 'image',
        x: finalX, y: finalY,
        width: finalW, height: finalH,
        label: '이미지 영역',
      });
    } else if (selectedTool === 'checkbox') {
      const size = Math.min(finalW, finalH);
      addField({
        type: 'checkbox',
        x: finalX, y: finalY,
        width: size, height: size,
        label: '체크박스',
      });
    } else {
      const defaultLabels: Record<string, string> = { text: '텍스트 입력', dropdown: '드롭다운' };
      addField({
        type: selectedTool as 'text' | 'dropdown',
        x: finalX, y: finalY,
        width: finalW, height: finalH,
        label: defaultLabels[selectedTool] || '필드',
        options: selectedTool === 'dropdown' ? ['옵션 1', '옵션 2'] : undefined,
      });
    }
    setNewFieldRect(null);
  };

  const handleExportJPG = async () => {
    if (!uploadedImageSrc) return;
    setIsPdfLoading(true);
    
    // 이미지 추출 전에 현재 작성 내용을 기록으로 자동 저장 (수정 모드 기능)
    await saveCurrentRecord();
    
    try {
      const SCALE = 2;
      const canvas = document.createElement('canvas');
      canvas.width = imageSize.width * SCALE;
      canvas.height = imageSize.height * SCALE;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(SCALE, SCALE);

      await new Promise<void>((res) => {
        const img = new window.Image();
        img.onload = () => { ctx.drawImage(img, 0, 0, imageSize.width, imageSize.height); res(); };
        img.src = uploadedImageSrc;
      });

      for (const field of fields) {
        const rawValue = field.value || field.defaultValue || '';
        if (!rawValue) continue;

        let displayValue = rawValue;
        if (field.type === 'date-year') {
          displayValue = rawValue.length === 4 ? rawValue.slice(2) : rawValue;
        } else if (field.type === 'date-month' || field.type === 'date-day') {
          displayValue = rawValue.padStart(2, '0');
        }

        if (field.type === 'date') {
          const parts = (rawValue || '--').split('-');
          const fontSize = field.fontSize || Math.max(11, Math.floor(field.height * 0.38));
          ctx.save();
          ctx.font = `600 ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
          ctx.fillStyle = '#111827';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          
          // Year
          if (parts[0]) {
            const yCenterX = field.x + field.width * (field.yearWidth! / 200);
            const text = field.showDateLabel ? `${parts[0]}년` : parts[0];
            ctx.fillText(text, yCenterX, field.y + field.height / 2, field.width * (field.yearWidth! / 100) - 4);
          }
          // Month
          if (parts[1]) {
            const mCenterX = field.x + field.width * (field.yearWidth! / 100) + field.width * (field.monthWidth! / 200);
            const monthStr = parts[1].padStart(2, '0');
            const text = field.showDateLabel ? `${monthStr}월` : monthStr;
            ctx.fillText(text, mCenterX, field.y + field.height / 2, field.width * (field.monthWidth! / 100) - 4);
          }
          // Day
          if (parts[2]) {
            const dCenterX = field.x + field.width * ((field.yearWidth! + field.monthWidth!) / 100) + field.width * (field.dayWidth! / 200);
            const dayStr = parts[2].padStart(2, '0');
            const text = field.showDateLabel ? `${dayStr}일` : dayStr;
            ctx.fillText(text, dCenterX, field.y + field.height / 2, field.width * (field.dayWidth! / 100) - 4);
          }
          ctx.restore();
          continue;
        }

        if (field.type === 'checkbox') {
          if (rawValue === 'true') {
            const cx = field.x + field.width / 2;
            const cy = field.y + field.height / 2;
            const size = Math.min(field.width, field.height);
            ctx.save();
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = size * 0.12;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(cx - size * 0.28, cy);
            ctx.lineTo(cx - size * 0.05, cy + size * 0.25);
            ctx.lineTo(cx + size * 0.32, cy - size * 0.25);
            ctx.stroke();
            ctx.restore();
          }
          continue;
        }

        const fontSize = Math.max(11, Math.floor(field.height * 0.38));
        ctx.save();
        ctx.font = `600 ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
        ctx.fillStyle = '#111827';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const textY = field.y + field.height / 2;
        const textX = field.x + field.width / 2;
        ctx.fillText(displayValue, textX, textY, field.width - 4);
        ctx.restore();
      }

      for (const field of fields) {
        if (field.type === 'image' && field.value) {
          await new Promise<void>((res) => {
            const img = new window.Image();
            img.onload = () => {
              ctx.drawImage(img, field.x, field.y, field.width, field.height);
              res();
            };
            img.src = field.value!;
          });
        }
      }

      const patientNameField = fields.find(f => f.label.includes('성명') || f.label.includes('환자명'));
      const patientName = patientNameField?.value || '';
      const fileName = patientName 
        ? `${currentTemplateName || '문서'}_${patientName}.jpg`
        : `${currentTemplateName || '문서'}.jpg`;
      
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: 'JPEG Image',
              accept: { 'image/jpeg': ['.jpg'] },
            }],
          });
          
          const writable = await handle.createWritable();
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95));
          if (blob) {
            await writable.write(blob);
            await writable.close();
            alert('파일이 성공적으로 저장되었습니다!');
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') throw err;
        }
      } else {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error(err);
      alert('이미지 저장 중 오류가 발생했습니다.');
    } finally {
      setIsPdfLoading(false);
    }
  };

  const selectedField = fields.find(f => f.id === selectedFieldId);

  const toolColors: Record<string, { main: string; bg: string; sel: string }> = {
    text:     { main: '#3b82f6', bg: 'rgba(59,130,246,0.15)',   sel: '#1d4ed8' },
    dropdown: { main: '#10b981', bg: 'rgba(16,185,129,0.15)',   sel: '#047857' },
    'date-year':  { main: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  sel: '#6d28d9' },
    'date-month': { main: '#818cf8', bg: 'rgba(129,140,248,0.12)',  sel: '#4f46e5' },
    'date-day':   { main: '#818cf8', bg: 'rgba(129,140,248,0.12)',  sel: '#4f46e5' },
    date:         { main: '#818cf8', bg: 'rgba(129,140,248,0.12)',  sel: '#4f46e5' },
    image:        { main: '#f472b6', bg: 'rgba(244,114,182,0.12)',   sel: '#db2777' },
    checkbox: { main: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  sel: '#d97706' },
  };

  const handleModeChange = (mode: 'edit' | 'fill') => {
    if (mode === 'edit') {
      setShowPasswordModal(true);
    } else {
      setAppMode('fill');
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === '6225') {
      setAppMode('edit');
      setShowPasswordModal(false);
      setPasswordInput('');
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const handleRenameSubmit = () => {
    if (renamingTemplateId && renameInput.trim()) {
      renameTemplate(renamingTemplateId, renameInput.trim());
      setShowRenameModal(false);
      setRenameInput('');
      setRenamingTemplateId(null);
    }
  };

  const handleCreateNewWithUpload = () => {
    // 1. 새 템플릿 생성 로직 호출
    createNewTemplate();
    
    // 2. 즉시 파일 업로드 다이얼로그 트리거
    setTimeout(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg';
      input.onchange = (e) => {
        const t = e.target as HTMLInputElement;
        if (t.files?.length) {
          onDrop(Array.from(t.files));
        }
      };
      input.click();
    }, 100);
  };

  if (!currentTemplateId && !isLoading && appMode === 'fill') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-6xl z-10">
          <header className="mb-12 text-center">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-sm font-medium mb-6 backdrop-blur-md">
              <LayoutDashboard className="w-4 h-4" /> 치과 서류 관리 시스템 v1.0
            </div>
            <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
              {dashboardMode === 'templates' ? (
                <>어떤 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">양식</span>을 작성할까요?</>
              ) : (
                <>저장된 <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">내역</span>을 수정할까요?</>
              )}
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              {dashboardMode === 'templates' 
                ? '저장된 템플릿을 선택하여 즉시 작성을 시작하거나, 관리자 모드에서 새로운 양식을 디자인할 수 있습니다.'
                : '이미 작성하여 이미지로 저장했던 내역을 불러와서 내용을 수정하거나 다시 저장할 수 있습니다.'}
            </p>
          </header>

          <div className="flex justify-center mb-10">
            <div className="bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700 backdrop-blur-xl flex gap-1">
              <button 
                onClick={() => setDashboardMode('templates')}
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${dashboardMode === 'templates' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <FileText className="w-4 h-4" /> 양식 선택
              </button>
              <button 
                onClick={() => setDashboardMode('records')}
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${dashboardMode === 'records' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <Clock className="w-4 h-4" /> 작성 내역 (수정 모드)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {dashboardMode === 'templates' ? (
              <>
                {/* Create New Template Card */}
                <button 
                  onClick={handleCreateNewWithUpload}
                  className="group relative flex flex-col items-center justify-center p-8 bg-white/5 border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/5 rounded-2xl transition-all duration-300"
                >
                  <div className="w-16 h-16 bg-slate-800 group-hover:bg-indigo-600 rounded-full flex items-center justify-center mb-4 transition-colors">
                    <PlusCircle className="w-8 h-8 text-slate-400 group-hover:text-white" />
                  </div>
                  <span className="text-lg font-bold text-slate-300 group-hover:text-white">새 양식 만들기</span>
                  <p className="text-xs text-slate-500 mt-2 text-center">새로운 서류 템플릿을<br />직접 디자인합니다.</p>
                </button>

                {/* Saved Template Cards */}
                {savedTemplates.map(tpl => (
                  <div key={tpl.id} className="group relative bg-slate-800/50 border border-slate-700 hover:border-cyan-500/50 rounded-2xl p-6 backdrop-blur-md transition-all duration-300 hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-cyan-500/10 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-900/50 px-2 py-1 rounded-full uppercase tracking-wider">
                        <Clock className="w-3 h-3" /> {new Date(tpl.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{tpl.name}</h3>
                    <p className="text-sm text-slate-400 mb-6 flex-1">설정된 필드가 포함된 치과 전용 서류 양식입니다.</p>
                    <button 
                      onClick={() => loadTemplate(tpl.id)}
                      className="w-full py-3 px-4 bg-slate-700 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-cyan-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      작성 시작하기 <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <>
                {savedRecords.length === 0 ? (
                  <div className="col-span-full py-20 text-center">
                    <Clock className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg">아직 저장된 작성 내역이 없습니다.</p>
                    <p className="text-slate-600 text-sm mt-2">양식을 작성하고 '이미지로 저장'하면 여기에 기록이 남습니다.</p>
                  </div>
                ) : (
                  savedRecords.map(record => (
                    <div key={record.id} className="group relative bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 rounded-2xl p-6 backdrop-blur-md transition-all duration-300 hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                          <Pencil className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteRecord(record.id); }}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-1 line-clamp-1">{record.templateName}</h3>
                      <p className="text-xs text-slate-400 mb-4 font-mono">
                        최근 수정: {new Date(record.updatedAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 mb-6 flex-1 italic">
                        {record.fields.filter(f => f.value).length}개의 항목이 작성되었습니다.
                      </p>
                      <button 
                        onClick={() => loadRecord(record.id)}
                        className="w-full py-3 px-4 bg-slate-700 hover:bg-gradient-to-r hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      >
                        이어서 수정하기 <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

          <footer className="mt-20 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-sm">© 2026 Dentist Form Pro. All rights reserved.</div>
            <div className="flex items-center gap-6">
              <span className="text-slate-400 text-xs flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> 시스템 정상 작동 중
              </span>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 font-sans text-slate-200">
      {appMode === 'edit' && (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <h1 className="font-bold text-slate-800 tracking-tight">Dentist Forms</h1>
            </div>
          </div>
          <div className="p-3 border-b border-slate-100">
            <button onClick={handleCreateNewWithUpload}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors">
              <Plus className="w-4 h-4" /> 새 템플릿 만들기
            </button>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">내 템플릿 목록</h2>
            <div className="space-y-1">
              {savedTemplates.length === 0 ? (
                <div className="text-xs text-slate-400 px-2 py-4 text-center">저장된 템플릿이 없습니다.</div>
              ) : (
                savedTemplates.map(tpl => (
                  <div key={tpl.id} className="group relative flex items-center w-full">
                    <button onClick={() => loadTemplate(tpl.id)}
                      className="flex-1 flex flex-col items-start px-3 py-2 text-sm text-left font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-colors pr-16">
                      <span className="truncate w-full block">{tpl.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                        {new Date(tpl.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                    <div className="absolute right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => {
                        setRenameInput(tpl.name);
                        setRenamingTemplateId(tpl.id);
                        setShowRenameModal(true);
                      }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all" title="이름 수정">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => deleteTemplate(tpl.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all" title="삭제">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="p-3 border-t border-slate-100 mt-auto">
            <button onClick={() => {
              const { exportTemplates } = useAppStore.getState();
              exportTemplates();
            }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors">
              <Download className="w-4 h-4" /> 모든 템플릿 내보내기 (JSON)
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-slate-200 hover:border-indigo-200 shadow-sm"
              title="템플릿 선택 창으로"
            >
              <LayoutDashboard className="w-4 h-4" />
              템플릿
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <input type="text" value={currentTemplateName} onChange={e => setCurrentTemplateName(e.target.value)}
              className={`text-lg font-bold bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 transition-colors min-w-[500px] max-w-[600px] ${currentRecordId ? 'text-emerald-700' : 'text-slate-800'}`}
              placeholder="템플릿 이름 입력..." disabled={appMode === 'fill'} />
            {currentRecordId && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 animate-pulse">
                수정 모드 (기록 편집 중)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setScaleMode(scaleMode === 'fit' ? 'original' : 'fit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                scaleMode === 'fit' 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {scaleMode === 'fit' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {scaleMode === 'fit' ? '원본 크기' : '화면 맞춤'}
            </button>

            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button onClick={() => handleModeChange('edit')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${appMode === 'edit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                {appMode === 'edit' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 opacity-50" />}
                편집 모드
              </button>
              <button onClick={() => handleModeChange('fill')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${appMode === 'fill' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                {appMode === 'fill' ? <FileText className="w-4 h-4" /> : <FileText className="w-4 h-4 opacity-50" />}
                작성 모드
              </button>
            </div>
            {appMode === 'fill' && (
              <>
                {selectedField && (selectedField.type === 'text' || selectedField.type === 'dropdown' || selectedField.type === 'date') && (
                  <div className="flex items-center gap-3 px-3 py-1 bg-slate-800 rounded-lg border border-slate-700 mr-2 shadow-inner">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Font Size</span>
                    <input 
                      type="range" min="8" max="40" step="1"
                      value={selectedField.fontSize || calculateAdaptiveFontSize(selectedField.value || '', selectedField.width, selectedField.height)}
                      onChange={e => updateField(selectedField.id, { fontSize: Number(e.target.value) })}
                      className="w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="text-xs font-mono font-bold text-emerald-400 w-6">
                      {Math.round(selectedField.fontSize || calculateAdaptiveFontSize(selectedField.value || '', selectedField.width, selectedField.height))}
                    </span>
                    <button 
                      onClick={() => updateField(selectedField.id, { fontSize: undefined })}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                      title="자동 크기 복원"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <button onClick={clearAllValues}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                  <RotateCcw className="w-4 h-4" /> 초기화
                </button>
                {currentRecordId && (
                  <button onClick={() => saveCurrentRecord().then(() => alert('작성된 내용이 저장되었습니다.'))}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors border border-emerald-200">
                    <Save className="w-4 h-4" /> 중간 저장
                  </button>
                )}
                <button onClick={handleExportJPG} disabled={isPdfLoading}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white rounded-md shadow-sm transition-colors ${isPdfLoading ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  <Download className="w-4 h-4" /> {isPdfLoading ? '이미지 생성 중...' : '이미지로 저장'}
                </button>
              </>
            )}
            {appMode === 'edit' && (
              <button onClick={saveCurrentTemplate} disabled={isLoading || !uploadedImageSrc}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white rounded-md shadow-sm transition-colors ring-1 ring-inset ${isLoading || !uploadedImageSrc ? 'bg-indigo-400 ring-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 ring-indigo-700'}`}>
                <Save className="w-4 h-4" /> {isLoading ? '저장 중...' : '템플릿 저장'}
              </button>
            )}
          </div>
        </header>

        {appMode === 'edit' && (
          <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-center gap-1 shrink-0 px-4 z-10 shadow-sm">
            <button className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedTool === 'select' ? 'text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => setSelectedTool('select')}>
              <MousePointer2 className="w-4 h-4" /> 선택
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedTool === 'text' ? 'text-blue-700 bg-blue-50 ring-1 ring-blue-200' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => setSelectedTool('text')}>
              <Type className="w-4 h-4" /> 텍스트
            </button>
            <button className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedTool === 'dropdown' ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => setSelectedTool('dropdown')}>
              <List className="w-4 h-4" /> 드롭다운
            </button>
            <button className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedTool === 'date' ? 'text-violet-700 bg-violet-50 ring-1 ring-violet-200' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => setSelectedTool('date')}>
              <CalendarDays className="w-4 h-4" /> 날짜
            </button>
            <button className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedTool === 'checkbox' ? 'text-amber-700 bg-amber-50 ring-1 ring-amber-200' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => setSelectedTool('checkbox')}>
              <CheckSquare className="w-4 h-4" /> 체크박스
            </button>
            <button className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedTool === 'image' ? 'text-pink-700 bg-pink-50 ring-1 ring-pink-200' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => setSelectedTool('image')}>
              <ImageIcon className="w-4 h-4" /> 이미지
            </button>
          </div>
        )}

        <div className="flex-1 bg-slate-200 overflow-auto relative flex justify-center items-start p-6 md:p-12 outline-none"
             ref={mainContentRef}
             {...(appMode === 'edit' ? getRootProps() : {})}>
          {appMode === 'edit' && <input {...getInputProps()} />}
          <div className={`relative bg-white shadow-2xl transition-transform duration-200 ease-out origin-top mb-12 ${appMode === 'edit' && selectedTool !== 'select' ? 'cursor-crosshair' : ''}`}
               ref={stageContainerRef} style={{ 
                 width: imageSize.width * zoomScale, 
                 height: imageSize.height * zoomScale,
                 marginTop: scaleMode === 'fit' ? 0 : '1rem'
               }}>
            {!uploadedImageSrc && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-0">
                <div className={`p-4 rounded-full mb-4 ${isDragActive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                  <Upload className={`w-10 h-10 ${isDragActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                </div>
                <p className={`text-xl font-bold mb-2 ${isDragActive ? 'text-indigo-600' : 'text-slate-700'}`}>
                  {isDragActive ? '여기에 드롭하세요!' : '양식 이미지를 업로드해주세요'}
                </p>
                <p className="text-sm text-slate-500">파일을 드래그앤드롭하거나 상단 버튼으로 선택하세요 (JPG, PNG)</p>
              </div>
            )}
            <Stage width={imageSize.width} height={imageSize.height} ref={stageRef}
                   scaleX={zoomScale} scaleY={zoomScale}
                   onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
                   onClick={e => { if (appMode === 'edit' && (e.target === e.target.getStage() || e.target.className === 'Image')) setSelectedFieldId(null); }}>
              <Layer clipX={0} clipY={0} clipWidth={imageSize.width} clipHeight={imageSize.height}>
                {uploadedImageSrc && <URLImage src={uploadedImageSrc} width={imageSize.width} height={imageSize.height} />}
                {fields.map(field => {
                  const isSelected = field.id === selectedFieldId;
                  const c = toolColors[field.type] || toolColors.text;
                  if (appMode === 'fill') {
                    return (
                      <Group key={field.id} x={field.x} y={field.y}>
                        <Rect width={field.width} height={field.height} fill={c.bg} stroke={c.main} strokeWidth={1} />
                      </Group>
                    );
                  }
                  return (
                    <Group key={field.id} x={field.x} y={field.y} draggable={selectedTool === 'select'}
                      onClick={e => { e.cancelBubble = true; setSelectedTool('select'); setSelectedFieldId(field.id); }}
                      onDragStart={(e) => {
                        setSelectedFieldId(field.id);
                        if (field.groupId) {
                          const groupFields = fields.filter(gf => gf.groupId === field.groupId);
                          const startPositions: Record<string, { x: number, y: number }> = {};
                          groupFields.forEach(gf => { startPositions[gf.id] = { x: gf.x, y: gf.y }; });
                          (e.target as any)._groupStartPositions = startPositions;
                        }
                      }}
                      onDragMove={(e) => {
                        const target = e.target;
                        const dx = target.x() - field.x;
                        const dy = target.y() - field.y;
                        if (isGroupMoveEnabled && field.groupId && (target as any)._groupStartPositions) {
                          const startPositions = (target as any)._groupStartPositions;
                          fields.forEach(gf => {
                            if (gf.groupId === field.groupId && gf.id !== field.id) {
                              const start = startPositions[gf.id];
                              if (start) updateField(gf.id, { x: start.x + dx, y: start.y + dy });
                            }
                          });
                        }
                      }}
                      onDragEnd={e => {
                        updateField(field.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
                        if ((e.target as any)._groupStartPositions) delete (e.target as any)._groupStartPositions;
                      }}>
                      <Rect width={field.width} height={field.height}
                        fill={isSelected ? c.bg.replace('0.15', '0.28') : c.bg}
                        stroke={isSelected ? c.sel : c.main} strokeWidth={isSelected ? 2 : 1}
                        shadowColor={isSelected ? c.sel : 'transparent'} shadowBlur={isSelected ? 5 : 0} shadowOpacity={0.2} />
                      {field.type === 'checkbox' ? (
                        <Text text="✔" width={field.width} height={field.height} align="center" verticalAlign="middle"
                          fill={isSelected ? c.sel + 'bb' : c.main + '88'}
                          fontSize={Math.max(10, Math.floor(Math.min(field.width, field.height) * 0.6))} />
                      ) : field.type === 'image' ? (
                        <Group>
                          {field.value ? (
                            <URLImage src={field.value} width={field.width} height={field.height} />
                          ) : (
                            <Group>
                              <Rect width={field.width} height={field.height} fill={c.bg} />
                              <Text text="이미지를 업로드하세요" width={field.width} height={field.height} align="center" verticalAlign="middle" fill={c.main} fontSize={Math.max(8, Math.floor(field.height * 0.15))} />
                            </Group>
                          )}
                        </Group>
                      ) : field.type === 'date' ? (
                        <Group>
                          <Text text={field.showDateLabel ? "0000년" : "년"} x={0} y={0} width={field.width * (field.yearWidth! / 100)} height={field.height} align="center" verticalAlign="middle" fill={isSelected ? c.sel : c.main} fontSize={Math.max(10, Math.floor(field.height * 0.3))} fontStyle="600" opacity={field.showDateLabel ? 0.4 : 1} />
                          <Rect x={field.width * (field.yearWidth! / 100)} y={field.height * 0.2} width={1} height={field.height * 0.6} fill={c.main} opacity={0.3} />
                          <Text text={field.showDateLabel ? "00월" : "월"} x={field.width * (field.yearWidth! / 100)} y={0} width={field.width * (field.monthWidth! / 100)} height={field.height} align="center" verticalAlign="middle" fill={isSelected ? c.sel : c.main} fontSize={Math.max(10, Math.floor(field.height * 0.3))} fontStyle="600" opacity={field.showDateLabel ? 0.4 : 1} />
                          <Rect x={field.width * ((field.yearWidth! + field.monthWidth!) / 100)} y={field.height * 0.2} width={1} height={field.height * 0.6} fill={c.main} opacity={0.3} />
                          <Text text={field.showDateLabel ? "00일" : "일"} x={field.width * ((field.yearWidth! + field.monthWidth!) / 100)} y={0} width={field.width * (field.dayWidth! / 100)} height={field.height} align="center" verticalAlign="middle" fill={isSelected ? c.sel : c.main} fontSize={Math.max(10, Math.floor(field.height * 0.3))} fontStyle="600" opacity={field.showDateLabel ? 0.4 : 1} />
                        </Group>
                      ) : (
                        <Text text={field.label} width={field.width} height={field.height} padding={6} align="center" verticalAlign="middle"
                          fill={isSelected ? c.sel : c.main} fontSize={Math.max(12, Math.floor(field.height * 0.32))} fontStyle="600" />
                      )}
                    </Group>
                  );
                })}
                {newFieldRect && (
                  <Rect x={newFieldRect.x} y={newFieldRect.y} width={newFieldRect.width} height={newFieldRect.height}
                    fill={(toolColors[selectedTool] || toolColors.text).bg}
                    stroke={(toolColors[selectedTool] || toolColors.text).main} strokeWidth={2} dash={[6, 4]} />
                )}
              </Layer>
            </Stage>
            {appMode === 'fill' && (
              <div className="fill-overlay" style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: imageSize.width, 
                height: imageSize.height, 
                pointerEvents: 'none',
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top left'
              }}>
                {fields.map(field => (
                  <div key={field.id} style={{ position: 'absolute', left: field.x, top: field.y, width: field.width, height: field.height, pointerEvents: 'auto', display: 'flex', alignItems: 'center' }}>
                    {field.type === 'text' && (
                      <input type="text" value={field.value || ''} 
                        onChange={e => setFieldValue(field.id, e.target.value)}
                        onFocus={() => setSelectedFieldId(field.id)}
                        placeholder={field.label}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          background: 'rgba(255,255,255,0.92)', 
                          border: '1px solid #3b82f6', 
                          borderRadius: 2, 
                          padding: '0 6px', 
                          fontSize: calculateAdaptiveFontSize(field.value || field.label, field.width, field.height, false, field.fontSize), 
                          outline: 'none', 
                          boxSizing: 'border-box', 
                          color: '#000000' 
                        }} />
                    )}
                    {field.type === 'dropdown' && (
                      <select value={field.value || ''} 
                        onChange={e => setFieldValue(field.id, e.target.value)}
                        onFocus={() => setSelectedFieldId(field.id)}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          background: 'rgba(255,255,255,0.92)', 
                          border: '1px solid #10b981', 
                          borderRadius: 2, 
                          padding: '0 2px', 
                          fontSize: calculateAdaptiveFontSize(field.value || field.label, field.width, field.height, true, field.fontSize), 
                          outline: 'none', 
                          boxSizing: 'border-box', 
                          cursor: 'pointer', 
                          color: '#000000', 
                          appearance: 'auto' 
                        }}>
                        <option value="">{field.label}</option>
                        {(field.options || []).map((opt: string, i: number) => <option key={i} value={opt}>{opt}</option>)}
                      </select>
                    )}
                    {(field.type === 'date-year' || field.type === 'date-month' || field.type === 'date-day') && (
                      <input type="number" value={field.value || ''} 
                        onChange={e => { const v = e.target.value; if (v.length <= 4) setFieldValue(field.id, v); }}
                        onFocus={() => setSelectedFieldId(field.id)}
                        placeholder={field.label}
                        style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.92)', border: '1px solid #8b5cf6', borderRadius: 2, padding: 0, fontSize: field.fontSize || Math.max(11, Math.floor(field.height * 0.38)), outline: 'none', boxSizing: 'border-box', textAlign: 'center', color: '#000000' }} />
                    )}
                    {field.type === 'checkbox' && (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <input type="checkbox" checked={field.value === 'true'} 
                           onChange={e => setFieldValue(field.id, e.target.checked ? 'true' : 'false')}
                           onFocus={() => setSelectedFieldId(field.id)}
                           style={{ width: Math.min(field.width, field.height) * 0.8, height: Math.min(field.width, field.height) * 0.8, cursor: 'pointer', pointerEvents: 'auto' }} />
                      </div>
                    )}
                    {field.type === 'date' && (
                      <div style={{ display: 'flex', width: '100%', height: '100%', gap: 1 }}>
                        <div style={{ width: `${field.yearWidth}%`, height: '100%', position: 'relative' }}>
                          <input type="text" value={field.value?.split('-')[0] || ''} 
                            onChange={e => { const parts = (field.value || '--').split('-'); setFieldValue(field.id, `${e.target.value}-${parts[1]}-${parts[2]}`); }}
                            onFocus={() => setSelectedFieldId(field.id)}
                            placeholder="년" style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.92)', border: '1px solid #8b5cf6', borderRadius: '2px 0 0 2px', padding: 0, fontSize: field.fontSize || Math.max(10, Math.floor(field.height * 0.33)), outline: 'none', textAlign: 'center', color: '#000000' }} />
                          {field.showDateLabel && (field.value?.split('-')[0]) && <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: (field.fontSize || Math.max(10, Math.floor(field.height * 0.33))) * 0.8, color: '#666', pointerEvents: 'none' }}>년</span>}
                        </div>
                        <div style={{ width: `${field.monthWidth}%`, height: '100%', position: 'relative' }}>
                          <input type="text" value={field.value?.split('-')[1] || ''} 
                            onChange={e => { const parts = (field.value || '--').split('-'); setFieldValue(field.id, `${parts[0]}-${e.target.value}-${parts[2]}`); }}
                            onFocus={() => setSelectedFieldId(field.id)}
                            placeholder="월" style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.92)', border: '1px solid #8b5cf6', borderLeft: 'none', padding: 0, fontSize: field.fontSize || Math.max(10, Math.floor(field.height * 0.33)), outline: 'none', textAlign: 'center', color: '#000000' }} />
                          {field.showDateLabel && (field.value?.split('-')[1]) && <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: (field.fontSize || Math.max(10, Math.floor(field.height * 0.33))) * 0.8, color: '#666', pointerEvents: 'none' }}>월</span>}
                        </div>
                        <div style={{ width: `${field.dayWidth}%`, height: '100%', position: 'relative' }}>
                          <input type="text" value={field.value?.split('-')[2] || ''} 
                            onChange={e => { const parts = (field.value || '--').split('-'); setFieldValue(field.id, `${parts[0]}-${parts[1]}-${e.target.value}`); }}
                            onFocus={() => setSelectedFieldId(field.id)}
                            placeholder="일" style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.92)', border: '1px solid #8b5cf6', borderLeft: 'none', borderRadius: '0 2px 2px 0', padding: 0, fontSize: field.fontSize || Math.max(10, Math.floor(field.height * 0.33)), outline: 'none', textAlign: 'center', color: '#000000' }} />
                          {field.showDateLabel && (field.value?.split('-')[2]) && <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: (field.fontSize || Math.max(10, Math.floor(field.height * 0.33))) * 0.8, color: '#666', pointerEvents: 'none' }}>일</span>}
                        </div>
                      </div>
                    )}
                    {field.type === 'checkbox' && (
                      <div onClick={() => setFieldValue(field.id, field.value === 'true' ? '' : 'true')}
                        style={{ width: field.width, height: field.height, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none', fontSize: Math.max(14, Math.floor(field.height * 0.7)), color: field.value === 'true' ? '#111827' : 'transparent', border: '1px solid #f59e0b', borderRadius: 2, background: field.value === 'true' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.7)' }}>
                        ✔
                      </div>
                    )}
                    {field.type === 'image' && (
                      <div className="group relative overflow-hidden rounded border-2 border-dashed border-pink-300 bg-white/50 hover:bg-pink-50 transition-colors"
                        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file'; input.accept = 'image/*';
                          input.onchange = (e) => {
                            const t = e.target as HTMLInputElement;
                            if (t.files?.[0]) {
                              const reader = new FileReader();
                              reader.onload = () => typeof reader.result === 'string' && setFieldValue(field.id, reader.result);
                              reader.readAsDataURL(t.files[0]);
                            }
                          };
                          input.click();
                        }}>
                        {field.value ? (
                          <img src={field.value} className="w-full h-full object-contain" alt="upload" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <Upload className="w-4 h-4 text-pink-500" />
                            <span className="text-[10px] font-bold text-pink-600">이미지 추가</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {appMode === 'edit' && (
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              {selectedField ? <Settings className="w-4 h-4 text-indigo-500" /> : <List className="w-4 h-4 text-slate-400" />}
              {selectedField ? '필드 속성 편집' : '입력 현황'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {!selectedField ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">캔버스에서 박스를 클릭하거나 툴바에서 도구를 골라 그려보세요.</p>
                <div className="space-y-2 text-xs text-slate-500 mt-3">
                  {fields.map(f => (
                    <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded">
                      <span className="truncate font-medium text-slate-600">{f.label}</span>
                      <button onClick={(e) => { e.stopPropagation(); removeField(f.id); }} className="ml-auto p-1 text-slate-300 hover:text-red-400 rounded"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">라벨명</label>
                    <input type="text" value={selectedField.label} onChange={e => updateField(selectedField.id, { label: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md text-sm text-slate-900" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[11px] text-slate-500 mb-0.5 block">X (가로 위치)</label>
                      <input type="number" value={Math.round(selectedField.x)} onChange={e => updateField(selectedField.id, { x: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 border rounded text-sm text-slate-900" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] text-slate-500 mb-0.5 block">Y (세로 위치)</label>
                      <input type="number" value={Math.round(selectedField.y)} onChange={e => updateField(selectedField.id, { y: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 border rounded text-sm text-slate-900" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[11px] text-slate-500 mb-0.5 block">W (너비)</label>
                      <input type="number" value={Math.round(selectedField.width)} onChange={e => updateField(selectedField.id, { width: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 border rounded text-sm text-slate-900" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] text-slate-500 mb-0.5 block">H (높이)</label>
                      <input type="number" value={Math.round(selectedField.height)} onChange={e => updateField(selectedField.id, { height: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 border rounded text-sm text-slate-900" />
                    </div>
                  </div>
                  {selectedField.groupId && (
                    <div className="pt-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={isGroupMoveEnabled} onChange={(e) => setIsGroupMoveEnabled(e.target.checked)} />
                        <span className="text-sm font-medium">날짜 필드 그룹으로 이동</span>
                      </label>
                    </div>
                  )}
                  {/* 고정값(Fixed Value) 속성 복구 */}
                  {(selectedField.type === 'text' || selectedField.type === 'dropdown' || selectedField.type.startsWith('date-')) && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-indigo-500" />
                          고정값 (미리 채우기)
                        </label>
                        {selectedField.defaultValue && (
                          <button onClick={() => updateField(selectedField.id, { defaultValue: '' })} className="text-[10px] text-red-500 underline">지우기</button>
                        )}
                      </div>
                      <input type="text" value={selectedField.defaultValue || ''} onChange={e => updateField(selectedField.id, { defaultValue: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-900 shadow-inner transition-all" placeholder="작성 모드 시 자동 입력될 내용" />
                    </div>
                  )}
                  {selectedField.type === 'date' && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                         <label className="text-sm font-medium text-slate-700">날짜 칸 너비 조절 (%)</label>
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={selectedField.showDateLabel || false} onChange={e => updateField(selectedField.id, { showDateLabel: e.target.checked })} />
                            <span className="text-xs font-bold text-indigo-600">년,월,일 포함</span>
                         </label>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-4">년</span>
                          <input type="range" min="10" max="80" value={selectedField.yearWidth} onChange={e => {
                            const y = Number(e.target.value);
                            const remain = 100 - y;
                            const m = Math.floor(remain / 2);
                            updateField(selectedField.id, { yearWidth: y, monthWidth: m, dayWidth: 100 - y - m });
                          }} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          <span className="text-xs font-mono text-slate-600 w-8">{selectedField.yearWidth}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 w-4">월</span>
                          <input type="range" min="10" max="80" value={selectedField.monthWidth} onChange={e => {
                            const m = Number(e.target.value);
                            const remain = 100 - m;
                            const y = Math.floor(remain / 2);
                            updateField(selectedField.id, { monthWidth: m, yearWidth: y, dayWidth: 100 - m - y });
                          }} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          <span className="text-xs font-mono text-slate-600 w-8">{selectedField.monthWidth}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedField.type === 'dropdown' && (
                    <div className="space-y-1.5 pt-2">
                      <label className="text-sm font-medium text-slate-700">드롭다운 옵션 (쉼표로 구분)</label>
                      <textarea 
                        defaultValue={(selectedField.options || []).join(', ')} 
                        onBlur={e => updateField(selectedField.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="예: 옵션1, 옵션2, 옵션3"
                        className="w-full h-24 px-3 py-2 border rounded-md text-sm text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                      <p className="text-[10px] text-slate-400 font-normal mt-1">* 내용을 수정한 후 다른 곳을 클릭하면 적용됩니다.</p>
                    </div>
                  )}
                  {selectedField.type === 'image' && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <label className="text-sm font-medium text-slate-700">이미지 설정</label>
                      <button 
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file'; input.accept = 'image/*';
                          input.onchange = (e) => {
                            const t = e.target as HTMLInputElement;
                            if (t.files?.[0]) {
                              const reader = new FileReader();
                              reader.onload = () => typeof reader.result === 'string' && updateField(selectedField.id, { defaultValue: reader.result });
                              reader.readAsDataURL(t.files[0]);
                            }
                          };
                          input.click();
                        }}
                        className="w-full px-3 py-2 bg-pink-50 border border-pink-100 rounded-md text-xs font-medium text-pink-600 hover:bg-pink-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5" /> 기본 이미지 설정
                      </button>
                      {selectedField.defaultValue && (
                        <div className="relative mt-2 rounded border border-slate-200 p-1 bg-slate-50">
                          <img src={selectedField.defaultValue} className="w-full h-20 object-contain rounded" alt="preview" />
                          <button onClick={() => updateField(selectedField.id, { defaultValue: '' })} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="pt-4 space-y-2 border-t border-slate-100">
                  <button onClick={() => removeField(selectedField.id)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md border border-red-100"><Trash2 className="w-4 h-4" /> 이 필드 삭제</button>
                  <button onClick={() => duplicateField(selectedField.id)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md border border-indigo-100"><Copy className="w-4 h-4" /> 이 필드 복제</button>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4 text-slate-800">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">편집 모드 잠금 해제</h3>
                <p className="text-xs text-slate-500">관리자 비밀번호를 입력해주세요.</p>
              </div>
            </div>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              autoFocus
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-center text-xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800"
              placeholder="••••"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => { setShowPasswordModal(false); setPasswordInput(''); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handlePasswordSubmit}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-200 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showRenameModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4 text-slate-800">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">템플릿 이름 수정</h3>
                <p className="text-xs text-slate-500">새로운 이름을 입력해주세요.</p>
              </div>
            </div>
            <input 
              type="text" 
              value={renameInput} 
              onChange={e => setRenameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()}
              autoFocus
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              placeholder="템플릿 이름..."
            />
            <div className="flex gap-2">
              <button 
                onClick={() => { setShowRenameModal(false); setRenameInput(''); setRenamingTemplateId(null); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleRenameSubmit}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-200 transition-colors"
              >
                변경하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
