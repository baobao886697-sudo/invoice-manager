import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, BarChart3, Settings, CreditCard, Globe, Shield, Lock, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const CORRECT_PASSWORD = "Bao12345678..";
const AUTH_KEY = "invoice_manager_auth";

export function useSimpleAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = localStorage.getItem(AUTH_KEY);
    if (auth === "true") {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = (password: string): boolean => {
    if (password === CORRECT_PASSWORD) {
      localStorage.setItem(AUTH_KEY, "true");
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  return { isAuthenticated, loading, login, logout };
}

export default function Home() {
  const { isAuthenticated, loading, login } = useSimpleAuth();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    setTimeout(() => {
      if (login(password)) {
        toast.success("登录成功！");
        setLocation("/dashboard");
      } else {
        toast.error("密码错误，请重试");
      }
      setIsLoggingIn(false);
    }, 500);
  };

  const features = [
    {
      icon: CreditCard,
      title: "价格表管理",
      description: "灵活管理积分与价格对应关系，支持在线编辑"
    },
    {
      icon: FileText,
      title: "智能账单生成",
      description: "自动计算价格，生成专业收款账单"
    },
    {
      icon: BarChart3,
      title: "数据统计",
      description: "可视化图表展示收款和销售数据"
    },
    {
      icon: Globe,
      title: "多格式导出",
      description: "支持导出PNG图片和文本格式"
    },
    {
      icon: Shield,
      title: "安全可靠",
      description: "密码保护，数据安全有保障"
    },
    {
      icon: Settings,
      title: "个性化设置",
      description: "自定义收款地址和公司信息"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl">云端寻踪</span>
          </div>
        </div>
      </header>

      {/* Hero Section with Login */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Introduction */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                收款账单管理系统
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8">
                专业的积分销售账单生成工具，支持价格表管理、智能价格计算、
                账单生成与导出、历史记录查询和数据统计分析
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <span>价格表管理</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="w-5 h-5 text-primary" />
                  <span>智能账单生成</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <span>数据统计分析</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-5 h-5 text-primary" />
                  <span>多格式导出</span>
                </div>
              </div>
            </div>

            {/* Right: Login Form */}
            <div className="flex justify-center lg:justify-end">
              <Card className="w-full max-w-md shadow-2xl border-0">
                <CardHeader className="text-center pb-2">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl">登录系统</CardTitle>
                  <CardDescription>请输入密码进入管理系统</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">访问密码</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="请输入密码"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      size="lg"
                      disabled={isLoggingIn || !password}
                    >
                      {isLoggingIn ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          登录中...
                        </>
                      ) : (
                        "登录"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">功能特点</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              全面的账单管理功能，满足您的各种需求
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-white">
        <div className="container text-center text-muted-foreground">
          <p>© 2026 云端寻踪搜索助手 - 收款账单管理系统</p>
        </div>
      </footer>
    </div>
  );
}
