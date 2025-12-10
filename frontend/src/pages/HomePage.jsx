import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { FileText, Clock, CheckCircle, XCircle, Loader, TrendingUp, Activity, BarChart2 } from 'lucide-react';

export default function HomePage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
  });

  useEffect(() => {
    fetchReports();
  }, []);

  // Auto-refresh when there are processing reports
  useEffect(() => {
    if (stats.processing > 0) {
      const interval = setInterval(() => {
        fetchReports();
      }, 3000); // Refresh every 3 seconds
      return () => clearInterval(interval);
    }
  }, [stats.processing]);

  const fetchReports = async (showLoading = true) => {
    try {
      if (showLoading && reports.length === 0) {
        setLoading(true);
      }
      const response = await api.get('/api/reports');
      const fetchedReports = response.data.reports;
      setReports(fetchedReports);

      // Calculate stats
      const newStats = {
        total: fetchedReports.length,
        completed: fetchedReports.filter(r => r.status === 'completed').length,
        processing: fetchedReports.filter(r => r.status === 'processing').length,
        failed: fetchedReports.filter(r => r.status === 'failed').length,
      };
      setStats(newStats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      await api.delete(`/api/reports/${reportId}`);
      fetchReports();
    } catch (err) {
      alert(`Error deleting report: ${err.message}`);
    }
  };

  const getStatusBadge = (status, progress) => {
    const badges = {
      completed: {
        color: 'bg-[#E8F5E9] text-[#4CAF50]',
        icon: CheckCircle,
        label: 'Completed'
      },
      processing: {
        color: 'bg-[#E3F2FD] text-[#2196F3]',
        icon: Loader,
        label: progress ? `Processing ${progress}%` : 'Processing'
      },
      failed: {
        color: 'bg-[#FFEBEE] text-[#EF5350]',
        icon: XCircle,
        label: 'Failed'
      }
    };

    const badge = badges[status] || badges.processing;
    const Icon = badge.icon;

    return (
      <div className="flex flex-col">
        <span className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium ${badge.color}`}>
          <Icon className={`w-3 h-3 mr-1.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
          {badge.label}
        </span>
        {status === 'processing' && progress > 0 && (
          <div className="w-full bg-[#E0E0E0] rounded-full h-1 mt-1">
            <div
              className="bg-[#2196F3] h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-base border-[#EF5350]">
        <div className="flex items-center">
          <XCircle className="w-5 h-5 text-[#EF5350] mr-3" />
          <p className="text-[#EF5350] font-medium">Error loading reports: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Action */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xxl font-bold text-[#212121] mb-2">Reports Dashboard</h2>
          <p className="text-sm text-[#757575]">
            Monitor and analyze your brand performance across AI search engines
          </p>
        </div>

        <Link
          to="/new"
          className="btn-primary inline-flex items-center"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Create New Report
        </Link>
      </div>

      {/* Metric Cards - Social Analytics Pattern */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Reports Metric */}
        <div className="card-base">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#E3F2FD] flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-[#2196F3]" />
            </div>
            <p className="text-sm text-[#757575] mb-1">Total Reports</p>
            <p className="metric-value">{stats.total}</p>
          </div>
        </div>

        {/* Completed Metric */}
        <div className="card-base">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6 text-[#4CAF50]" />
            </div>
            <p className="text-sm text-[#757575] mb-1">Completed</p>
            <p className="metric-value text-[#4CAF50]">{stats.completed}</p>
          </div>
        </div>

        {/* Processing Metric */}
        <div className="card-base">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#E3F2FD] flex items-center justify-center mb-3">
              <Activity className="w-6 h-6 text-[#2196F3]" />
            </div>
            <p className="text-sm text-[#757575] mb-1">Processing</p>
            <p className="metric-value text-[#2196F3]">{stats.processing}</p>
          </div>
        </div>

        {/* Failed Metric */}
        <div className="card-base">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#FFEBEE] flex items-center justify-center mb-3">
              <XCircle className="w-6 h-6 text-[#EF5350]" />
            </div>
            <p className="text-sm text-[#757575] mb-1">Failed</p>
            <p className="metric-value text-[#EF5350]">{stats.failed}</p>
          </div>
        </div>
      </div>

      {/* Reports List - Dashboard Card */}
      {reports.length === 0 ? (
        <div className="card-base text-center py-12">
          <BarChart2 className="w-16 h-16 text-[#E0E0E0] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#212121] mb-2">No reports yet</h3>
          <p className="text-[#757575] mb-6">Get started by creating your first brand analysis report</p>
          <Link
            to="/new"
            className="btn-primary inline-flex items-center"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Create First Report
          </Link>
        </div>
      ) : (
        <div className="card-base">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-[#212121]">Recent Reports</h3>
            <p className="text-sm text-[#757575]">{reports.length} total</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#E0E0E0]">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#757575] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-[#F4F6F8] transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[#212121]">{report.entity}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#757575]">{report.category}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getStatusBadge(report.status, report.progress)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-[#757575]">
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-1.5 text-[#9E9E9E]" />
                        {format(new Date(report.created_at), 'MMM d, yyyy HH:mm')}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-[#757575]">
                      {report.execution_time ? `${report.execution_time}s` : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/report/${report.id}`}
                        className="text-[#2196F3] hover:text-[#1976D2] mr-4 transition-colors"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => deleteReport(report.id)}
                        className="text-[#EF5350] hover:text-[#D32F2F] transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
