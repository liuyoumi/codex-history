# codex-history

[English](README.md) | [简体中文](README.zh-CN.md)

一个用来查找并删除本地 Codex 对话历史的小型命令行工具。

`codex-history` 只处理你机器上的本地 Codex 数据。它会尽量使用 Codex 对话列表里显示的短标题，支持用 `--grep` 缩小范围，并且只会在你确认目标后删除一条明确解析出来的对话。

## 安装

```bash
npm install -g @asjk/codex-history
```

也可以不安装直接运行：

```bash
npx @asjk/codex-history doctor
```

## 快速开始

```bash
codex-history doctor
codex-history list
codex-history list --grep "Astro"
codex-history purge 019e6885
```

`purge` 会先展示解析到的对话信息，并要求你输入标准短 id，确认后才会删除：

```text
About to purge this local Codex conversation:

019e6885  实施 Astro 博客视觉审计工具
id: 019e6885-b5ae-7ae0-a50d-ce5f75b0ac08
updated: 2026-05-28T03:16:01.959Z
cwd: /Users/me/Projects/example

A backup will be created before deletion.
Type 019e6885 to confirm:
```

## 命令

### `doctor`

检查当前本地 Codex 数据结构是否被这个版本支持。

```bash
codex-history doctor
```

建议安装后先跑一次；Codex 更新后也可以再跑一次。如果当前数据结构不受支持，删除命令会拒绝执行，而不是猜测应该怎么删。

### `list`

列出本地 Codex 对话。

```bash
codex-history list
codex-history list --grep "Astro"
codex-history list --limit 20
codex-history list --pretty=medium
codex-history list --pretty=full
```

默认是一行一条：

```text
019e6885  实施 Astro 博客视觉审计工具
019e6874  评审 Astro 博客视觉方案
```

`--grep` 会按显示标题、线程 id、cwd 过滤。它不会搜索或输出对话正文。

执行 `purge` 时，可以使用 `list` 里显示的短 id，也可以粘贴完整 thread id。

默认情况下，`list` 只显示未归档对话。使用 `--archived` 只看已归档对话，使用 `--all` 同时查看已归档和未归档对话。

如果 grep 关键词里有空格，请加引号：

```bash
codex-history list --grep "Astro 博客"
```

`--pretty` 支持：

- `oneline`：短 id 和标题
- `medium`：完整 id、更新时间、cwd
- `full`：在 `medium` 基础上增加创建时间、归档状态、rollout 路径

在交互式终端里，如果 `list` 没有加 `--limit`，输出会进入系统分页器。管道或重定向输出会自动跳过分页器。

### `purge`

通过完整 id 或唯一短 id 前缀删除一条本地 Codex 对话。

```bash
codex-history purge 019e6885
```

脚本或非交互环境可以使用 `--force`：

```bash
codex-history purge 019e6885 --force
```

`--force` 只跳过交互式短 id 确认，不会跳过数据结构校验、强制备份、active thread 保护和删除后的验证。

## 选项

```bash
codex-history --codex-home /path/to/.codex list
codex-history --json list --grep "Astro"
codex-history --json purge 019e6885 --force
```

- `--codex-home` 默认是 `~/.codex`。
- `--json` 输出机器可读的 JSON。`purge` 使用 JSON 输出时必须加 `--force`，因为交互确认只适合文本模式。

## 安全机制

删除前，`codex-history` 会：

- 校验当前 Codex 本地数据结构是否受支持
- 将目标解析到唯一一条对话
- 在可检测时拒绝删除当前 active thread
- 在 `~/.codex-history/backups` 下创建强制备份
- 从受支持的本地 Codex 数据中移除已知引用
- 删除后扫描受支持的数据存储，确认目标引用已经移除

这个工具只处理本地 Codex 数据。它不会删除 OpenAI/Codex 服务端记录、系统备份、终端滚动历史、崩溃报告，或你手动保存过的对话副本。

## 开发

```bash
npm install
npm run typecheck
npm test
npm run build
```

## 许可证

MIT
