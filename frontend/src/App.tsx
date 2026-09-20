import { Route, Routes } from 'react-router-dom';
import ChatOnlyComponent from './components/ChatBot/ChatOnlyComponent';
import { AuthenticationGuard, StudentGuard } from './components/Auth/Auth';
import Callback from './components/Auth/Callback';
import Home from './Home';
import Landing from './components/Landing/Landing';
import StudentApp from './components/Student/StudentApp';
import AdminMaterials from './components/Admin/AdminMaterials';
import { SKIP_AUTH } from './utils/Constants.ts';

const App = () => {
  return (
    <Routes>
      <Route path='/' element={<Landing />} />
      <Route path='/app' element={SKIP_AUTH ? <Home /> : <AuthenticationGuard component={Home} />} />
      <Route
        path='/admin'
        element={SKIP_AUTH ? <AdminMaterials /> : <AuthenticationGuard component={AdminMaterials} />}
      />
      <Route path='/callback' element={<Callback />} />
      <Route path='/student' element={SKIP_AUTH ? <StudentApp /> : <StudentGuard component={StudentApp} />} />
      <Route path='/chat-only' element={<ChatOnlyComponent />} />
    </Routes>
  );
};
export default App;
