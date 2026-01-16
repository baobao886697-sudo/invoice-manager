import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Default price tiers based on the user's price table
const DEFAULT_PRICE_TIERS = [
  { credits: 10000, minNumbers: 2000, maxNumbers: 2500, unitPrice: "0.0030", price: "30" },
  { credits: 30000, minNumbers: 6000, maxNumbers: 6500, unitPrice: "0.0029", price: "87" },
  { credits: 50000, minNumbers: 10000, maxNumbers: 11500, unitPrice: "0.00288", price: "144" },
  { credits: 80000, minNumbers: 16000, maxNumbers: 17500, unitPrice: "0.00275", price: "220" },
  { credits: 120000, minNumbers: 24000, maxNumbers: 27000, unitPrice: "0.0026", price: "312" },
  { credits: 160000, minNumbers: 32000, maxNumbers: 35000, unitPrice: "0.00245", price: "392" },
  { credits: 200000, minNumbers: 40000, maxNumbers: 43000, unitPrice: "0.0023", price: "460" },
  { credits: 250000, minNumbers: 50000, maxNumbers: 54000, unitPrice: "0.0022", price: "550" },
  { credits: 300000, minNumbers: 60000, maxNumbers: 64000, unitPrice: "0.00218", price: "655" },
  { credits: 350000, minNumbers: 70000, maxNumbers: 75000, unitPrice: "0.00213", price: "747" },
  { credits: 400000, minNumbers: 80000, maxNumbers: 86000, unitPrice: "0.00205", price: "820" },
  { credits: 450000, minNumbers: 90000, maxNumbers: 96000, unitPrice: "0.0020", price: "900" },
  { credits: 500000, minNumbers: 100000, maxNumbers: 107000, unitPrice: "0.00195", price: "975" },
  { credits: 550000, minNumbers: 110000, maxNumbers: 117000, unitPrice: "0.0019", price: "1045" },
  { credits: 600000, minNumbers: 120000, maxNumbers: 128000, unitPrice: "0.00185", price: "1110" },
];

interface PriceTierForm {
  credits: string;
  minNumbers: string;
  maxNumbers: string;
  unitPrice: string;
  price: string;
}

const emptyForm: PriceTierForm = {
  credits: "",
  minNumbers: "",
  maxNumbers: "",
  unitPrice: "",
  price: "",
};

export default function PriceTiers() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<PriceTierForm>(emptyForm);

  const utils = trpc.useUtils();
  const { data: tiers, isLoading } = trpc.priceTiers.list.useQuery();

  const createMutation = trpc.priceTiers.create.useMutation({
    onSuccess: () => {
      utils.priceTiers.list.invalidate();
      setIsAddOpen(false);
      setForm(emptyForm);
      toast.success("价格档位添加成功");
    },
    onError: (error) => {
      toast.error("添加失败: " + error.message);
    },
  });

  const updateMutation = trpc.priceTiers.update.useMutation({
    onSuccess: () => {
      utils.priceTiers.list.invalidate();
      setIsEditOpen(false);
      setForm(emptyForm);
      setSelectedId(null);
      toast.success("价格档位更新成功");
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });

  const deleteMutation = trpc.priceTiers.delete.useMutation({
    onSuccess: () => {
      utils.priceTiers.list.invalidate();
      setIsDeleteOpen(false);
      setSelectedId(null);
      toast.success("价格档位删除成功");
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const bulkCreateMutation = trpc.priceTiers.bulkCreate.useMutation({
    onSuccess: () => {
      utils.priceTiers.list.invalidate();
      toast.success("默认价格表导入成功");
    },
    onError: (error) => {
      toast.error("导入失败: " + error.message);
    },
  });

  const handleAdd = () => {
    if (!form.credits || !form.price) {
      toast.error("请填写必要字段");
      return;
    }
    createMutation.mutate({
      credits: parseInt(form.credits),
      minNumbers: parseInt(form.minNumbers) || 0,
      maxNumbers: parseInt(form.maxNumbers) || 0,
      unitPrice: form.unitPrice || "0",
      price: form.price,
    });
  };

  const handleEdit = () => {
    if (!selectedId || !form.credits || !form.price) {
      toast.error("请填写必要字段");
      return;
    }
    updateMutation.mutate({
      id: selectedId,
      credits: parseInt(form.credits),
      minNumbers: parseInt(form.minNumbers) || 0,
      maxNumbers: parseInt(form.maxNumbers) || 0,
      unitPrice: form.unitPrice || "0",
      price: form.price,
    });
  };

  const handleDelete = () => {
    if (selectedId) {
      deleteMutation.mutate({ id: selectedId });
    }
  };

  const handleImportDefaults = () => {
    bulkCreateMutation.mutate(DEFAULT_PRICE_TIERS);
  };

  const openEditDialog = (tier: typeof tiers extends (infer T)[] | undefined ? T : never) => {
    if (!tier) return;
    setSelectedId(tier.id);
    setForm({
      credits: tier.credits.toString(),
      minNumbers: tier.minNumbers.toString(),
      maxNumbers: tier.maxNumbers.toString(),
      unitPrice: tier.unitPrice,
      price: tier.price,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (id: number) => {
    setSelectedId(id);
    setIsDeleteOpen(true);
  };

  // Auto-calculate unit price when credits and price change
  const handleFormChange = (field: keyof PriceTierForm, value: string) => {
    const newForm = { ...form, [field]: value };
    
    // Auto-calculate unit price
    if ((field === "credits" || field === "price") && newForm.credits && newForm.price) {
      const credits = parseFloat(newForm.credits);
      const price = parseFloat(newForm.price);
      if (credits > 0 && price > 0) {
        newForm.unitPrice = (price / credits).toFixed(6);
      }
    }
    
    setForm(newForm);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">价格表管理</h1>
            <p className="text-muted-foreground">管理积分与价格对应关系</p>
          </div>
          <div className="flex gap-2">
            {(!tiers || tiers.length === 0) && (
              <Button
                variant="outline"
                onClick={handleImportDefaults}
                disabled={bulkCreateMutation.isPending}
                className="gap-2"
              >
                {bulkCreateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                导入默认价格表
              </Button>
            )}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  添加档位
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加价格档位</DialogTitle>
                  <DialogDescription>添加新的积分价格档位</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>积分数量 *</Label>
                      <Input
                        type="number"
                        placeholder="例如: 100000"
                        value={form.credits}
                        onChange={(e) => handleFormChange("credits", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>价格 (USD) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="例如: 266"
                        value={form.price}
                        onChange={(e) => handleFormChange("price", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>号码下限</Label>
                      <Input
                        type="number"
                        placeholder="例如: 20000"
                        value={form.minNumbers}
                        onChange={(e) => handleFormChange("minNumbers", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>号码上限</Label>
                      <Input
                        type="number"
                        placeholder="例如: 25000"
                        value={form.maxNumbers}
                        onChange={(e) => handleFormChange("maxNumbers", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>单价 (自动计算)</Label>
                    <Input
                      type="text"
                      value={form.unitPrice}
                      onChange={(e) => handleFormChange("unitPrice", e.target.value)}
                      placeholder="自动计算"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAdd} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    添加
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>价格档位列表</CardTitle>
            <CardDescription>
              当前共 {tiers?.length || 0} 个价格档位，单价 = 价格 ÷ 积分数
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : tiers && tiers.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>积分数量</TableHead>
                      <TableHead>可获取号码数量</TableHead>
                      <TableHead>单价 (USD)</TableHead>
                      <TableHead>价格 (USD)</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiers.map((tier) => (
                      <TableRow key={tier.id}>
                        <TableCell className="font-medium">
                          {tier.credits.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {tier.minNumbers.toLocaleString()} - {tier.maxNumbers.toLocaleString()}
                        </TableCell>
                        <TableCell>{tier.unitPrice}</TableCell>
                        <TableCell className="font-bold text-primary">
                          ${Number(tier.price).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(tier)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(tier.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-4">暂无价格档位</p>
                <Button variant="outline" onClick={handleImportDefaults}>
                  导入默认价格表
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑价格档位</DialogTitle>
              <DialogDescription>修改积分价格档位信息</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>积分数量 *</Label>
                  <Input
                    type="number"
                    value={form.credits}
                    onChange={(e) => handleFormChange("credits", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>价格 (USD) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => handleFormChange("price", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>号码下限</Label>
                  <Input
                    type="number"
                    value={form.minNumbers}
                    onChange={(e) => handleFormChange("minNumbers", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>号码上限</Label>
                  <Input
                    type="number"
                    value={form.maxNumbers}
                    onChange={(e) => handleFormChange("maxNumbers", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>单价 (自动计算)</Label>
                <Input
                  type="text"
                  value={form.unitPrice}
                  onChange={(e) => handleFormChange("unitPrice", e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                取消
              </Button>
              <Button onClick={handleEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除这个价格档位吗？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
