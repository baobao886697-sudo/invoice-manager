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
import React, { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import html2canvas from "html2canvas";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
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
        width: 400,
        windowWidth: 400,
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
      
      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          
          // Check if on mobile device
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          
          if (isMobile) {
            // For mobile: try to use share API or open in new tab
            if (navigator.share && navigator.canShare) {
              const file = new File([blob], `${invoice?.invoiceNumber || "invoice"}.png`, { type: 'image/png' });
              if (navigator.canShare({ files: [file] })) {
                navigator.share({
                  files: [file],
                  title: '账单图片',
                }).then(() => {
                  toast.success("图片已分享");
                }).catch(() => {
                  // Fallback to opening in new tab
                  window.open(url, '_blank');
                  toast.success("图片已打开，长按可保存");
                });
              } else {
                window.open(url, '_blank');
                toast.success("图片已打开，长按可保存");
              }
            } else {
              // Fallback: open image in new tab for long-press save
              window.open(url, '_blank');
              toast.success("图片已打开，长按可保存");
            }
          } else {
            // For desktop: download directly
            const link = document.createElement("a");
            link.download = `${invoice?.invoiceNumber || "invoice"}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success("图片导出成功");
          }
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

  // Generate preview image for long-press save
  const generatePreviewImage = async () => {
    if (!invoiceRef.current) return;
    
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 15000,
        foreignObjectRendering: false,
        removeContainer: true,
        width: 400,
        windowWidth: 400,
        onclone: (clonedDoc) => {
          const stylesheets = clonedDoc.querySelectorAll('link[rel="stylesheet"], style');
          stylesheets.forEach(sheet => {
            if (sheet.parentNode) {
              sheet.parentNode.removeChild(sheet);
            }
          });
          const resetStyle = clonedDoc.createElement('style');
          resetStyle.textContent = `* { box-sizing: border-box; margin: 0; padding: 0; }`;
          clonedDoc.head.appendChild(resetStyle);
        }
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      setPreviewImageUrl(dataUrl);
    } catch (error) {
      console.error("Preview generation error:", error);
    }
  };

  // Generate preview image when invoice data is loaded
  React.useEffect(() => {
    if (invoice && invoiceRef.current) {
      // Small delay to ensure DOM is rendered
      const timer = setTimeout(() => {
        generatePreviewImage();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoice]);

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
                  width: "400px", 
                  minWidth: "400px",
                  margin: "0 auto",
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif",
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)"
                }}
              >
                {/* Header */}
                <div style={{ 
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  padding: "24px 20px",
                  textAlign: "center",
                  color: "#ffffff"
                }}>
                  <h2 style={{ 
                    fontSize: "20px", 
                    fontWeight: "600", 
                    color: "#ffffff", 
                    margin: "0 0 6px 0",
                    letterSpacing: "1px",
                    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif"
                  }}>云端寻踪搜索助手</h2>
                  <p style={{ 
                    fontSize: "11px", 
                    color: "rgba(255,255,255,0.8)", 
                    margin: 0,
                    letterSpacing: "2px"
                  }}>PAYMENT INVOICE</p>
                </div>

                {/* Content */}
                <div style={{ padding: "16px", backgroundColor: "#ffffff" }}>
                  {/* Order Info */}
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    marginBottom: "14px",
                    padding: "12px",
                    background: "#f8fafc",
                    borderRadius: "6px"
                  }}>
                    <div>
                      <p style={{ color: "#94a3b8", marginBottom: "4px", fontSize: "12px" }}>订单编号</p>
                      <p style={{ fontWeight: "600", color: "#1e293b", fontSize: "13px" }}>{invoice.invoiceNumber}</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ color: "#94a3b8", marginBottom: "4px", fontSize: "12px" }}>订单日期</p>
                      <p style={{ fontWeight: "600", color: "#1e293b", fontSize: "13px" }}>{date}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#94a3b8", marginBottom: "4px", fontSize: "12px" }}>订单状态</p>
                      <p style={{ 
                        fontWeight: "600", 
                        fontSize: "13px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: invoice.status === "paid" ? "#dcfce7" : invoice.status === "pending" ? "#fef3c7" : "#fee2e2",
                        color: invoice.status === "paid" ? "#166534" : invoice.status === "pending" ? "#92400e" : "#991b1b"
                      }}>
                        {invoice.status === "paid" ? "✓ 已付款" : invoice.status === "pending" ? "○ 待付款" : "× 已取消"}
                      </p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div style={{ marginBottom: "14px" }}>
                    <p style={{ 
                      fontWeight: "600", 
                      marginBottom: "8px", 
                      fontSize: "13px", 
                      color: "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <span style={{ 
                        width: "4px", 
                        height: "16px", 
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        borderRadius: "2px"
                      }}></span>
                      购买明细
                    </p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                          <th style={{ padding: "8px 6px", textAlign: "left", color: "#64748b", fontWeight: "500", width: "40px" }}>#</th>
                          <th style={{ padding: "8px 6px", textAlign: "left", color: "#64748b", fontWeight: "500" }}>商品名称</th>
                          <th style={{ padding: "8px 6px", textAlign: "right", color: "#64748b", fontWeight: "500" }}>积分</th>
                          <th style={{ padding: "8px 6px", textAlign: "right", color: "#64748b", fontWeight: "500" }}>金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedItems.map((item, index) => {
                          const credits = item.credits;
                          return (
                            <tr key={index} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "8px 6px", color: "#94a3b8" }}>{index + 1}</td>
                              <td style={{ padding: "8px 6px", color: "#1e293b", fontWeight: "500" }}>积分充值套餐</td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: "#475569" }}>{credits.toLocaleString()}</td>
                              <td style={{ padding: "8px 6px", textAlign: "right", color: "#7c3aed", fontWeight: "600" }}>${Number(item.price).toFixed(0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div style={{ 
                    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", 
                    borderRadius: "6px", 
                    padding: "12px",
                    marginBottom: "14px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                      <span style={{ color: "#64748b" }}>商品小计</span>
                      <span style={{ color: "#475569" }}>${Number(invoice.totalAmount).toFixed(0)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px" }}>
                      <span style={{ color: "#64748b" }}>优惠折扣</span>
                      <span style={{ color: "#475569" }}>-$0</span>
                    </div>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      paddingTop: "8px",
                      borderTop: "1px dashed #cbd5e1"
                    }}>
                      <span style={{ color: "#1e293b", fontSize: "13px", fontWeight: "600" }}>应付总额</span>
                      <span style={{ 
                        color: "#7c3aed", 
                        fontSize: "18px", 
                        fontWeight: "700"
                      }}>${Number(invoice.totalAmount).toFixed(0)} USDT</span>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div style={{ 
                    background: "linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)",
                    borderRadius: "6px", 
                    padding: "12px",
                    marginBottom: "14px",
                    border: "1px solid #d4deff"
                  }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "6px",
                      marginBottom: "10px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#3b5998"
                    }}>
                      <span style={{ fontSize: "16px" }}>💳</span>
                      <span>USDT-TRC20 付款信息</span>
                    </div>
                    <div style={{ 
                      background: "#ffffff", 
                      borderRadius: "4px", 
                      padding: "12px",
                      marginBottom: "12px",
                      border: "1px solid #cbd5e1",
                      fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                      fontSize: "13px",
                      wordBreak: "break-all",
                      color: "#1e293b",
                      lineHeight: "1.5",
                      textAlign: "center",
                      fontWeight: "500"
                    }}>
                      {invoice.walletAddress}
                    </div>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between"
                    }}>
                      <div>
                        <p style={{ color: "#64748b", marginBottom: "4px", fontSize: "11px" }}>付款金额</p>
                        <p style={{ fontWeight: "700", fontSize: "16px", color: "#7c3aed" }}>{Number(invoice.totalAmount).toFixed(0)} USDT</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: "#64748b", marginBottom: "4px", fontSize: "11px" }}>到账金额</p>
                        <p style={{ fontWeight: "700", fontSize: "16px", color: "#16a34a" }}>{Number(invoice.totalAmount).toFixed(0)} USDT</p>
                      </div>
                    </div>
                  </div>

                  {/* Notice */}
                  <div style={{ 
                    background: "#fffbeb", 
                    borderRadius: "6px", 
                    padding: "10px",
                    fontSize: "11px",
                    color: "#78350f",
                    borderLeft: "3px solid #f59e0b"
                  }}>
                    <p style={{ 
                      fontWeight: "600", 
                      marginBottom: "6px", 
                      fontSize: "12px",
                      color: "#92400e"
                    }}>温馨提示</p>
                    <div style={{ lineHeight: "1.6", color: "#a16207" }}>
                      <p style={{ margin: "0 0 2px 0" }}>• 请确保转账网络为 TRC20</p>
                      <p style={{ margin: "0 0 2px 0" }}>• 转账金额请与应付金额保持一致</p>
                      <p style={{ margin: "0 0 2px 0" }}>• 付款完成后请保留交易凭证</p>
                      <p style={{ margin: 0 }}>• 积分将在24小时内充值到您的账户</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ 
                    textAlign: "center", 
                    marginTop: "12px",
                    paddingTop: "10px",
                    borderTop: "1px solid #f1f5f9",
                    fontSize: "11px",
                    color: "#94a3b8"
                  }}>
                    <p style={{ margin: 0 }}>感谢您的信任与支持</p>
                  </div>
                </div>
              </div>
              
              {/* Long-press saveable image preview */}
              {previewImageUrl && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">长按图片可直接保存到相册</p>
                  <img 
                    src={previewImageUrl} 
                    alt="账单预览" 
                    className="max-w-full rounded-lg shadow-md mx-auto"
                    style={{ maxWidth: '400px' }}
                  />
                </div>
              )}
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
