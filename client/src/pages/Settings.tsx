import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Loader2, Save, Wallet, Building2, User, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Settings() {
  const [walletAddress, setWalletAddress] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      toast.success("设置保存成功");
      setIsSaving(false);
    },
    onError: (error) => {
      toast.error("保存失败: " + error.message);
      setIsSaving(false);
    },
  });

  useEffect(() => {
    if (settings) {
      setWalletAddress(settings.walletAddress || "");
      setCompanyName(settings.companyName || "云端寻踪搜索助手");
    }
  }, [settings]);

  const handleSave = () => {
    setIsSaving(true);
    updateMutation.mutate({
      walletAddress,
      companyName,
    });
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

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">系统设置</h1>
          <p className="text-muted-foreground">管理您的账户和系统配置</p>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              账户信息
            </CardTitle>
            <CardDescription>您的登录账户信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">用户身份</Label>
                <p className="font-medium">管理员</p>
              </div>
              <div>
                <Label className="text-muted-foreground">登录方式</Label>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">密码登录</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              收款设置
            </CardTitle>
            <CardDescription>设置您的默认收款钱包地址</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="walletAddress">USDT-TRC20 收款地址</Label>
              <Input
                id="walletAddress"
                placeholder="输入您的TRC20钱包地址，例如：TEtRGZvdPqvUDhopMi1MEGCEiD9Ehdh1iZ"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                此地址将作为创建账单时的默认收款地址
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Company Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              公司设置
            </CardTitle>
            <CardDescription>设置账单上显示的公司名称</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">公司/产品名称</Label>
              <Input
                id="companyName"
                placeholder="输入公司或产品名称"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                此名称将显示在生成的账单上
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            保存设置
          </Button>
        </div>

        <Separator />

        {/* Tips */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-700 text-base">使用提示</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-600 space-y-2">
            <p>• 收款地址请确保为有效的 TRC20 网络地址</p>
            <p>• 修改收款地址后，新创建的账单将使用新地址</p>
            <p>• 已创建的账单不会受到地址修改的影响</p>
            <p>• 建议定期检查收款地址是否正确</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
