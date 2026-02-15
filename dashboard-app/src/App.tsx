import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ChatPage } from './pages/ChatPage';
import { TraderDashboard } from './pages/TraderDashboard';
import { ObservabilityDashboard } from './pages/ObservabilityDashboard';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<ChatPage key="farmer-chat" />} />
          <Route path="/trader" element={<TraderDashboard />} />
          <Route path="/trader/chat" element={<ChatPage key="trader-chat" />} />
          <Route path="/observability" element={<ObservabilityDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
