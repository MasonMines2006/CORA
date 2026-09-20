import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminMaterials from './AdminMaterials';
import { listMaterials, previewMaterial, setMaterialPublished } from '../../API/Materials';

vi.mock('../../API/Materials', () => ({
  listMaterials: vi.fn(),
  previewMaterial: vi.fn(),
  setMaterialPublished: vi.fn(),
}));

const draft = {
  file_name: 'New topic.pdf',
  processing_status: 'Completed',
  publication_status: 'draft' as const,
  passage_count: 2,
  error_message: '',
  published_at: null,
  published_by: null,
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminMaterials />
    </MemoryRouter>
  );

describe('AdminMaterials', () => {
  beforeEach(() => {
    vi.mocked(listMaterials).mockReset().mockResolvedValue([draft]);
    vi.mocked(previewMaterial)
      .mockReset()
      .mockResolvedValue({ ...draft, passages: ['The new topic is described here.'] });
    vi.mocked(setMaterialPublished).mockReset().mockResolvedValue(undefined);
  });

  it('requires the admin to inspect extracted text before publishing', async () => {
    renderPage();
    expect(await screen.findByText('New topic.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /New topic.pdf/ }));
    expect(await screen.findByText('The new topic is described here.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(setMaterialPublished).toHaveBeenCalledWith('New topic.pdf', true));
  });

  it('disables publication when extraction found no usable passages', async () => {
    vi.mocked(previewMaterial).mockResolvedValue({ ...draft, passage_count: 0, passages: [] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /New topic.pdf/ }));
    expect(await screen.findByText(/needs OCR/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });
});
