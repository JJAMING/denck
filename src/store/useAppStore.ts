import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { templateStorage, recordStorage } from '../utils/storage';
import type { TemplateData, FormRecord } from '../utils/storage';

export type FieldType = 'text' | 'dropdown' | 'date-year' | 'date-month' | 'date-day' | 'date' | 'checkbox' | 'image';

export interface FormField {
  id: string;
  type: FieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  options?: string[];
  value?: string; // in fill mode, stores user input
  groupId?: string; // for grouping fields like date (year, month, day)
  defaultValue?: string; // fixed value that auto-fills in fill mode
  fontSize?: number; // user-specified font size
  // For integrated date fields
  yearWidth?: number;
  monthWidth?: number;
  dayWidth?: number;
  showDateLabel?: boolean;
}

export type ToolType = 'select' | 'text' | 'dropdown' | 'date' | 'checkbox' | 'image';
export type AppMode = 'edit' | 'fill'; // 편집 모드 vs 작성 모드

interface AppState {
  // App-level mode
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  // Current working template info
  currentTemplateId: string | null;
  currentRecordId: string | null;
  currentTemplateName: string;
  setCurrentTemplateName: (name: string) => void;
  isLoading: boolean;
  
  // Toolbar state
  selectedTool: ToolType;
  setSelectedTool: (tool: ToolType) => void;

  // Selected field for property editing  
  selectedFieldId: string | null;
  setSelectedFieldId: (id: string | null) => void;

  // View state (uploaded image)
  uploadedImageSrc: string | null;
  setUploadedImageSrc: (src: string | null) => void;

  // Canvas fields
  fields: FormField[];
  addField: (field: Omit<FormField, 'id'>) => void;
  updateField: (id: string, updates: Partial<FormField>) => void;
  removeField: (id: string) => void;
  // For fill mode: update value of a specific field
  setFieldValue: (id: string, value: string) => void;
  clearAllValues: () => void;

  // Template Actions
  savedTemplates: TemplateData[];
  loadSavedTemplatesList: () => Promise<void>;
  saveCurrentTemplate: () => Promise<void>;
  loadTemplate: (id: string) => Promise<void>;
  createNewTemplate: () => void;
  deleteTemplate: (id: string) => Promise<void>;
  renameTemplate: (id: string, newName: string) => Promise<void>;
  duplicateField: (id: string) => void;
  exportTemplates: () => Promise<void>;
  isGroupMoveEnabled: boolean;
  setIsGroupMoveEnabled: (enabled: boolean) => void;

  // Record (Form Submission) Actions
  savedRecords: FormRecord[];
  loadSavedRecordsList: () => Promise<void>;
  saveCurrentRecord: () => Promise<void>;
  loadRecord: (id: string) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  appMode: 'fill',
  setAppMode: (mode) => set((state) => {
    let newFields = state.fields;
    // 작성 모드(fill)로 진입할 때 고정값(defaultValue)이 있는 필드 중 
    // 현재 값(value)이 비어있는 경우 고정값으로 채워줍니다.
    if (mode === 'fill') {
      newFields = state.fields.map(f => ({
        ...f,
        value: f.value || f.defaultValue || ''
      }));
    } else if (mode === 'edit') {
      // 편집 모드로 진입할 때는 입력된 값들을 비워줍니다.
      // 이렇게 해야 고정값 편집 내용이 작성 모드에 즉시 반영됩니다.
      newFields = state.fields.map(f => ({ ...f, value: '' }));
    }
    return { 
      appMode: mode, 
      selectedFieldId: null,
      fields: newFields
    };
  }),

  renameTemplate: async (id: string, newName: string) => {
    set({ isLoading: true });
    try {
      const template = await templateStorage.getTemplate(id);
      if (template) {
        await templateStorage.saveTemplate({ ...template, name: newName }, id);
        await get().loadSavedTemplatesList();
        
        // 현재 활성화된 템플릿이면 이름도 같이 변경
        if (get().currentTemplateId === id) {
          set({ currentTemplateName: newName });
        }
      }
    } catch (e) {
      console.error(e);
      alert('이름 수정 중 오류가 발생했습니다.');
    } finally {
      set({ isLoading: false });
    }
  },

  currentTemplateId: null,
  currentRecordId: null,
  currentTemplateName: '새 양식',
  setCurrentTemplateName: (name) => set({ currentTemplateName: name }),
  isLoading: false,

  selectedTool: 'select',
  setSelectedTool: (tool) => set({ selectedTool: tool, selectedFieldId: null }),

  selectedFieldId: null,
  setSelectedFieldId: (id) => set({ selectedFieldId: id }),

  uploadedImageSrc: null,
  setUploadedImageSrc: (src) => set({ uploadedImageSrc: src }),

  fields: [],
  addField: (field) => {
    const newId = uuidv4();
    set((state) => ({ 
      fields: [...state.fields, { ...field, id: newId }],
      selectedFieldId: newId,
      selectedTool: 'select'
    }));
  },
  updateField: (id, updates) => set((state) => ({
    fields: state.fields.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  removeField: (id) => set((state) => ({
    fields: state.fields.filter(f => f.id !== id),
    selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId
  })),
  setFieldValue: (id, value) => set((state) => ({
    fields: state.fields.map(f => f.id === id ? { ...f, value } : f)
  })),
  clearAllValues: () => set((state) => ({
    fields: state.fields.map(f => ({ ...f, value: '' }))
  })),

  savedTemplates: [],
  
  loadSavedTemplatesList: async () => {
    let templates = await templateStorage.getAllTemplates();
    
    // 로컬 DB가 비어있으면 초기 템플릿 불러오기 (Vercel 배포 등 신규 사용자용)
    if (templates.length === 0) {
      try {
        const response = await fetch('/dentist_templates.json');
        if (response.ok) {
          const initialTemplates = await response.json();
          // 가져온 템플릿들을 로컬 DB에 저장
          for (const tpl of initialTemplates) {
             await templateStorage.saveTemplate(tpl, tpl.id);
          }
          // 다시 불러오기
          templates = await templateStorage.getAllTemplates();
        }
      } catch (e) {
        console.error('기본 템플릿 로딩 실패:', e);
      }
    }
    
    set({ savedTemplates: templates });
  },

  saveCurrentTemplate: async () => {
    const { currentTemplateId, currentTemplateName, uploadedImageSrc, fields } = get();
    set({ isLoading: true });
    try {
      // 저장 시 입력된 값(value)은 제외하고 필드 구조만 저장
      const fieldsForSave = fields.map(f => ({ ...f, value: '' }));
      const saved = await templateStorage.saveTemplate({
        name: currentTemplateName,
        imageSrc: uploadedImageSrc,
        fields: fieldsForSave
      }, currentTemplateId || undefined);
      
      set({ currentTemplateId: saved.id, fields: fieldsForSave });
      await get().loadSavedTemplatesList();
      alert('템플릿이 성공적으로 저장되었습니다!');
    } catch (e) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      set({ isLoading: false });
    }
  },

  loadTemplate: async (id: string) => {
    set({ isLoading: true });
    try {
      const template = await templateStorage.getTemplate(id);
      if (template) {
        set({
          currentTemplateId: template.id,
          currentRecordId: null, // New filling from template
          currentTemplateName: template.name,
          uploadedImageSrc: template.imageSrc,
          fields: (template.fields || []).map(f => ({
            ...f,
            value: f.value || f.defaultValue || ''
          })),
          selectedFieldId: null,
          selectedTool: 'select',
          appMode: 'fill'
        });
      }
    } catch (e) {
      console.error(e);
      alert('템플릿을 불러오는 중 오류가 발생했습니다.');
    } finally {
      set({ isLoading: false });
    }
  },

  createNewTemplate: () => {
    if (get().fields.length > 0 && !window.confirm('저장하지 않은 내용은 사라집니다. 새 템플릿을 만드시겠습니까?')) {
      return;
    }
    set({
      currentTemplateId: null,
      currentRecordId: null,
      currentTemplateName: '새 양식',
      uploadedImageSrc: null,
      fields: [],
      selectedFieldId: null,
      selectedTool: 'select',
      appMode: 'edit'
    });
  },

  deleteTemplate: async (id: string) => {
    if (!window.confirm('이 템플릿을 정말 삭제하시겠습니까?')) return;
    
    await templateStorage.deleteTemplate(id);
    await get().loadSavedTemplatesList();
    
    if (get().currentTemplateId === id) {
      get().createNewTemplate();
    }
  },

  duplicateField: (id: string) => {
    const fields = get().fields;
    const targetField = fields.find(f => f.id === id);
    if (!targetField) return;

    let fieldsToDuplicate: FormField[] = [];
    let newGroupId: string | undefined = undefined;

    if (targetField.groupId) {
      fieldsToDuplicate = fields.filter(f => f.groupId === targetField.groupId);
      newGroupId = uuidv4();
    } else {
      fieldsToDuplicate = [targetField];
    }

    const newDuplicatedFields = fieldsToDuplicate.map(f => ({
      ...f,
      id: uuidv4(),
      x: f.x + 10,
      y: f.y + 10,
      groupId: newGroupId || f.groupId // groups get a new joint groupId, single fields stay undefined
    }));

    set((state) => ({
      fields: [...state.fields, ...newDuplicatedFields],
      selectedFieldId: newDuplicatedFields[0].id,
      selectedTool: 'select'
    }));
  },
  
  exportTemplates: async () => {
    try {
      const { templateStorage } = await import('../utils/storage');
      const templates = await templateStorage.getAllTemplates();
      const dataStr = JSON.stringify(templates, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = 'dentist_templates.json';
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      alert('템플릿이 성공적으로 추출되었습니다. 다운로드된 파일을 확인해 주세요!');
    } catch (e) {
      console.error(e);
      alert('템플릿 추출 중 오류가 발생했습니다.');
    }
  },
  isGroupMoveEnabled: true,
  setIsGroupMoveEnabled: (enabled: boolean) => set({ isGroupMoveEnabled: enabled }),

  savedRecords: [],
  loadSavedRecordsList: async () => {
    const records = await recordStorage.getAllRecords();
    set({ savedRecords: records });
  },

  saveCurrentRecord: async () => {
    const { currentTemplateId, currentRecordId, currentTemplateName, fields } = get();
    if (!currentTemplateId) return;

    try {
      const saved = await recordStorage.saveRecord({
        templateId: currentTemplateId,
        templateName: currentTemplateName,
        fields: fields
      }, currentRecordId || undefined);
      
      set({ currentRecordId: saved.id });
      await get().loadSavedRecordsList();
    } catch (e) {
      console.error('기록 저장 실패:', e);
    }
  },

  loadRecord: async (id: string) => {
    set({ isLoading: true });
    try {
      const record = await recordStorage.getRecord(id);
      if (record) {
        // 이미지 경로를 가져오기 위해 템플릿 정보도 필요함
        const template = await templateStorage.getTemplate(record.templateId);
        set({
          currentTemplateId: record.templateId,
          currentRecordId: record.id,
          currentTemplateName: record.templateName,
          uploadedImageSrc: template ? template.imageSrc : null,
          fields: record.fields,
          selectedFieldId: null,
          selectedTool: 'select',
          appMode: 'fill'
        });
      }
    } catch (e) {
      console.error('기록 불러오기 실패:', e);
      alert('기록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      set({ isLoading: false });
    }
  },

  deleteRecord: async (id: string) => {
    if (!window.confirm('이 기록을 정말 삭제하시겠습니까?')) return;
    await recordStorage.deleteRecord(id);
    await get().loadSavedRecordsList();
    
    if (get().currentRecordId === id) {
      set({ currentRecordId: null });
    }
  },
}));
