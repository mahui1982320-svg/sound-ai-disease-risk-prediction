import { useState } from "react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Edit2, Trash2, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

interface ElderlyFormData {
  name: string;
  roomNumber: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  notes?: string;
}

export default function ElderlyManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ElderlyFormData>({
    name: "",
    roomNumber: "",
    emergencyContact: "",
    emergencyPhone: "",
    notes: "",
  });

  const { data: elderlyList, isLoading, refetch } = trpc.elderly.list.useQuery();

  const createMutation = trpc.elderly.create.useMutation({
    onSuccess: () => {
      toast.success("添加成功");
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "添加失败");
    },
  });

  const updateMutation = trpc.elderly.update.useMutation({
    onSuccess: () => {
      toast.success("更新成功");
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "更新失败");
    },
  });

  const deleteMutation = trpc.elderly.delete.useMutation({
    onSuccess: () => {
      toast.success("删除成功");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "删除失败");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      roomNumber: "",
      emergencyContact: "",
      emergencyPhone: "",
      notes: "",
    });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.roomNumber) {
      toast.error("请填写必填项");
      return;
    }

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        ...formData,
      });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleEdit = (elderly: any) => {
    setFormData({
      name: elderly.name,
      roomNumber: elderly.roomNumber,
      emergencyContact: elderly.emergencyContact || "",
      emergencyPhone: elderly.emergencyPhone || "",
      notes: elderly.notes || "",
    });
    setEditingId(elderly.id);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这个老人档案吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">老人档案</h1>
            <p className="text-muted-foreground mt-1">
              管理养老院老人的基本信息
            </p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus size={20} />
            添加老人
          </Button>
        </div>

        {/* 老人列表 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-32 w-full" />
              </Card>
            ))
          ) : elderlyList && elderlyList.length > 0 ? (
            elderlyList.map((elderly) => (
              <Card key={elderly.id} className="p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {elderly.name}
                  </h3>
                  <div className="flex items-center gap-2 text-muted-foreground mt-2">
                    <MapPin size={16} />
                    <span>房间 {elderly.roomNumber}</span>
                  </div>
                </div>

                {elderly.emergencyContact && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">紧急联系人</p>
                    <p className="text-foreground font-medium">
                      {elderly.emergencyContact}
                    </p>
                  </div>
                )}

                {elderly.emergencyPhone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone size={16} />
                    <span>{elderly.emergencyPhone}</span>
                  </div>
                )}

                {elderly.notes && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">备注</p>
                    <p className="text-foreground text-xs line-clamp-2">
                      {elderly.notes}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(elderly)}
                    className="flex-1 gap-2"
                  >
                    <Edit2 size={16} />
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(elderly.id)}
                    className="flex-1 gap-2"
                  >
                    <Trash2 size={16} />
                    删除
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center col-span-full">
              <p className="text-muted-foreground">暂无老人档案</p>
            </Card>
          )}
        </div>
      </div>

      {/* 编辑/添加对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "编辑老人档案" : "添加老人档案"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="输入老人姓名"
              />
            </div>

            <div>
              <Label htmlFor="roomNumber">房间号 *</Label>
              <Input
                id="roomNumber"
                value={formData.roomNumber}
                onChange={(e) =>
                  setFormData({ ...formData, roomNumber: e.target.value })
                }
                placeholder="输入房间号"
              />
            </div>

            <div>
              <Label htmlFor="emergencyContact">紧急联系人</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    emergencyContact: e.target.value,
                  })
                }
                placeholder="输入紧急联系人"
              />
            </div>

            <div>
              <Label htmlFor="emergencyPhone">紧急联系电话</Label>
              <Input
                id="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={(e) =>
                  setFormData({ ...formData, emergencyPhone: e.target.value })
                }
                placeholder="输入紧急联系电话"
              />
            </div>

            <div>
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="输入备注信息"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {editingId ? "更新" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
