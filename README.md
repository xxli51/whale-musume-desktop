# Whale Musume Desktop

鲸鱼娘 Windows 桌面宠物。独立运行，不需要安装 DeepSeek Harness。

## 功能

- 透明置顶桌面宠物，仅显示系统托盘入口
- 多显示器、不同排列与分辨率下跨屏拖动
- 设置面板可拖动并记忆位置
- 投喂、戳一下、夸夸、分区摸头互动
- 两种小游戏、成长、签到、每日任务、称号和成就
- 89 个动作资源及动作预览
- 天气感知：保留雨、雪、风粒子及天气动作，不绘制屏幕颜色蒙版
- 托盘显示/隐藏、恢复位置、打开设置、开机启动和退出

## 环境

- Windows 10/11 x64
- Node.js 20 或更高版本
- npm

## 本地运行

```powershell
git clone https://github.com/xxli51/whale-musume-desktop.git
cd whale-musume-desktop
npm install
npm start
```

## 测试

```powershell
npm test
```

检查当前多显示器虚拟桌面范围：

```powershell
npm run qa:display
```

## 打包 Windows EXE

免安装便携版：

```powershell
npm run build:portable
```

安装版：

```powershell
npm run build
```

产物位于 `dist/`。项目未附带商业代码签名证书，下载后的 EXE 可能触发 Windows SmartScreen 提示。

## 使用

- 拖动鲸鱼娘：按住角色移动，可跨显示器。
- 打开完整设置：右键鲸鱼娘，或右键托盘图标选择“设置与动作”。
- 移动设置面板：拖动顶部蓝色标题栏。
- 完全退出：右键托盘图标选择“退出”。

## 项目结构

```text
assets/       角色图片、动画表现层与状态机
build/        Windows 应用图标
renderer/     桌面窗口界面与完整设置面板
tools/        显示器范围诊断工具
test/         独立仓库完整性测试
main.cjs      Electron 主进程与托盘、多屏逻辑
preload.cjs   安全的渲染进程桥接层
```

## 致谢与许可

桌面版基于 [Sutera-Diffusus/dsh-whale-musume](https://github.com/Sutera-Diffusus/dsh-whale-musume) 的角色资源、状态机与交互代码改造。

本仓库使用 MIT License。上游版权及许可声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
