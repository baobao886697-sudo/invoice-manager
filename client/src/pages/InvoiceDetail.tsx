import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Copy, Check, Loader2, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import html2canvas from "html2canvas";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({ id: parseInt(id || "0") });

  const updateStatusMutation = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => {
      utils.invoices.getById.invalidate({ id: parseInt(id || "0") });
      utils.invoices.list.invalidate();
      utils.invoices.getStats.invalidate();
      toast.success("状态更新成功");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });

  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("账单删除成功");
      setLocation("/invoice/history");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (invoice) {
      updateStatusMutation.mutate({
        id: invoice.id,
        status: newStatus as "pending" | "paid" | "cancelled",
      });
    }
  };

  const handleDelete = () => {
    if (invoice) {
      deleteMutation.mutate({ id: invoice.id });
    }
  };

  const handleExportImage = async () => {
    if (!invoiceRef.current) return;

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${invoice?.invoiceNumber || "invoice"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("图片导出成功");
    } catch (error) {
      toast.error("导出失败");
    }
  };

  const generateTextVersion = () => {
    if (!invoice) return "";

    const date = new Date(invoice.createdAt).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Sort items by price descending
    const sortedItems = [...(invoice.items || [])].sort(
      (a, b) => Number(b.price) - Number(a.price)
    );

    let text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 云端寻踪搜索助手 - 收款账单
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 订单详情

客户编号：${invoice.invoiceNumber}
订单日期：${date}
订单状态：${invoice.status === "paid" ? "已付款" : invoice.status === "pending" ? "待付款" : "已取消"}

➖➖➖➖➖➖➖➖➖➖➖➖➖➖

📦 购买明细

┌─────────────────────────────────┐
│ 序号 │ 商品名称      │ 金额(USDT) │
├─────────────────────────────────┤
`;

    sortedItems.forEach((item, index) => {
      const credits = item.credits;
      const creditsStr = credits >= 10000 ? `${credits / 10000}万` : credits.toString();
      text += `│  ${index + 1}   │ ${creditsStr}积分套餐  │   ${Number(item.price).toFixed(0)}   │\n`;
    });

    text += `└─────────────────────────────────┘

💰 费用汇总
━━━━━━━━━━━━━━━━━━━━
商品小计：    ${Number(invoice.totalAmount).toFixed(0)} USDT
━━━━━━━━━━━━━━━━━━━━
应付总额：    ${Number(invoice.totalAmount).toFixed(0)} USDT
━━━━━━━━━━━━━━━━━━━━

➖➖➖➖➖➖➖➖➖➖➖➖➖➖

👩‍💼 您正在使用 USDT-TRC20 付款

💳 收款信息
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
收款网络：USDT-TRC20
收款地址：

${invoice.walletAddress}

付款金额：  ${Number(invoice.totalAmount).toFixed(0)} USDT
到账金额：  ${Number(invoice.totalAmount).toFixed(0)} USDT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👆 点击复制钱包地址

➖➖➖➖➖➖➖➖➖➖➖➖➖➖

⚠️ 温馨提示
• 请确保转账网络为 TRC20，其他网络转账将无法到账
• 转账金额请与应付金额保持一致
• 付款完成后请保留交易凭证
• 积分将在确认到账后24小时内充值到您的账户

📞 如有疑问，请联系客服

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
感谢您选择云端寻踪搜索助手！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return text;
  };

  const handleCopyText = async () => {
    const text = generateTextVersion();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("文本已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("复制失败");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">已付款</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">待付款</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">已取消</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">账单不存在</p>
          <Button onClick={() => setLocation("/invoice/history")}>返回列表</Button>
        </div>
      </DashboardLayout>
    );
  }

  const date = new Date(invoice.createdAt).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Sort items by price descending
  const sortedItems = [...(invoice.items || [])].sort(
    (a, b) => Number(b.price) - Number(a.price)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/invoice/history")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <p className="text-muted-foreground">
                创建于 {new Date(invoice.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={invoice.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">待付款</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportImage}>
              <Download className="w-4 h-4 mr-2" />
              导出图片
            </Button>
            <Button variant="outline" onClick={handleCopyText}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              复制文本
            </Button>
            <Button variant="destructive" size="icon" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Invoice Info */}
          <Card>
            <CardHeader>
              <CardTitle>账单信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">订单编号</p>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">状态</p>
                  <div className="mt-1">{getStatusBadge(invoice.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总积分</p>
                  <p className="font-medium">{invoice.totalCredits.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总金额</p>
                  <p className="font-bold text-primary text-lg">
                    ${Number(invoice.totalAmount).toLocaleString()} USDT
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2">购买明细</p>
                <div className="space-y-2">
                  {sortedItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {item.credits >= 10000
                            ? `${item.credits / 10000}万`
                            : item.credits.toLocaleString()}{" "}
                          积分套餐
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.credits.toLocaleString()} 积分
                        </p>
                      </div>
                      <p className="font-bold text-primary">${Number(item.price).toFixed(0)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2">收款地址</p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm break-all font-mono">{invoice.walletAddress}</p>
                </div>
              </div>

              {invoice.customerNote && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">备注</p>
                    <p className="text-sm">{invoice.customerNote}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Invoice Preview */}
          <Card>
            <CardHeader>
              <CardTitle>账单预览</CardTitle>
              <CardDescription>可导出为图片或复制文本</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                ref={invoiceRef}
                className="invoice-preview bg-white rounded-lg overflow-hidden shadow-lg"
                style={{ maxWidth: "400px", margin: "0 auto" }}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      🌐
                    </div>
                    <span className="text-xl font-bold">云端寻踪搜索助手</span>
                  </div>
                  <p className="text-sm opacity-90">收款账单 / Payment Invoice</p>
                </div>

                {/* Order Info */}
                <div className="p-6">
                  <div className="flex justify-between text-sm mb-6">
                    <div>
                      <p className="text-gray-500">订单编号</p>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">订单日期</p>
                      <p className="font-medium">{date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500">订单状态</p>
                      <p
                        className={`font-medium ${
                          invoice.status === "paid"
                            ? "text-green-600"
                            : invoice.status === "pending"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {invoice.status === "paid"
                          ? "✅ 已付款"
                          : invoice.status === "pending"
                          ? "⏳ 待付款"
                          : "❌ 已取消"}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-5 bg-yellow-500 rounded"></div>
                      <span className="font-bold">购买明细</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 text-gray-500">序号</th>
                          <th className="text-left py-2 text-gray-500">商品名称</th>
                          <th className="text-left py-2 text-gray-500">积分数量</th>
                          <th className="text-right py-2 text-gray-500">金额 (USDT)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedItems.map((item, index) => (
                          <tr key={item.id} className="border-b">
                            <td className="py-3">{index + 1}</td>
                            <td className="py-3">积分充值套餐</td>
                            <td className="py-3">{item.credits.toLocaleString()}</td>
                            <td className="py-3 text-right text-indigo-600 font-bold">
                              {Number(item.price).toFixed(0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">商品小计</span>
                      <span>{Number(invoice.totalAmount).toFixed(0)} USDT</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">优惠折扣</span>
                      <span>- 0 USDT</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold text-lg">
                      <span>应付总额</span>
                      <span className="text-indigo-600">
                        {Number(invoice.totalAmount).toFixed(0)} USDT
                      </span>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="bg-indigo-50 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-indigo-600">💳</span>
                      <span className="font-medium text-indigo-600">USDT-TRC20 付款信息</span>
                    </div>
                    <div className="bg-white rounded p-3 mb-3">
                      <p className="text-xs text-gray-500 break-all">{invoice.walletAddress}</p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <div>
                        <p className="text-gray-500">付款金额</p>
                        <p className="text-indigo-600 font-bold text-lg">
                          {Number(invoice.totalAmount).toFixed(0)} USDT
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500">到账金额</p>
                        <p className="text-green-600 font-bold text-lg">
                          {Number(invoice.totalAmount).toFixed(0)} USDT
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-700">⚠️ 温馨提示:</p>
                    <p>• 请确保转账网络为 TRC20，其他网络转账将无法到账</p>
                    <p>• 转账金额请与应付金额保持一致</p>
                    <p>• 付款完成后请保留交易凭证</p>
                    <p>• 积分将在确认到账后24小时内充值到您的账户</p>
                  </div>

                  {/* Footer */}
                  <div className="text-center mt-6 text-sm text-gray-400">
                    ✨ 感谢您选择云端寻踪搜索助手！ ✨
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除账单 {invoice.invoiceNumber} 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
