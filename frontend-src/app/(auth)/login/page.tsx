'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const encoded = btoa(`${username}:${password}`);
      const response = await api.get('/myself', {
        headers: { 'X-Jira-Auth': encoded },
      });
      saveAuth(username, password, response.data);
      router.replace('/board');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number } };
      if (axiosErr.response?.status === 401) {
        setError('Invalid username or password. Please try again.');
      } else {
        setError('Cannot connect to Jira server. Check your network.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#0052CC] mb-3">
            <span className="text-white font-bold text-xl">J</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#172B4D]">Jira Power UI</h1>
          <p className="text-sm text-[#5E6C84] mt-1">Log in with your Jira account</p>
        </div>

        <Card className="border-0 shadow-md">
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-[#172B4D] text-sm font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. SangNT"
                  required
                  className="border-[#DFE1E6] focus:border-[#0052CC]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[#172B4D] text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your Jira password"
                  required
                  className="border-[#DFE1E6] focus:border-[#0052CC]"
                />
              </div>

              {error && (
                <div className="rounded-sm bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0052CC] hover:bg-[#0065FF] text-white font-medium h-9 rounded-sm"
              >
                {loading ? 'Logging in…' : 'Log in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-[#5E6C84] mt-4">
          Connecting to <span className="font-medium">task.ascvn.com.vn</span>
        </p>
      </div>
    </div>
  );
}
