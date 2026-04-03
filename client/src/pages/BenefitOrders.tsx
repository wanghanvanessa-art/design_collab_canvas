import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays, Download, Filter, RefreshCcw, Search } from "lucide-react";

type OrderStatus = "待发货" | "已发货" | "已完成" | "已退款";

type BenefitOrder = {
  id: string;
  benefitName: string;
  customer: string;
  amount: number;
  channel: string;
  status: OrderStatus;
  createdAt: string;
};

const ORDERS: BenefitOrder[] = [
  { id: "EQ20260402001", benefitName: "京豆 50 豆礼包", customer: "王晨", amount: 99, channel: "APP 活动", status: "待发货", createdAt: "2026-04-02 10:16" },
  { id: "EQ20260402002", benefitName: "PLUS 月卡 7 天", customer: "刘琪", amount: 29, channel: "H5 拉新", status: "已发货", createdAt: "2026-04-02 09:42" },
  { id: "EQ20260401057", benefitName: "话费券 10 元", customer: "张宁", amount: 10, channel: "任务中心", status: "已完成", createdAt: "2026-04-01 18:22" },
  { id: "EQ20260401038", benefitName: "小金库加息券", customer: "陈蕾", amount: 0, channel: "权益频道", status: "已退款", createdAt: "2026-04-01 15:09" },
  { id: "EQ20260331088", benefitName: "白条免息券", customer: "周远", amount: 0, channel: "APP 活动", status: "已完成", createdAt: "2026-03-31 20:11" },
];

const statusBadgeVariant: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  待发货: "secondary",
  已发货: "default",
  已完成: "outline",
  已退款: "destructive",
};

export default function BenefitOrders() {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [channel, setChannel] = useState<string>("all");

  const channels = useMemo(
    () => ["all", ...Array.from(new Set(ORDERS.map(order => order.channel)))],
    []
  );

  const filtered = useMemo(() => {
    return ORDERS.filter(order => {
      const keywordMatch =
        !keyword ||
        order.id.toLowerCase().includes(keyword.toLowerCase()) ||
        order.benefitName.includes(keyword) ||
        order.customer.includes(keyword);
      const statusMatch = status === "all" || order.status === status;
      const channelMatch = channel === "all" || order.channel === channel;
      return keywordMatch && statusMatch && channelMatch;
    });
  }, [keyword, status, channel]);

  const totalAmount = filtered.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">权益订单管理系统</h1>
          <p className="text-sm text-muted-foreground mt-1">
            统一管理权益订单，支持筛选、追踪状态与批量处理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            导出订单
          </Button>
          <Button className="gap-2">新建权益订单</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">订单总量</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">订单金额（元）</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalAmount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">更新时间</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              2026-04-02 11:00
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索订单号 / 权益名称 / 用户"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="订单状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="待发货">待发货</SelectItem>
                <SelectItem value="已发货">已发货</SelectItem>
                <SelectItem value="已完成">已完成</SelectItem>
                <SelectItem value="已退款">已退款</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue placeholder="来源渠道" />
              </SelectTrigger>
              <SelectContent>
                {channels.map(item => (
                  <SelectItem key={item} value={item}>
                    {item === "all" ? "全部渠道" : item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => {
              setKeyword("");
              setStatus("all");
              setChannel("all");
            }}>
              <RefreshCcw className="h-4 w-4" />
              重置
            </Button>
            <Button className="gap-2">
              <Filter className="h-4 w-4" />
              应用筛选
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>权益名称</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>渠道</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.benefitName}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{order.channel}</TableCell>
                  <TableCell className="text-right">{order.amount}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[order.status]}>{order.status}</Badge>
                  </TableCell>
                  <TableCell>{order.createdAt}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" className="h-auto p-0 mr-3">详情</Button>
                    <Button variant="link" className="h-auto p-0">处理</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
