import { useAuth0 } from '@auth0/auth0-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const Callback = () => {
  const { isLoading, error } = useAuth0();
  const navigate = useNavigate();
  const errorDetails = useMemo(() => {
    if (!error) {
      return null;
    }
    return {
      name: error.name,
      message: error.message,
      cause: (error as Error & { cause?: unknown }).cause,
    };
  }, [error]);

  if (error) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-red-600'>
        <div className='space-y-3'>
          <div>Authentication failed. Please try signing in again.</div>
          {errorDetails && (
            <pre className='max-w-xl whitespace-pre-wrap rounded-xl bg-red-50 px-4 py-3 text-left text-xs text-red-700'>
              {JSON.stringify(errorDetails, null, 2)}
            </pre>
          )}
          <button
            onClick={() => navigate('/app')}
            className='rounded-full bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-red-200 hover:bg-red-700'
          >
            Dev bypass → App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-slate-500'>
      <div className='space-y-3'>
        <div>{isLoading ? 'Signing you in…' : 'Finishing sign-in…'}</div>
        <button
          onClick={() => navigate('/app')}
          className='rounded-full bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-red-200 hover:bg-red-700'
        >
          Dev bypass → App
        </button>
      </div>
    </div>
  );
};

export default Callback;
