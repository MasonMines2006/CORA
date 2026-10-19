import { Route, Routes } from 'react-router-dom';
import ChatOnlyComponent from './components/ChatBot/ChatOnlyComponent';
import { AuthenticationGuard, StudentGuard } from './components/Auth/Auth';
import SignInPage from './components/Auth/SignInPage';
import JoinPage from './components/Auth/JoinPage';
import ResetPage from './components/Auth/ResetPage';
import ChangePasswordPage from './components/Auth/ChangePasswordPage';
import UsersAdmin from './components/admin-users/UsersAdmin';
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
      <Route
        path='/admin/users'
        element={SKIP_AUTH ? <UsersAdmin /> : <AuthenticationGuard component={UsersAdmin} />}
      />
      {/* In-house sign-in (backend/src/local_auth). */}
      <Route path='/signin' element={<SignInPage />} />
      <Route path='/join' element={<JoinPage />} />
      <Route path='/join/:token' element={<JoinPage />} />
      <Route path='/reset' element={<ResetPage />} />
      <Route path='/reset/:token' element={<ResetPage />} />
      <Route path='/account/password' element={<ChangePasswordPage />} />
      <Route path='/student' element={SKIP_AUTH ? <StudentApp /> : <StudentGuard component={StudentApp} />} />
      <Route path='/chat-only' element={<ChatOnlyComponent />} />
    </Routes>
  );
};
export default App;
