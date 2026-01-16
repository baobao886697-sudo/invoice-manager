import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, DollarSign, CreditCard, TrendingUp, Clock } from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.invoices.getStats.useQuery();
  const { data: recentInvoices } = trpc.invoices.list.useQuery({ limit: 5 });

  const statCards = [
    {
      title: "总收款金额",
      value: stats ? `$${stats.totalAmount.toLocaleString()}` : "-",
      description: "USDT",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "总积分销售",
      value: stats ? stats.totalCredits.toLocaleString() : "-",
      description: "积分",
      icon: CreditCard,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "账单总数",
      value: stats ? stats.invoiceCount.toString() : "-",
      description: "份账单",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "待付款",
      value: stats ? stats.pendingCount.toString() : "-",
      description: "份待处理",
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">欢迎回来，管理员</h1>
            <p className="text-muted-foreground">这是您的账单管理仪表板</p>
          </div>
          <Button onClick={() => setLocation("/invoice/new")} className="gap-2">
            <Plus className="w-4 h-4" />
            创建新账单
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions & Recent Invoices */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
              <CardDescription>常用功能入口</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => setLocation("/invoice/new")}
              >
                <Plus className="w-6 h-6" />
                <span>创建账单</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => setLocation("/price-tiers")}
              >
                <CreditCard className="w-6 h-6" />
                <span>价格表管理</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => setLocation("/invoice/history")}
              >
                <FileText className="w-6 h-6" />
                <span>账单历史</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => setLocation("/statistics")}
              >
                <TrendingUp className="w-6 h-6" />
                <span>数据统计</span>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>最近账单</CardTitle>
                <CardDescription>最近创建的账单记录</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/invoice/history")}>
                查看全部
              </Button>
            </CardHeader>
            <CardContent>
              {recentInvoices?.invoices && recentInvoices.invoices.length > 0 ? (
                <div className="space-y-3">
                  {recentInvoices.invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => setLocation(`/invoice/${invoice.id}`)}
                    >
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(invoice.createdAt).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${Number(invoice.totalAmount).toLocaleString()}</p>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            invoice.status === "paid"
                              ? "bg-green-100 text-green-700"
                              : invoice.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {invoice.status === "paid"
                            ? "已付款"
                            : invoice.status === "pending"
                            ? "待付款"
                            : "已取消"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无账单记录</p>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => setLocation("/invoice/new")}
                  >
                    创建第一个账单
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
