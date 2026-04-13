import { get, set, del, keys } from 'idb-keyval';
import type { FormField } from '../store/useAppStore';
import { v4 as uuidv4 } from 'uuid';

export interface TemplateData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  imageSrc: string | null;
  fields: FormField[];
}

const TEMPLATE_PREFIX = 'template_';
const RECORD_PREFIX = 'record_';

export interface FormRecord {
  id: string;
  templateId: string;
  templateName: string;
  fields: FormField[];
  updatedAt: number;
  createdAt: number;
}

export const templateStorage = {
  // 새로운 템플릿 저장 (또는 덮어쓰기)
  async saveTemplate(template: Omit<TemplateData, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string): Promise<TemplateData> {
    const id = existingId || uuidv4();
    const now = Date.now();
    
    // 기존 데이터 확인 후 병합
    let existingData: Partial<TemplateData> = {};
    if (existingId) {
       const raw = await get(`${TEMPLATE_PREFIX}${existingId}`);
       if (raw) existingData = raw as TemplateData;
    }

    const newTemplate: TemplateData = {
      ...existingData,
      id,
      name: template.name || '제목 없는 템플릿',
      imageSrc: template.imageSrc,
      fields: template.fields,
      createdAt: existingData.createdAt || now,
      updatedAt: now
    };

    await set(`${TEMPLATE_PREFIX}${id}`, newTemplate);
    return newTemplate;
  },

  // 특정 템플릿 불러오기
  async getTemplate(id: string): Promise<TemplateData | undefined> {
    return await get(`${TEMPLATE_PREFIX}${id}`);
  },

  // 전체 템플릿 목록 (미리보기 용)
  async getAllTemplates(): Promise<TemplateData[]> {
    const allKeys = await keys();
    const templateKeys = allKeys.filter(key => typeof key === 'string' && key.startsWith(TEMPLATE_PREFIX));
    
    const templates: TemplateData[] = [];
    for (const key of templateKeys) {
      const data = await get(key);
      if (data) templates.push(data as TemplateData);
    }
    
    // Sort by latest updated
    return templates.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  // 템플릿 삭제
  async deleteTemplate(id: string): Promise<void> {
    await del(`${TEMPLATE_PREFIX}${id}`);
  }
};

export const recordStorage = {
  // 작성된 기록 저장 (또는 덮어쓰기)
  async saveRecord(record: Omit<FormRecord, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string): Promise<FormRecord> {
    const id = existingId || uuidv4();
    const now = Date.now();

    let existingData: Partial<FormRecord> = {};
    if (existingId) {
      const raw = await get(`${RECORD_PREFIX}${existingId}`);
      if (raw) existingData = raw as FormRecord;
    }

    const newRecord: FormRecord = {
      ...existingData,
      id,
      templateId: record.templateId,
      templateName: record.templateName,
      fields: record.fields,
      createdAt: existingData.createdAt || now,
      updatedAt: now
    };

    await set(`${RECORD_PREFIX}${id}`, newRecord);
    return newRecord;
  },

  // 특정 기록 불러오기
  async getRecord(id: string): Promise<FormRecord | undefined> {
    return await get(`${RECORD_PREFIX}${id}`);
  },

  // 전체 기록 목록
  async getAllRecords(): Promise<FormRecord[]> {
    const allKeys = await keys();
    const recordKeys = allKeys.filter(key => typeof key === 'string' && key.startsWith(RECORD_PREFIX));

    const records: FormRecord[] = [];
    for (const key of recordKeys) {
      const data = await get(key);
      if (data) records.push(data as FormRecord);
    }

    // 최신 수정순 정렬
    return records.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  // 기록 삭제
  async deleteRecord(id: string): Promise<void> {
    await del(`${RECORD_PREFIX}${id}`);
  }
};

