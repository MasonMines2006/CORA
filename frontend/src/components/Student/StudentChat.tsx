import { useCallback, useEffect, useState } from 'react';
import { useMessageContext } from '../../context/UserMessages';
import { useCredentials } from '../../context/UserCredentials';
import Chatbot from '../ChatBot/Chatbot';
import ConnectionModal from '../Popups/ConnectionModal/ConnectionModal';
import { envConnectionAPI } from '../../services/ConnectAPI';
import { connectionState } from '../../types';
import { getIsLoading } from '../../utils/Utils';

const suggestedPrompts = [
  'Explain how the PULSTAR reactor achieves criticality',
  'What safety systems are used in the PULSTAR reactor?',
  'Summarize the main components of the PULSTAR reactor core',
  'How does neutron moderation work in the PULSTAR reactor?',
];

interface StudentChatProps {
  externalPrompt?: string;
  onExternalPromptConsumed?: () => void;
}

const StudentChat: React.FC<StudentChatProps> = ({ externalPrompt, onExternalPromptConsumed }) => {
  const { clearHistoryData, messages, setMessages, setClearHistoryData, isDeleteChatLoading } = useMessageContext();
  const { setUserCredentials, setConnectionStatus, connectionStatus, setShowDisconnectButton } = useCredentials();
  const [pendingPrompt, setPendingPrompt] = useState<string>('');
  const [openConnection, setOpenConnection] = useState<connectionState>({
    openPopUp: false,
    chunksExists: false,
    vectorIndexMisMatch: false,
    chunksExistsWithDifferentDimension: false,
  });

  const initialiseConnection = useCallback(async () => {
    try {
      const response = await envConnectionAPI();
      const connectionData = response.data;
      if (connectionData.data && connectionData.status === 'Success') {
        const credentials = {
          uri: connectionData.data.uri,
          isReadonlyUser: !connectionData.data.write_access,
          isgdsActive: connectionData.data.gds_status,
          isGCSActive: connectionData.data.gcs_file_cache === 'True',
          chunksTobeProcess: Number(connectionData.data.chunk_to_be_created),
          email: '',
          connection: 'backendApi',
        };
        setUserCredentials(credentials);
        setConnectionStatus(true);
        setShowDisconnectButton(true);
      } else {
        setOpenConnection((prev) => ({ ...prev, openPopUp: true }));
      }
    } catch {
      // Fall back to URL params
      const urlParams = new URLSearchParams(window.location.search);
      const uri = urlParams.get('uri');
      const user = urlParams.get('user');
      const encodedPassword = urlParams.get('password');
      const database = urlParams.get('database');
      const port = urlParams.get('port');
      if (uri && user && encodedPassword && database && port) {
        setUserCredentials({
          uri,
          userName: user,
          password: atob(atob(encodedPassword)),
          database,
          port,
          email: '',
        });
        setConnectionStatus(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setOpenConnection((prev) => ({ ...prev, openPopUp: true }));
      }
    }
  }, [setUserCredentials, setConnectionStatus, setShowDisconnectButton]);

  useEffect(() => {
    initialiseConnection();
  }, [initialiseConnection]);

  const handleConnectionSuccess = () => {
    setConnectionStatus(true);
    setShowDisconnectButton(true);
    setOpenConnection((prev) => ({ ...prev, openPopUp: false }));
  };

  useEffect(() => {
    if (clearHistoryData) {
      const now = new Date();
      setMessages([
        {
          datetime: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
          id: 2,
          modes: {
            'graph+vector+fulltext': {
              message:
                'Welcome to CORA: the Cognitive Operator Reactor Assistant. You can ask questions related to class material which have been released.',
            },
          },
          user: 'chatbot',
          currentMode: 'graph+vector+fulltext',
        },
      ]);
      setClearHistoryData(false);
    }
  }, [clearHistoryData, setMessages, setClearHistoryData]);

  useEffect(() => {
    if (externalPrompt) {
      setPendingPrompt(externalPrompt);
      onExternalPromptConsumed?.();
    }
  }, [externalPrompt]);

  const handlePromptClick = (prompt: string) => {
    setPendingPrompt(prompt);
  };

  const showEmptyState = messages.length <= 1;

  return (
    <div className='flex h-[calc(100vh-57px)] flex-col'>
      <ConnectionModal
        open={openConnection.openPopUp && !connectionStatus}
        setOpenConnection={setOpenConnection}
        setConnectionStatus={setConnectionStatus}
        isVectorIndexMatch={false}
        chunksExistsWithoutEmbedding={false}
        chunksExistsWithDifferentEmbedding={false}
        onSuccess={handleConnectionSuccess}
        isChatOnly={true}
      />

      {showEmptyState && connectionStatus && (
        <div className='mx-auto w-full max-w-2xl px-6 pt-12 text-center'>
          <h2 className='text-2xl font-semibold tracking-tight text-slate-900'>What would you like to learn?</h2>
          <p className='mt-2 text-sm text-slate-500'>
            Ask a question about the PULSTAR reactor or try one of these suggestions.
          </p>
          <div className='mt-6 flex flex-wrap justify-center gap-2'>
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePromptClick(prompt)}
                className='rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900'
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className='flex-1'>
        <Chatbot
          isFullScreen
          isChatOnly
          messages={messages}
          setMessages={setMessages}
          clear={clearHistoryData}
          isLoading={getIsLoading(messages)}
          connectionStatus={connectionStatus}
          isDeleteChatLoading={isDeleteChatLoading}
          pendingMessage={pendingPrompt}
          onPendingMessageConsumed={() => setPendingPrompt('')}
        />
      </div>
    </div>
  );
};

export default StudentChat;
