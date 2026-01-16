import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Loader2, Download, Copy, Check, Calculator } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import html2canvas from "html2canvas";

interface InvoiceItem {
  id: string;
  credits: string;
  price: string;
  isManual: boolean;
}

export default function InvoiceGenerator() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), credits: "", price: "", isManual: false },
  ]);
  const [customerNote, setCustomerNote] = useState("");
  const [copied, setCopied] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data: settings } = trpc.settings.get.useQuery();
  const { data: nextNumber } = trpc.invoices.getNextNumber.useQuery();
  const { data: priceTiers } = trpc.priceTiers.list.useQuery();

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: (invoice) => {
      toast.success("账单创建成功");
      setLocation(`/invoice/${invoice.id}`);
    },
    onError: (error) => {
      toast.error("创建失败: " + error.message);
    },
  });

  // Calculate price based on credits
  const calculatePrice = useCallback(
    (credits: number): number | null => {
      if (!priceTiers || priceTiers.length === 0) return null;

      const sortedTiers = [...priceTiers].sort((a, b) => a.credits - b.credits);

      // Find exact match
      const exactMatch = sortedTiers.find((t) => t.credits === credits);
      if (exactMatch) return Number(exactMatch.price);

      // Find surrounding tiers for interpolation
      let lowerTier = sortedTiers[0];
      let upperTier = sortedTiers[sortedTiers.length - 1];

      for (let i = 0; i < sortedTiers.length - 1; i++) {
        if (sortedTiers[i].credits <= credits && sortedTiers[i + 1].credits >= credits) {
          lowerTier = sortedTiers[i];
          upperTier = sortedTiers[i + 1];
          break;
        }
      }

      // Handle out of range
      if (credits < sortedTiers[0].credits) {
        const unitPrice = Number(sortedTiers[0].unitPrice);
        return Math.round(credits * unitPrice);
      }

      if (credits > sortedTiers[sortedTiers.length - 1].credits) {
        const unitPrice = Number(sortedTiers[sortedTiers.length - 1].unitPrice);
        return Math.round(credits * unitPrice);
      }

      // Linear interpolation
      const ratio =
        (credits - lowerTier.credits) / (upperTier.credits - lowerTier.credits);
      const interpolatedPrice =
        Number(lowerTier.price) + ratio * (Number(upperTier.price) - Number(lowerTier.price));

      return Math.round(interpolatedPrice);
    },
    [priceTiers]
  );

  const handleCreditsChange = (id: string, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const credits = parseInt(value) || 0;
        let price = item.price;

        if (!item.isManual && credits > 0) {
          const calculatedPrice = calculatePrice(credits);
          if (calculatedPrice !== null) {
            price = calculatedPrice.toString();
          }
        }

        return { ...item, credits: value, price };
      })
    );
  };

  const handlePriceChange = (id: string, value: string, manual: boolean = true) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, price: value, isManual: manual } : item
      )
    );
  };

  const toggleManualPrice = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (item.isManual) {
          // Switch back to auto
          const credits = parseInt(item.credits) || 0;
          const calculatedPrice = calculatePrice(credits);
          return {
            ...item,
            isManual: false,
            price: calculatedPrice !== null ? calculatedPrice.toString() : item.price,
          };
        } else {
          return { ...item, isManual: true };
        }
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), credits: "", price: "", isManual: false },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      toast.error("至少需要一个购买项目");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalCredits = items.reduce((sum, item) => sum + (parseInt(item.credits) || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  const handleCreate = () => {
    if (!settings?.walletAddress) {
      toast.error("请先在设置中配置收款地址");
      return;
    }

    const validItems = items.filter(
      (item) => parseInt(item.credits) > 0 && parseFloat(item.price) > 0
    );

    if (validItems.length === 0) {
      toast.error("请至少添加一个有效的购买项目");
      return;
    }

    createMutation.mutate({
      items: validItems.map((item) => ({
        credits: parseInt(item.credits),
        price: item.price,
      })),
      walletAddress: settings.walletAddress,
      customerNote: customerNote || undefined,
    });
  };

  const handleExportImage = async () => {
    if (!invoiceRef.current) return;

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `invoice-preview-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("图片导出成功");
    } catch (error) {
      toast.error("导出失败");
    }
  };

  const generateTextVersion = () => {
    const today = new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Sort items by price descending
    const sortedItems = [...items]
      .filter((item) => parseInt(item.credits) > 0 && parseFloat(item.price) > 0)
      .sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

    let text = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 云端寻踪搜索助手 - 收款账单
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 订单详情

客户编号：${nextNumber || "#INV..."}
订单日期：${today}
订单状态：待付款

➖➖➖➖➖➖➖➖➖➖➖➖➖➖

📦 购买明细

┌─────────────────────────────────┐
│ 序号 │ 商品名称      │ 金额(USDT) │
├─────────────────────────────────┤
`;

    sortedItems.forEach((item, index) => {
      const credits = parseInt(item.credits);
      const creditsStr = credits >= 10000 ? `${credits / 10000}万` : credits.toString();
      text += `│  ${index + 1}   │ ${creditsStr}积分套餐  │   ${parseFloat(item.price).toFixed(0)}   │\n`;
    });

    text += `└─────────────────────────────────┘

💰 费用汇总
━━━━━━━━━━━━━━━━━━━━
商品小计：    ${totalAmount.toFixed(0)} USDT
━━━━━━━━━━━━━━━━━━━━
应付总额：    ${totalAmount.toFixed(0)} USDT
━━━━━━━━━━━━━━━━━━━━

➖➖➖➖➖➖➖➖➖➖➖➖➖➖

👩‍💼 您正在使用 USDT-TRC20 付款

💳 收款信息
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
收款网络：USDT-TRC20
收款地址：

${settings?.walletAddress || "请先配置收款地址"}

付款金额：  ${totalAmount.toFixed(0)} USDT
到账金额：  ${totalAmount.toFixed(0)} USDT
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

  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Sort items by price descending for preview
  const sortedItems = [...items]
    .filter((item) => parseInt(item.credits) > 0 && parseFloat(item.price) > 0)
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">创建新账单</h1>
          <p className="text-muted-foreground">添加购买项目并生成收款账单</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>购买项目</CardTitle>
                <CardDescription>
                  输入积分数量，系统将自动计算价格（也可手动输入）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="flex gap-3 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>积分数量</Label>
                      <Input
                        type="number"
                        placeholder="例如: 100000"
                        value={item.credits}
                        onChange={(e) => handleCreditsChange(item.id, e.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>价格 (USDT)</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => toggleManualPrice(item.id)}
                        >
                          <Calculator className="w-3 h-3 mr-1" />
                          {item.isManual ? "自动" : "手动"}
                        </Button>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={item.isManual ? "手动输入" : "自动计算"}
                        value={item.price}
                        onChange={(e) => handlePriceChange(item.id, e.target.value, true)}
                        className={item.isManual ? "border-orange-300" : ""}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                <Button variant="outline" onClick={addItem} className="w-full gap-2">
                  <Plus className="w-4 h-4" />
                  添加项目
                </Button>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>总计</span>
                  <span>
                    {totalCredits.toLocaleString()} 积分 / ${totalAmount.toLocaleString()} USDT
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>备注信息</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="可选：添加客户备注..."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || totalAmount === 0}
                className="flex-1"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                创建账单
              </Button>
              <Button variant="outline" onClick={handleExportImage}>
                <Download className="w-4 h-4 mr-2" />
                导出图片
              </Button>
              <Button variant="outline" onClick={handleCopyText}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                复制文本
              </Button>
            </div>
          </div>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>账单预览</CardTitle>
              <CardDescription>实时预览账单效果</CardDescription>
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
                      <p className="font-medium">{nextNumber || "#INV..."}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">订单日期</p>
                      <p className="font-medium">{today}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500">订单状态</p>
                      <p className="text-yellow-600 font-medium">⏳ 待付款</p>
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
                        {sortedItems.length > 0 ? (
                          sortedItems.map((item, index) => (
                            <tr key={item.id} className="border-b">
                              <td className="py-3">{index + 1}</td>
                              <td className="py-3">积分充值套餐</td>
                              <td className="py-3">{parseInt(item.credits).toLocaleString()}</td>
                              <td className="py-3 text-right text-indigo-600 font-bold">
                                {parseFloat(item.price).toFixed(0)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-gray-400">
                              请添加购买项目
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">商品小计</span>
                      <span>{totalAmount.toFixed(0)} USDT</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">优惠折扣</span>
                      <span>- 0 USDT</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold text-lg">
                      <span>应付总额</span>
                      <span className="text-indigo-600">{totalAmount.toFixed(0)} USDT</span>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="bg-indigo-50 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-indigo-600">💳</span>
                      <span className="font-medium text-indigo-600">USDT-TRC20 付款信息</span>
                    </div>
                    <div className="bg-white rounded p-3 mb-3">
                      <p className="text-xs text-gray-500 break-all">
                        {settings?.walletAddress || "请先配置收款地址"}
                      </p>
                    </div>
                    <div className="flex justify-between text-sm">
                      <div>
                        <p className="text-gray-500">付款金额</p>
                        <p className="text-indigo-600 font-bold text-lg">
                          {totalAmount.toFixed(0)} USDT
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500">到账金额</p>
                        <p className="text-green-600 font-bold text-lg">
                          {totalAmount.toFixed(0)} USDT
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
    </DashboardLayout>
  );
}
