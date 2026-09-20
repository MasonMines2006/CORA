import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMaterials, Material, MaterialPreview, previewMaterial, setMaterialPublished } from '../../API/Materials';

const messageFromError = (error: unknown): string =>
  (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
  'The request failed. Please try again.';

/** Review extracted passages before making a source available to students. */
const AdminMaterials = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selected, setSelected] = useState<MaterialPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    const items = await listMaterials();
    setMaterials(items);
    if (selected) {
      setSelected(await previewMaterial(selected.file_name));
    }
  };

  useEffect(() => {
    let active = true;
    listMaterials()
      .then((items) => {
        if (active) {
          setMaterials(items);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(messageFromError(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const inspect = async (fileName: string) => {
    setError('');
    try {
      setSelected(await previewMaterial(fileName));
    } catch (requestError) {
      setError(messageFromError(requestError));
    }
  };

  const changePublication = async (publish: boolean) => {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setMaterialPublished(selected.file_name, publish);
      await refresh();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className='min-h-screen bg-stone-50 px-6 py-10 text-slate-900'>
      <div className='mx-auto max-w-6xl'>
        <header className='mb-8 flex flex-wrap items-center justify-between gap-4'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-wider text-red-600'>CORA administration</p>
            <h1 className='mt-1 text-3xl font-bold'>Materials</h1>
            <p className='mt-2 text-sm text-slate-600'>Review extracted passages, then publish sources for students.</p>
          </div>
          <Link to='/app' className='rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white'>
            Upload in workspace
          </Link>
        </header>

        {error && (
          <p role='alert' className='mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {error}
          </p>
        )}
        <div className='grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]'>
          <section aria-label='Uploaded materials' className='rounded-2xl border border-stone-200 bg-white p-5'>
            <h2 className='mb-4 text-lg font-semibold'>Uploaded material</h2>
            {loading && <p className='text-sm text-slate-500'>Loading materials…</p>}
            {!loading && materials.length === 0 && (
              <p className='text-sm text-slate-500'>No materials have been uploaded yet.</p>
            )}
            <ul className='divide-y divide-stone-100'>
              {materials.map((material) => (
                <li key={material.file_name}>
                  <button
                    type='button'
                    onClick={() => inspect(material.file_name)}
                    className='flex w-full items-center justify-between gap-4 py-4 text-left hover:text-red-700'
                    aria-current={selected?.file_name === material.file_name ? 'true' : undefined}
                  >
                    <span className='min-w-0'>
                      <span className='block truncate font-medium'>{material.file_name}</span>
                      <span className='text-xs text-slate-500'>
                        {material.passage_count} passages · {material.processing_status}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${material.publication_status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
                    >
                      {material.publication_status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label='Material review' className='rounded-2xl border border-stone-200 bg-white p-5'>
            {!selected && <p className='text-sm text-slate-500'>Select a material to inspect its extracted text.</p>}
            {selected && (
              <>
                <h2 className='break-words text-lg font-semibold'>{selected.file_name}</h2>
                <p className='mt-2 text-sm text-slate-600'>
                  {selected.processing_status} · {selected.passage_count} passages
                </p>
                {selected.error_message && (
                  <p className='mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700'>{selected.error_message}</p>
                )}
                {selected.passage_count === 0 && (
                  <p className='mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800'>
                    No text was extracted. Check whether this file needs OCR.
                  </p>
                )}
                <h3 className='mt-6 text-sm font-semibold'>Passage preview</h3>
                <div className='mt-2 max-h-96 space-y-3 overflow-auto'>
                  {selected.passages.map((passage, index) => (
                    <p
                      key={index}
                      className='whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-slate-700'
                    >
                      {passage}
                    </p>
                  ))}
                </div>
                <div className='mt-6 flex gap-3'>
                  {selected.publication_status === 'published' ? (
                    <button
                      type='button'
                      disabled={busy}
                      onClick={() => changePublication(false)}
                      className='rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-700 disabled:opacity-50'
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      type='button'
                      disabled={busy || selected.processing_status !== 'Completed' || selected.passage_count === 0}
                      onClick={() => changePublication(true)}
                      className='rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50'
                    >
                      Publish
                    </button>
                  )}
                </div>
                {selected.published_at && (
                  <p className='mt-4 text-xs text-slate-500'>
                    Published {new Date(selected.published_at).toLocaleString()}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default AdminMaterials;
