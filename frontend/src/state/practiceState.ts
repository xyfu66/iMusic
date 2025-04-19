import { atom } from 'recoil';

export interface PracticeData {
  useUrl: string;
  fileInfo: any;
  fileContent?: string;
  midiContent?: string;
  audioContent?: string;
  fileUrl?: string;
  midiUrl?: string;
  audioUrl?: string;
}

export const practiceState = atom<PracticeData | null>({
  key: 'practiceState', // 唯一的 key
  default: null, // 默认值
});