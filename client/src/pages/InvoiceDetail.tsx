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
  const [isExporting, setIsExporting] = useState(false);
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
    if (!invoiceRef.current || isExporting) return;

    setIsExporting(true);
    try {
      // Wait for any images to load
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 15000,
        foreignObjectRendering: false,
        removeContainer: true,
        width: 420,
        onclone: (clonedDoc) => {
          // Remove all stylesheets from cloned document to avoid oklch issues
          const stylesheets = clonedDoc.querySelectorAll('link[rel="stylesheet"], style');
          stylesheets.forEach(sheet => {
            if (sheet.parentNode) {
              sheet.parentNode.removeChild(sheet);
            }
          });
          
          // Add basic reset styles
          const resetStyle = clonedDoc.createElement('style');
          resetStyle.textContent = `
            * { 
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
          `;
          clonedDoc.head.appendChild(resetStyle);
        }
      });
      
      // Convert to blob and create download link
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `${invoice?.invoiceNumber || "invoice"}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success("图片导出成功");
        } else {
          toast.error("导出失败：无法生成图片");
        }
      }, 'image/png', 1.0);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("导出失败：" + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsExporting(false);
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
            <Select
              value={invoice.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">待付款</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportImage} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
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
                  <p className="font-medium text-primary">${Number(invoice.totalAmount).toFixed(0)} USDT</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2">购买明细</p>
                <div className="space-y-2">
                  {sortedItems.map((item, index) => {
                    const credits = item.credits;
                    const creditsStr = credits >= 10000 ? `${credits / 10000}万` : credits.toLocaleString();
                    return (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <p className="font-medium">{creditsStr} 积分套餐</p>
                          <p className="text-sm text-muted-foreground">{credits.toLocaleString()} 积分</p>
                        </div>
                        <p className="font-medium text-primary">${Number(item.price).toFixed(0)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2">收款地址</p>
                <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
                  {invoice.walletAddress}
                </div>
              </div>
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
                style={{ 
                  width: "420px", 
                  minWidth: "420px",
                  margin: "0 auto",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 4px 20px -5px rgba(0, 0, 0, 0.1)"
                }}
              >
                {/* Header */}
                <div style={{ 
                  background: "linear-gradient(135deg, #5a67d8 0%, #6b46c1 50%, #805ad5 100%)",
                  padding: "28px 24px",
                  textAlign: "center",
                  color: "#ffffff"
                }}>
                  <div style={{ 
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    marginBottom: "8px"
                  }}>
                    <div style={{ 
                      width: "40px", 
                      height: "40px", 
                      background: "rgba(255,255,255,0.2)", 
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 15px rgba(255,255,255,0.3), 0 0 30px rgba(255,255,255,0.15)"
                    }}>
                      <span style={{ fontSize: "22px", filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))" }}>🌐</span>
                    </div>
                    <h2 style={{ fontSize: "22px", fontWeight: "bold", color: "#ffffff", margin: 0 }}>云端寻踪搜索助手</h2>
                  </div>
                  <p style={{ fontSize: "14px", opacity: 0.9, color: "#ffffff", margin: 0 }}>收款账单 / Payment Invoice</p>
                </div>

                {/* Content */}
                <div style={{ padding: "20px", backgroundColor: "#ffffff" }}>
                  {/* Order Info */}
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    marginBottom: "16px",
                    fontSize: "13px"
                  }}>
                    <div>
                      <p style={{ color: "#666666", marginBottom: "2px" }}>订单编号</p>
                      <p style={{ fontWeight: "600", color: "#333333" }}>{invoice.invoiceNumber}</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ color: "#666666", marginBottom: "2px" }}>订单日期</p>
                      <p style={{ fontWeight: "600", color: "#333333" }}>{date}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#666666", marginBottom: "2px" }}>订单状态</p>
                      <p style={{ 
                        fontWeight: "600", 
                        color: invoice.status === "paid" ? "#16a34a" : invoice.status === "pending" ? "#ca8a04" : "#dc2626",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "4px"
                      }}>
                        {invoice.status === "paid" ? (
                          <><span style={{ color: "#16a34a" }}>✓</span> 已付款</>
                        ) : invoice.status === "pending" ? (
                          <><span style={{ 
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "16px",
                            height: "16px",
                            background: "#fef3c7",
                            border: "1.5px solid #f59e0b",
                            borderRadius: "3px",
                            fontSize: "10px",
                            color: "#92400e"
                          }}>✓</span> 待付款</>
                        ) : (
                          "已取消"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ fontWeight: "600", marginBottom: "8px", fontSize: "14px", color: "#333333", borderLeft: "3px solid #f59e0b", paddingLeft: "8px" }}>购买明细</p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
                      <thead>
                        <tr style={{ background: "#f3f4f6" }}>
                          <th style={{ padding: "8px 6px", textAlign: "center", color: "#666666", fontWeight: "500", width: "40px", whiteSpace: "nowrap" }}>序号</th>
                          <th style={{ padding: "8px 6px", textAlign: "left", color: "#666666", fontWeight: "500", width: "120px", whiteSpace: "nowrap" }}>商品名称</th>
                          <th style={{ padding: "8px 6px", textAlign: "right", color: "#666666", fontWeight: "500", width: "90px", whiteSpace: "nowrap" }}>积分数量</th>
                          <th style={{ padding: "8px 6px", textAlign: "right", color: "#666666", fontWeight: "500", width: "90px", whiteSpace: "nowrap" }}>金额(USDT)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedItems.map((item, index) => {
                          const credits = item.credits;
                          return (
                            <tr key={index} style={{ borderTop: "1px solid #e5e7eb" }}>
                              <td style={{ padding: "10px 6px", color: "#333333", textAlign: "center" }}>{index + 1}</td>
                              <td style={{ padding: "10px 6px", color: "#333333", whiteSpace: "nowrap" }}>积分充值套餐</td>
                              <td style={{ padding: "10px 6px", textAlign: "right", color: "#333333" }}>{credits.toLocaleString()}</td>
                              <td style={{ padding: "10px 6px", textAlign: "right", color: "#7c3aed", fontWeight: "600" }}>{Number(item.price).toFixed(0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div style={{ 
                    background: "#f9fafb", 
                    borderRadius: "8px", 
                    padding: "12px",
                    marginBottom: "16px",
                    fontSize: "13px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#666666" }}>商品小计</span>
                      <span style={{ color: "#333333" }}>{Number(invoice.totalAmount).toFixed(0)} USDT</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#666666" }}>优惠折扣</span>
                      <span style={{ color: "#333333" }}>- 0 USDT</span>
                    </div>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      paddingTop: "10px",
                      borderTop: "1px solid #e5e7eb",
                      fontWeight: "bold"
                    }}>
                      <span style={{ color: "#333333", fontSize: "14px" }}>应付总额</span>
                      <span style={{ color: "#7c3aed", fontSize: "18px", fontWeight: "700" }}>{Number(invoice.totalAmount).toFixed(0)} USDT</span>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div style={{ 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px", 
                    padding: "12px",
                    marginBottom: "16px"
                  }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "8px",
                      marginBottom: "12px",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#333333"
                    }}>
                      <span>💳</span>
                      <span>USDT-TRC20 付款信息</span>
                    </div>
                    <div style={{ 
                      background: "#f9fafb", 
                      borderRadius: "6px", 
                      padding: "10px",
                      marginBottom: "12px",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      wordBreak: "break-all",
                      color: "#333333"
                    }}>
                      {invoice.walletAddress}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <div>
                        <p style={{ color: "#666666", marginBottom: "4px" }}>付款金额</p>
                        <p style={{ fontWeight: "700", color: "#7c3aed", fontSize: "16px" }}>{Number(invoice.totalAmount).toFixed(0)} USDT</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: "#666666", marginBottom: "4px" }}>到账金额</p>
                        <p style={{ fontWeight: "700", color: "#16a34a", fontSize: "16px" }}>{Number(invoice.totalAmount).toFixed(0)} USDT</p>
                      </div>
                    </div>
                  </div>

                  {/* Notice */}
                  <div style={{ 
                    background: "linear-gradient(135deg, #fef9e7 0%, #fef3c7 100%)", 
                    borderRadius: "8px", 
                    padding: "14px",
                    fontSize: "12px",
                    color: "#92400e",
                    border: "1px solid #fde68a"
                  }}>
                    <p style={{ fontWeight: "600", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>⚠️</span>
                      <span>温馨提示：</span>
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "16px", lineHeight: "1.7" }}>
                      <li>请确保转账网络为 TRC20，其他网络转账将无法到账</li>
                      <li>转账金额请与应付金额保持一致</li>
                      <li>付款完成后请保留交易凭证</li>
                      <li>积分将在确认到账后24小时内充值到您的账户</li>
                    </ul>
                  </div>

                  {/* Footer */}
                  <div style={{ 
                    textAlign: "center", 
                    marginTop: "16px",
                    paddingTop: "12px",
                    borderTop: "1px solid #e5e7eb",
                    fontSize: "12px",
                    color: "#666666"
                  }}>
                    <p>✨ 感谢您选择云端寻踪搜索助手！✨</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
