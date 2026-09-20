import api from './Index';

export interface Material {
  file_name: string;
  processing_status: string;
  publication_status: 'draft' | 'published';
  passage_count: number;
  error_message: string;
  published_at: string | null;
  published_by: string | null;
}

export interface MaterialPreview extends Material {
  passages: string[];
}

export const listMaterials = async (): Promise<Material[]> => (await api.get<Material[]>('/admin/materials')).data;

export const previewMaterial = async (fileName: string): Promise<MaterialPreview> =>
  (await api.get<MaterialPreview>(`/admin/materials/${encodeURIComponent(fileName)}`)).data;

export const setMaterialPublished = async (fileName: string, publish: boolean): Promise<void> => {
  await api.post(`/admin/materials/${publish ? 'publish' : 'unpublish'}`, { file_name: fileName });
};
