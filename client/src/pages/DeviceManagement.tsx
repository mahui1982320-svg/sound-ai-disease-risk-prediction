import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Cpu,
  Plus,
  Trash2,
  RefreshCw,
  Key,
  Copy,
  Wifi,
  WifiOff,
  Clock,
  MapPin,
  User,
  Settings,
} from "lucide-react";

export default function DeviceManagement() {
  const [showRegister, setShowRegister] = useState(false);
  const [showToken, setShowToken] = useState<string | null>(null);
  const [newDevice, setNewDevice] = useState({
    deviceId: "",
    deviceName: "",
    elderlyId: undefined as number | undefined,
    location: "",
  });

  const utils = trpc.useUtils();
  const { data: devices, isLoading } = trpc.raspberryPi.listDevices.useQuery();
  const { data: elderlyList } = trpc.elderly.list.useQuery();

  const registerMutation = trpc.raspberryPi.registerDevice.useMutation({
    onSuccess: (data) => {
      toast.success("设备注册成功");
      setShowToken(data.apiToken);
      setShowRegister(false);
      setNewDevice({ deviceId: "", deviceName: "", elderlyId: undefined, location: "" });
      utils.raspberryPi.listDevices.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "注册失败");
    },
  });

  const deleteMutation = trpc.raspberryPi.deleteDevice.useMutation({
    onSuccess: () => {
      toast.success("设备已删除");
      utils.raspberryPi.listDevices.invalidate();
    },
    onError: () => toast.error("删除失败"),
  });

  const regenerateTokenMutation = trpc.raspberryPi.regenerateToken.useMutation({
    onSuccess: (data) => {
      toast.success("Token已重新生成");
      setShowToken(data.apiToken);
    },
    onError: () => toast.error("重新生成Token失败"),
  });

  const handleRegister = () => {
    if (!newDevice.deviceId || !newDevice.deviceName) {
      toast.error("请填写设备ID和名称");
      return;
    }
    registerMutation.mutate({
      deviceId: newDevice.deviceId,
      deviceName: newDevice.deviceName,
      elderlyId: newDevice.elderlyId,
      location: newDevice.location || undefined,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

  const elderlyMap = useMemo(() => {
    const map: Record<number, string> = {};
    elderlyList?.forEach(e => { map[e.id] = e.name; });
    return map;
  }, [elderlyList]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">设备管理</h1>
          <p className="text-sm text-gray-600 mt-1">管理树莓派监控设备，查看在线状态</p>
        </div>
        <Button onClick={() => setShowRegister(true)} className="flex items-center gap-2">
          <Plus size={16} />
          注册新设备
        </Button>
      </div>

      {/* 设备列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices && devices.length > 0 ? (
          devices.map((device) => (
            <Card key={device.id} className="p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${device.isOnline ? "bg-green-100" : "bg-gray-100"}`}>
                    <Cpu size={24} className={device.isOnline ? "text-green-600" : "text-gray-400"} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{device.deviceName}</h3>
                    <p className="text-sm text-gray-500 font-mono">{device.deviceId}</p>
                  </div>
                </div>
                <Badge variant={device.isOnline ? "default" : "secondary"} className={`flex items-center gap-1 ${device.isOnline ? "bg-green-500" : ""}`}>
                  {device.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {device.isOnline ? "在线" : "离线"}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                {device.elderlyId && (
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    <span>绑定老人：{elderlyMap[device.elderlyId] || `ID ${device.elderlyId}`}</span>
                  </div>
                )}
                {device.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{device.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>最后心跳：{device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString("zh-CN") : "从未连接"}</span>
                </div>
                {device.lastEventTime && (
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    <span>最后事件：{new Date(device.lastEventTime).toLocaleString("zh-CN")}</span>
                  </div>
                )}
                {device.modelVersion && (
                  <div className="flex items-center gap-2">
                    <Settings size={14} />
                    <span>模型版本：{device.modelVersion}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateTokenMutation.mutate({ deviceId: device.deviceId })}
                  className="flex items-center gap-1"
                >
                  <Key size={14} />
                  重置Token
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("确定要删除此设备吗？")) {
                      deleteMutation.mutate({ deviceId: device.deviceId });
                    }
                  }}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 size={14} />
                  删除
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <div className="col-span-2 text-center py-12">
            <Cpu size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">暂无注册设备</p>
            <Button onClick={() => setShowRegister(true)} variant="outline">
              注册第一台设备
            </Button>
          </div>
        )}
      </div>

      {/* 注册设备对话框 */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>注册新设备</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">设备ID</label>
              <Input
                placeholder="例如: rpi-001"
                value={newDevice.deviceId}
                onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">唯一标识符，建议使用 rpi-xxx 格式</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">设备名称</label>
              <Input
                placeholder="例如: 张奶奶房间树莓派"
                value={newDevice.deviceName}
                onChange={(e) => setNewDevice({ ...newDevice, deviceName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">绑定老人（可选）</label>
              <Select
                value={newDevice.elderlyId?.toString() || "none"}
                onValueChange={(v) => setNewDevice({ ...newDevice, elderlyId: v === "none" ? undefined : parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择绑定的老人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">暂不绑定</SelectItem>
                  {elderlyList?.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.name} - {e.roomNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">安装位置（可选）</label>
              <Input
                placeholder="例如: 3楼301室"
                value={newDevice.location}
                onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegister(false)}>取消</Button>
            <Button onClick={handleRegister} disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "注册中..." : "注册设备"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token显示对话框 */}
      <Dialog open={showToken !== null} onOpenChange={() => setShowToken(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>设备API Token</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                请妥善保存此Token，关闭后将无法再次查看！
              </p>
              <p className="text-xs text-yellow-700">
                此Token用于树莓派连接服务器的身份验证
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="text-xs text-gray-500 mb-2">API Token:</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono break-all flex-1 bg-white p-2 rounded border">
                  {showToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(showToken || "")}
                >
                  <Copy size={14} />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowToken(null)}>我已保存Token</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
