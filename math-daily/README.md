# Math Daily

GitHub Pages 地址（发布后）：https://yijiemiao.github.io/math-daily/

六个分类：math.DG、math.MG、math.GT、math.AP、math.KT、math.MP。
官方名称为 **Geometric Topology**。数据来自 https://rss.arxiv.org/ 。

## 发布

1. 打开仓库 https://github.com/YijieMiao/YijieMiao.github.io/settings/pages ，在 **Build and deployment → Source** 选择 **GitHub Actions**。已有发布工作流，无需再创建模板。
2. 在项目目录运行下面的命令，只提交数学站点与两个工作流，不会包含现有 `index.md` 的个人主页改动：

   ```sh
   git add math-daily scripts/update_math_daily.py .github/workflows/math-daily.yml .github/workflows/pages.yml
   git diff --cached --stat
   git commit -m "Add mathematics daily archive and automatic updates"
   git push origin main
   ```

3. 打开 https://github.com/YijieMiao/YijieMiao.github.io/actions ，左侧选择 **Update mathematics papers** → **Run workflow** → 分支选 `main` → **Run workflow**。首次推送也会自动触发一次抓取；若已经在运行，等待即可，无需重复启动。
4. 等待 **Update mathematics papers** 和随后 **Deploy GitHub Pages** 都显示绿色勾，再访问 https://yijiemiao.github.io/math-daily/ 。

若抓取时报 `403` / 无法推送，检查 **Settings → Actions → General → Workflow permissions** 和 `main` 分支保护规则，确认允许该工作流提交数据。若部署提示 Pages 未启用，重新检查第 1 步。不要把本地运行成功当成云端部署成功：应以 Actions 运行结果和公开页面为准。

更新任务每天 UTC 04:00（北京时间 12:00）运行一次。GitHub 定时任务可能延迟；公开仓库长期无活动时可能暂停计划任务，可在 Actions 手动恢复。不需要 API key。请允许仓库 Actions 使用写权限；若分支保护禁止机器人推送，需要按仓库策略授权该任务。

`workflow_run` 负责在机器人提交数据后触发发布，因为默认 GITHUB_TOKEN 的 push 不会触发另一个 push 工作流。

## 本地使用

```sh
python3 scripts/update_math_daily.py
python3 -m http.server 8765
```

访问 http://localhost:8765/math-daily/ 。不要直接双击 HTML（浏览器会限制读取 JSON）。

## 数据与范围

- `data/latest.json`：最新非空公告批次。
- `data/archive/YYYY-MM-DD.json`：按 arXiv feed 的 pubDate 归档，持续保留。
- `data/archive.json`：历史目录。
- `data/library.json`：去重历史检索库，使用最新收录元数据，保留各次公告记录。
- `data/status.json`：最近一次完整成功抓取的 UTC 时间与源公告日期；空公告也会记录检查成功。
- 每次先获取并校验全部六个 feed；失败或日期不一致时终止，保留已有数据。
- 新论文、cross-list、replace 都保留，可在网页筛选；按 arXiv ID 在批次内合并。
- 空 feed 不覆盖最新非空批次。RSS 不提供全部过往历史；归档从首次运行开始，任务错过的历史批次不会自动补齐。
- 保存的是元数据和摘要，不镜像 PDF。没有自动翻译或 AI 解读。
- 数学公式使用 CDN MathJax；CDN 不可用时仍可阅读 TeX 原文。

修改分类：同步调整 `scripts/update_math_daily.py` 的 CATEGORIES 和 `math-daily/app.js` 的 names。

首页入口可添加：`[数学论文每日速览](/math-daily/)`。

## 首页诗文

每次打开或刷新页面从八组古典诗文中随机选择一组，显示作者与出处。浏览器允许本地存储时，避免与上一次显示的诗文重复；禁用存储时仍可随机显示。切换学科、搜索和展开摘要不会更换诗文。诗文位于 `app.js` 的 `verses` 数组中，可自行增删。

## 阅读功能

- 默认只显示新论文与新交叉公告，修订可单独筛选；每次先显示 40 篇。
- 批次选择“全部历史”可搜索所有已归档论文；列表采用最新一次收录的元数据与公告类型，展开收录记录可查看历史。历史仅从建站时开始积累。
- 研究主题使用标题与摘要英文关键词匹配，并展示命中的词；不是 AI 分类，可能遗漏或误匹配。
- 收藏、已读、作者关注存于 `localStorage`，不上传服务器。作者按姓名子串匹配，可能有同名情况。选择收藏或关注作者时自动切换到全部历史、全部公告。
- 可导出 JSON 备份并在其他浏览器导入；导入会合并，不覆盖原数据。也可导出收藏 Markdown 清单分享。
- 更新状态显示最近完整成功检查的北京时间；超过 48 小时会提示检查工作流，不直接推断 arXiv 是否故障。定时仍为每日北京时间 12:00。

验证：`python3 -m unittest discover -s tests -p test_math_daily.py`。
