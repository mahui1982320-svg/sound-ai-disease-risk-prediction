import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Volume2,
  Zap,
  TrendingUp,
  Shield,
  RefreshCw,
} from "lucide-react";

// YAMNet 类别中文名称映射（常用类别）
const YAMNET_ZH: Record<string, string> = {
  "Speech": "说话声",
  "Child speech, kid speaking": "儿童说话",
  "Conversation": "对话声",
  "Narration, monologue": "独白",
  "Babbling": "牙牙学语",
  "Shout": "大声呼喊",
  "Yell": "大声喊叫",
  "Children shouting": "儿童喊叫",
  "Screaming": "尖叫声",
  "Whispering": "耳语低语",
  "Laughter": "笑声",
  "Baby laughter": "婴儿笑声",
  "Giggle": "咯咯笑",
  "Crying, sobbing": "哭泣声",
  "Baby cry, infant cry": "婴儿哭声",
  "Whimper": "呜咽声",
  "Wail, moan": "哀号呼叫",
  "Sigh": "叹气声",
  "Singing": "歌唱声",
  "Choir": "合唱声",
  "Humming": "哼唱声",
  "Groan": "呻吟声",
  "Grunt": "哼哼声",
  "Whistling": "口哨声",
  "Breathing": "呼吸声",
  "Wheeze": "喘鸣声",
  "Snore": "鼾声",
  "Snort": "鼻哼声",
  "Gasp": "急吸声",
  "Pant": "喘气声",
  "Hiccup": "打嗝声",
  "Cough": "咳嗽声",
  "Throat clearing": "清嗓声",
  "Sneeze": "打喷嚏",
  "Sniff": "吸鼻子",
  "Run": "跑步声",
  "Shuffle": "拖步声",
  "Walk, footsteps": "脚步声",
  "Chewing, mastication": "咀嚼声",
  "Gargling": "漱口声",
  "Stomach rumble": "胃鸣声",
  "Burping, eructation": "打嗝声",
  "Finger snapping": "弹指声",
  "Clapping": "鼓掌声",
  "Cheering": "欢呼声",
  "Applause": "掌声",
  "Chatter": "嘈杂声",
  "Crowd": "人群声",
  "Hubbub, speech noise, speech babble": "嘈闹人声",
  "Children playing": "儿童玩耍声",
  "Animal": "动物声",
  "Domestic animals, pets": "家禽宠物声",
  "Dog": "狗声",
  "Bark": "狗吠声",
  "Howl": "嚎叫声",
  "Cat": "猫声",
  "Purr": "猫呼噜声",
  "Meow": "猫叫声",
  "Hiss": "嘶嘶声",
  "Bird": "鸟声",
  "Bird vocalization, bird call, bird song": "鸟鸣声",
  "Chirp, tweet": "鸟叫声",
  "Frog": "蛙鸣声",
  "Insect": "虫鸣声",
  "Cricket": "蟋蟀声",
  "Mosquito": "蚊子声",
  "Buzz": "嗡嗡声",
  "Music": "音乐声",
  "Piano": "钢琴声",
  "Guitar": "吉他声",
  "Drum": "鼓声",
  "Violin, fiddle": "小提琴声",
  "Wind": "风声",
  "Rustling leaves": "树叶沙沙声",
  "Wind noise (microphone)": "风噪声",
  "Thunderstorm": "雷暴雨声",
  "Thunder": "雷声",
  "Water": "水声",
  "Rain": "雨声",
  "Raindrop": "雨滴声",
  "Rain on surface": "雨打表面声",
  "Stream": "溪流声",
  "Waterfall": "瀑布声",
  "Ocean": "海浪声",
  "Waves, surf": "海浪声",
  "Fire": "火烈声",
  "Crackle": "噼啪声",
  "Vehicle": "车辆声",
  "Car": "汽车声",
  "Vehicle horn, car horn, honking": "汽车鸣笛",
  "Car alarm": "车辆报警",
  "Motorcycle": "摩托车声",
  "Train": "火车声",
  "Aircraft": "飞机声",
  "Helicopter": "直升机声",
  "Engine": "发动机声",
  "Chainsaw": "电锯声",
  "Door": "门声",
  "Doorbell": "门铃声",
  "Slam": "关门声",
  "Knock": "敲门声",
  "Tap": "轻敲声",
  "Squeak": "尖锐摩擦声",
  "Dishes, pots, and pans": "锅碗碰撞声",
  "Chopping (food)": "切菜声",
  "Frying (food)": "煎炒声",
  "Microwave oven": "微波炉声",
  "Water tap, faucet": "水龙头声",
  "Toilet flush": "冲马桶声",
  "Hair dryer": "吹风机声",
  "Vacuum cleaner": "吸尘器声",
  "Typing": "键盘敲击声",
  "Computer keyboard": "键盘声",
  "Alarm": "报警声",
  "Telephone": "电话声",
  "Telephone bell ringing": "电话铃声",
  "Ringtone": "手机铃声",
  "Alarm clock": "闹钟声",
  "Siren": "警报器声",
  "Smoke detector, smoke alarm": "烟雾报警器",
  "Fire alarm": "火灾报警",
  "Whistle": "口哨小哨",
  "Clock": "时钟声",
  "Tick": "滴答声",
  "Tick-tock": "滴答声",
  "Hammer": "锤子声",
  "Drill": "电钻声",
  "Explosion": "爆炸声",
  "Gunshot, gunfire": "枪声",
  "Fireworks": "烟花声",
  "Firecracker": "爆竹声",
  "Boom": "巨响声",
  "Glass": "玻璃声",
  "Shatter": "玻璃碎裂声",
  "Splash, splatter": "水花声",
  "Thump, thud": "重击声",
  "Thunk": "沉闷击打声",
  "Bang": "爆响声",
  "Slap, smack": "拍打声",
  "Smash, crash": "砸裂声",
  "Breaking": "断裂声",
  "Crunch": "碎裂声",
  "Rumble": "隆隆声",
  "Silence": "安静",
  "Noise": "噪音",
  "Environmental noise": "环境噪音",
  "Static": "静电噪音",
  "White noise": "白噪音",
  "Television": "电视声",
  "Radio": "收音机声",
  "Inside, small room": "小房间内声",
  "Inside, large room or hall": "大厅内声",
  "Inside, public space": "公共场所内声",
  "Outside, urban or manmade": "室外城市声",
  "Outside, rural or natural": "室外自然声",
  "Thud, impact": "重物落地声",
  "Whale vocalization": "鲸鱼声",
};

// 获取中文名称，如果没有映射则保留原文
function zhName(name: string): string {
  return YAMNET_ZH[name] ?? name;
}

const dangerLevelLabels: Record<string, string> = {
  none: "正常",
  low: "低",
  medium: "中",
  high: "高",
  critical: "危急",
};

const dangerLevelColors: Record<string, string> = {
  none: "bg-gray-100 text-gray-700",
  low: "bg-blue-100 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export default function EventMonitor() {
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [dangerOnly, setDangerOnly] = useState(false);

  const { data: devices } = trpc.raspberryPi.listDevices.useQuery();
  const { data: events, isLoading, refetch } = trpc.raspberryPi.listEvents.useQuery({
    deviceId: deviceFilter === "all" ? undefined : deviceFilter,
    dangerOnly,
    limit: 100,
  });
  const { data: stats } = trpc.raspberryPi.eventStats.useQuery({
    deviceId: deviceFilter === "all" ? undefined : deviceFilter,
  });

  const onlineDevices = useMemo(() => devices?.filter(d => d.isOnline).length || 0, [devices]);
  const totalDevices = devices?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">事件监控</h1>
          <p className="text-sm text-gray-600 mt-1">实时查看树莓派上传的声音事件</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw size={16} />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={18} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-600">设备状态</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{onlineDevices}/{totalDevices}</div>
          <p className="text-xs text-blue-600 mt-1">在线/总数</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={18} className="text-green-600" />
            <span className="text-sm font-medium text-green-600">总事件数</span>
          </div>
          <div className="text-2xl font-bold text-green-900">{stats?.totalEvents || 0}</div>
          <p className="text-xs text-green-600 mt-1">24h: {stats?.recentEvents24h || 0}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-red-600" />
            <span className="text-sm font-medium text-red-600">危险事件</span>
          </div>
          <div className="text-2xl font-bold text-red-900">{stats?.dangerEvents || 0}</div>
          <p className="text-xs text-red-600 mt-1">24h: {stats?.recentDangerEvents24h || 0}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={18} className="text-purple-600" />
            <span className="text-sm font-medium text-purple-600">平均推理</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">{stats?.avgProcessingTime || 0}ms</div>
          <p className="text-xs text-purple-600 mt-1">推理耗时</p>
        </Card>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">设备：</label>
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部设备</SelectItem>
              {devices?.map((d) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.deviceName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={dangerOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setDangerOnly(!dangerOnly)}
          className="flex items-center gap-1"
        >
          <Shield size={14} />
          {dangerOnly ? "仅危险事件" : "全部事件"}
        </Button>
      </div>

      {/* 热门分类 */}
      {stats?.topClasses && stats.topClasses.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            热门声音分类
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.topClasses.map((cls) => (
              <Badge key={cls.name} variant="secondary" className="text-sm">
                {zhName(cls.name)}: {cls.count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* 事件列表 */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : events && events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => (
            <Card
              key={event.id}
              className={`p-4 border ${
                event.isDanger
                  ? "border-red-200 bg-red-50/50"
                  : "border-gray-200"
              } hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${event.isDanger ? "bg-red-100" : "bg-gray-100"}`}>
                    {event.isDanger ? (
                      <AlertTriangle size={20} className="text-red-600" />
                    ) : (
                      <Volume2 size={20} className="text-gray-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{zhName(event.primaryClassName)}</span>
                      <Badge className={dangerLevelColors[event.dangerLevel]}>
                        {dangerLevelLabels[event.dangerLevel]}
                      </Badge>
                      {event.alarmRecordId && (
                        <Badge variant="destructive" className="text-xs">已报警 #{event.alarmRecordId}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(event.createdAt).toLocaleString("zh-CN")}
                      </span>
                      <span className="font-mono">ID: {event.primaryClassId}</span>
                      <span>置信度: {(event.primaryConfidence * 100).toFixed(1)}%</span>
                      {event.processingTimeMs && <span>{event.processingTimeMs}ms</span>}
                      {event.rmsVolume && <span>RMS: {event.rmsVolume.toFixed(4)}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {(event.primaryConfidence * 100).toFixed(0)}%
                  </div>
                  {event.audioUrl && (
                    <a
                      href={event.audioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      播放音频
                    </a>
                  )}
                </div>
              </div>

              {/* Top Labels */}
              {event.topLabels && (() => {
                try {
                  const labels = JSON.parse(event.topLabels);
                  if (Array.isArray(labels) && labels.length > 1) {
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {labels.slice(0, 5).map((label: { class_name: string; confidence: number }, idx: number) => (
                            <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {zhName(label.class_name)}: {(label.confidence * 100).toFixed(1)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                } catch { /* ignore parse errors */ }
                return null;
              })()}
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Activity size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">暂无事件记录</p>
          <p className="text-sm text-gray-400 mt-2">树莓派检测到声音事件后将自动上传到这里</p>
        </div>
      )}
    </div>
  );
}
