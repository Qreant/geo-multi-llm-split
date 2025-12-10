import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NewReportPage from './pages/NewReportPage';
import ReportDetailPage from './pages/ReportDetailPage';
import SharedReportPage from './pages/SharedReportPage';
import { BarChart3, Plus, FileText } from 'lucide-react';

function Navigation() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="flex items-center space-x-2">
      <Link
        to="/"
        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
          isActive('/')
            ? 'bg-[#10B981] text-white'
            : 'text-[#757575] hover:text-[#212121] hover:bg-white'
        }`}
      >
        <FileText className="inline w-4 h-4 mr-1" />
        Reports
      </Link>
      <Link
        to="/new"
        className="px-4 py-2 text-sm font-medium text-white bg-[#10B981] hover:bg-[#059669] rounded transition-colors inline-flex items-center"
      >
        <Plus className="w-4 h-4 mr-1" />
        New Report
      </Link>
    </nav>
  );
}

function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      {/* Header - Social Analytics Style */}
      <header className="bg-white border-b border-[#E0E0E0]" style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#10B981] rounded-md flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#212121]">
                  GEO Multi-LLM Analysis
                </h1>
                <p className="text-xs text-[#757575]">Brand Monitoring Dashboard</p>
              </div>
            </Link>

            <Navigation />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E0E0E0] mt-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#757575]">
              GEO Multi-LLM Brand Analysis v1.0
            </p>
            <p className="text-xs text-[#9E9E9E]">
              Powered by Gemini 2.0 & OpenAI GPT-4
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Shared report page - renders outside main layout */}
        <Route path="/share/:token" element={<SharedReportPage />} />

        {/* All other pages use main layout */}
        <Route path="/*" element={
          <MainLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/new" element={<NewReportPage />} />
              <Route path="/report/:reportId" element={<ReportDetailPage />} />
            </Routes>
          </MainLayout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
