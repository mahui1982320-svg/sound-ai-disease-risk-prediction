import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import AlarmsList from "./AlarmsList";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-50">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">养老院智能报警管理系统</h1>
          <p className="text-lg text-gray-600 mb-8">为居家老人提供24小时安全监护</p>
          <a
            href={`/api/oauth/login`}
            className="inline-block px-8 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
          >
            登录系统
          </a>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <AlarmsList />
    </DashboardLayout>
  );
}
