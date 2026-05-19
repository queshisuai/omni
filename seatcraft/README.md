# SeatCraft - 专业座位图设计器

SeatCraft 是一个基于 React 的交互式场馆座位图设计与选座系统。支持拖拽式布局编辑、多种模板、弧形/方阵座位排布，适用于演出场馆、电影院、体育场等场景。

## 功能特性

- **双模式切换**：设计模式（编辑布局）与选座模式（用户购票）
- **拖拽编辑**：舞台和座位分区均可自由拖拽定位
- **多种模板**：演出场地、影院模式、空白画布快速起步
- **布局类型**：支持方阵（Grid）和圆弧（Curved）两种座位排列
- **分区类型**：核心区、看台区、普通区三种样式
- **核心优选区**：标记黄金座位区域，差异化展示
- **一键对齐**：自动计算并排列所有分区位置
- **缩放平移**：支持画布缩放与平移浏览
- **实时预览**：所有修改即时渲染

## 技术栈

| 技术 | 用途 |
|------|------|
| React 19 | UI 框架 |
| TypeScript | 类型安全 |
| Vite 6 | 构建工具 |
| Tailwind CSS 4 | 样式系统 |
| Framer Motion (motion) | 动画 |
| react-zoom-pan-pinch | 画布缩放平移 |
| Lucide React | 图标库 |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（可选，仅需 Gemini API 功能时）
cp .env.example .env.local
# 编辑 .env.local 填入 GEMINI_API_KEY

# 3. 启动开发服务器
npm run dev
```

访问 `http://localhost:3000` 即可使用。

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（端口 3000） |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | TypeScript 类型检查 |

## 项目结构

```
seatcraft/
├── src/
│   ├── App.tsx                # 主应用组件
│   ├── main.tsx               # 入口文件
│   ├── index.css              # 全局样式（Tailwind）
│   ├── lib/
│   │   └── utils.ts           # 工具函数（cn）
│   └── components/
│       └── SeatMap/
│           ├── SeatMap.tsx     # 座位图核心渲染组件
│           ├── Controls.tsx    # 右侧控制面板
│           └── types.ts        # 类型定义
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 核心类型

```typescript
// 分区配置
interface SectionData {
  id: string;           // 唯一标识
  name: string;         // 显示名称
  rows: number;         // 排数
  cols: number;         // 列数
  x: number;            // X 坐标
  y: number;            // Y 坐标
  color: string;        // 座位颜色
  type: 'core' | 'stand' | 'zone';
  layout: 'grid' | 'curved';
  radius?: number;      // 圆弧半径（curved 布局）
  arcSpan?: number;     // 圆弧跨度（curved 布局）
  rotation?: number;    // 旋转角度
  primeRange?: {        // 核心优选区范围
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
  };
}

// 座位数据
interface SeatData {
  id: string;
  row: number;
  col: number;
  x?: number;
  y?: number;
  angle?: number;
  status: 'available' | 'reserved' | 'selected' | 'occupied';
  price: number;
  section: string;
  label: string;
}
```

## License

Apache-2.0
