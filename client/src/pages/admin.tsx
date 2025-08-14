import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  ClipboardList, 
  Bot, 
  TrendingUp,
  Eye,
  Download,
  Filter,
  Plus
} from "lucide-react";

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["/api/admin/sessions"],
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-600 text-sm">IELTS Test Management Platform</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create New Test
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Results
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Active Tests</p>
                  <p className="text-2xl font-bold text-slate-900">{sessions.filter(s => s.status === 'in_progress').length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-green-600">+12% from last week</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">AI Evaluations</p>
                  <p className="text-2xl font-bold text-slate-900">{sessions.filter(s => s.status === 'completed').length * 2}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Bot className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-green-600">+8% accuracy improvement</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Average Band Score</p>
                  <p className="text-2xl font-bold text-slate-900">6.8</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-slate-600">0.2 points above target</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900">{sessions.length}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-purple-600">Active platform users</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Sessions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Test Sessions</CardTitle>
              <div className="flex items-center space-x-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter tests..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tests</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Filter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Session ID</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Test Type</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Progress</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Band Score</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {sessions.slice(0, 10).map((session: any) => (
                    <tr key={session.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                          {session.id.slice(0, 8)}...
                        </code>
                      </td>
                      <td className="py-3 px-4 capitalize">{session.testType || 'academic'}</td>
                      <td className="py-3 px-4">
                        {new Date(session.startTime).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-slate-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                session.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                              }`}
                              style={{ 
                                width: session.status === 'completed' ? '100%' : '75%'
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-600">
                            {session.status === 'completed' ? 'Complete' : '75%'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {session.overallBand ? (
                          <span className="font-semibold text-primary">
                            {session.overallBand}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          variant={
                            session.status === 'completed' ? 'default' : 
                            session.status === 'in_progress' ? 'secondary' : 'outline'
                          }
                          className={
                            session.status === 'completed' ? 'bg-green-100 text-green-800' :
                            session.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : ''
                          }
                        >
                          {session.status?.replace('_', ' ') || 'in progress'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
