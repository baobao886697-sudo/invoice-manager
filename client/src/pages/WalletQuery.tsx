import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight,
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink,
  Clock,
  TrendingUp,
  AlertCircle,
  Loader2,
  ArrowLeftRight
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function WalletQuery() {
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Get user settings to get wallet address
  const { data: settings, isLoading: settingsLoading } = trpc.settings.get.useQuery();
  
  // Get wallet balance
  const { 
    data: balanceData, 
    isLoading: balanceLoading, 
    refetch: refetchBalance 
  } = trpc.trc20.getWalletBalance.useQuery(
    { walletAddress: settings?.walletAddress || '' },
    { enabled: !!settings?.walletAddress }
  );
  
  // Get recent transfers (USDT only)
  const { 
    data: transfersData, 
    isLoading: transfersLoading, 
    refetch: refetchTransfers 
  } = trpc.trc20.getRecentTransfers.useQuery(
    { walletAddress: settings?.walletAddress || '', limit: 20 },
    { enabled: !!settings?.walletAddress }
  );

  // Get all transactions (all tokens, both in and out)
  const { 
    data: allTransactionsData, 
    isLoading: allTransactionsLoading, 
    refetch: refetchAllTransactions 
  } = trpc.trc20.getAllTransactions.useQuery(
    { walletAddress: settings?.walletAddress || '', limit: 30 },
    { enabled: !!settings?.walletAddress }
  );

  // Auto refresh every 30 seconds
  useEffect(() => {
    if (!settings?.walletAddress) return;
    
    const interval = setInterval(() => {
      refetchBalance();
      refetchTransfers();
      refetchAllTransactions();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [settings?.walletAddress, refetchBalance, refetchTransfers, refetchAllTransactions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchBalance(), refetchTransfers(), refetchAllTransactions()]);
      toast.success("数据已刷新");
    } catch (error) {
      toast.error("刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyAddress = () => {
    if (settings?.walletAddress) {
      navigator.clipboard.writeText(settings.walletAddress);
      setCopied(true);
      toast.success("地址已复制");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const shortenAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const isLoading = settingsLoading || balanceLoading || transfersLoading;

  // Get token color based on symbol
  const getTokenColor = (symbol: string) => {
    const colors: Record<string, string> = {
      'USDT': 'bg-green-100 text-green-700',
      'TRX': 'bg-red-100 text-red-700',
      'USDC': 'bg-blue-100 text-blue-700',
      'BTT': 'bg-purple-100 text-purple-700',
      'WIN': 'bg-yellow-100 text-yellow-700',
      'JST': 'bg-orange-100 text-orange-700',
      'SUN': 'bg-amber-100 text-amber-700',
    };
    return colors[symbol] || 'bg-gray-100 text-gray-700';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">收款查询</h1>
            <p className="text-muted-foreground">
              查看钱包余额和到账记录
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing || !settings?.walletAddress}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            刷新数据
          </Button>
        </div>

        {/* Wallet Address Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">收款地址</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                USDT-TRC20
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : settings?.walletAddress ? (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <code className="flex-1 text-sm font-mono break-all">
                  {settings.walletAddress}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={handleCopyAddress}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  asChild
                >
                  <a
                    href={`https://tronscan.org/#/address/${settings.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <span>请先在系统设置中配置收款地址</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Balance Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* USDT Balance */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                USDT 余额
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-green-600">
                    {balanceData?.usdtBalance?.toLocaleString() || "0"}
                  </span>
                  <span className="text-sm text-muted-foreground">USDT</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* TRX Balance */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Wallet className="h-4 w-4" />
                TRX 余额
              </CardDescription>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {balanceData?.trxBalance?.toLocaleString() || "0"}
                  </span>
                  <span className="text-sm text-muted-foreground">TRX</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Transactions */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <ArrowDownLeft className="h-4 w-4" />
                最近到账笔数
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transfersLoading ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {transfersData?.transfers?.length || 0}
                  </span>
                  <span className="text-sm text-muted-foreground">笔</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Transfers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownLeft className="h-5 w-5 text-green-500" />
                  最近到账记录
                </CardTitle>
                <CardDescription>
                  显示最近 20 笔 USDT-TRC20 入账记录
                </CardDescription>
              </div>
              {transfersData?.transfers && transfersData.transfers.length > 0 && (
                <Badge variant="secondary">
                  共 {transfersData.transfers.length} 笔
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {transfersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : !settings?.walletAddress ? (
              <div className="text-center py-8 text-muted-foreground">
                请先配置收款地址
              </div>
            ) : transfersData?.transfers && transfersData.transfers.length > 0 ? (
              <div className="space-y-1">
                {transfersData.transfers.map((transfer: any, index: number) => (
                  <div key={transfer.transactionId}>
                    <div className="flex items-center gap-4 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <ArrowDownLeft className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">收到转账</span>
                          <Badge variant="outline" className="text-xs">
                            USDT
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <span>来自: {shortenAddress(transfer.from)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(transfer.timestamp)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-green-600">
                          +{transfer.amount.toLocaleString()} USDT
                        </div>
                        <a
                          href={`https://tronscan.org/#/transaction/${transfer.transactionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 justify-end"
                        >
                          查看详情
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    {index < transfersData.transfers.length - 1 && (
                      <Separator className="my-1" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <ArrowDownLeft className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">暂无到账记录</p>
                <p className="text-sm text-muted-foreground mt-1">
                  新的 USDT 转账将显示在这里
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Transactions (Comprehensive) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-blue-500" />
                  综合交易记录
                </CardTitle>
                <CardDescription>
                  显示所有币种的收入和支出记录
                </CardDescription>
              </div>
              {allTransactionsData?.transactions && allTransactionsData.transactions.length > 0 && (
                <Badge variant="secondary">
                  共 {allTransactionsData.transactions.length} 笔
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {allTransactionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : !settings?.walletAddress ? (
              <div className="text-center py-8 text-muted-foreground">
                请先配置收款地址
              </div>
            ) : allTransactionsData?.transactions && allTransactionsData.transactions.length > 0 ? (
              <div className="space-y-1">
                {allTransactionsData.transactions.map((tx: any, index: number) => {
                  const isIncoming = tx.type === 'in';
                  return (
                    <div key={tx.transactionId + index}>
                      <div className="flex items-center gap-4 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                          isIncoming ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {isIncoming ? (
                            <ArrowDownLeft className="h-5 w-5 text-green-600" />
                          ) : (
                            <ArrowUpRight className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {isIncoming ? '收到转账' : '转出'}
                            </span>
                            <Badge className={`text-xs ${getTokenColor(tx.tokenSymbol)}`}>
                              {tx.tokenSymbol}
                            </Badge>
                            {tx.tokenType === 'TRC20' && tx.tokenSymbol !== 'TRX' && (
                              <Badge variant="outline" className="text-xs">
                                TRC20
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>
                              {isIncoming ? '来自' : '发送至'}: {shortenAddress(isIncoming ? tx.from : tx.to)}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(tx.timestamp)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                            {isIncoming ? '+' : '-'}{tx.amount.toLocaleString()} {tx.tokenSymbol}
                          </div>
                          <a
                            href={`https://tronscan.org/#/transaction/${tx.transactionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 justify-end"
                          >
                            查看详情
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                      {index < allTransactionsData.transactions.length - 1 && (
                        <Separator className="my-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">暂无交易记录</p>
                <p className="text-sm text-muted-foreground mt-1">
                  所有币种的收入和支出将显示在这里
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auto-refresh indicator */}
        <div className="text-center text-sm text-muted-foreground">
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="h-3 w-3" />
            数据每 30 秒自动刷新
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
