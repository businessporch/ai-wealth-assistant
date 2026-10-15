# AI财富助手：官方资讯升级

本版本在现有 index.html 上修改，保留深蓝色、五个导航栏目和本机自选存储键。没有客户数据、付费 API、云端模型或自建服务器。

## 已完成

- 首页读取 data/news.json；来源为美联储、欧洲央行官方 RSS，仅保留原始标题、发布时间、原文链接。
- 每条区分事实和分析；分析尚未生成。源机构的意见仍是该机构的意见，标题不等于事实已被独立核验。
- 显示北京时间、抓取时间、来源失败状态；超过六小时显示过期。页面“刷新”只读取最近静态文件，不会立即运行抓取。
- 单个来源失败时保留该来源旧数据；全部失败时任务失败，不发布以免覆盖线上可用版本。
- data/interfaces.json 预留 A股行情、588170/516630/159566、AI分析数据结构，全部明确未接入。
- 不覆盖已有自选记录；旧用户需要自行添加516630。基金名称和关联方向需在接入时核验。
- 删除原网页对不存在 manifest、icon、sw 文件的引用；没有新增离线缓存。

## 发布到现有仓库

需要 businessporch/ai-wealth-assistant 的写入连接。当前文件尚未发布。

1. 保持目录结构，将 index.html、news.js、data、scripts、.github/workflows/news.yml 提交到 main。
2. 仓库 Settings → Pages → Source 选择 GitHub Actions（原先为分支发布）。
3. 在 Actions 中运行 Update official news and publish Pages，确认成功。
4. 打开原网址，确认首页为“1.1 · 官方资讯”，显示新抓取时间。
5. iPhone Safari 刷新原网址，然后从已有桌面图标打开；无需重新添加。

## 更新与费用

每两小时的第17分钟运行，计划不保证准点；公共仓库长期无活动可能停用定时任务，应检查 Actions 状态。官方来源没有新发布时，新闻日期不会变化。首期只覆盖美国、欧元区官方信息，不是完整全球媒体资讯。

现行 GitHub 文档说明公开仓库的标准 GitHub-hosted runners 免费。本流程只使用 ubuntu-latest，不使用大规格付费运行环境、付费 API、自建服务器或第三方代理。不自动调用 AI：Plus 不等于 API 费用已包含。

维护：源地址在 scripts/update_news.py 的 FEEDS 中。使用 Python 标准库，无需安装依赖。RSS接口失效时替换来源并重新验证来源权限和格式。升级 Actions 主版本时应复核官方文档。

## 验证边界

本地抓取两个来源成功，共35条；脚本语法检查通过；手机390px宽度页面显示35条、五个导航且无横向溢出。真实 iPhone Safari、线上定时任务与 GitHub Pages 部署仍需发布后验证。

## 官方依据

- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- https://www.federalreserve.gov/feeds/feeds.htm
- https://www.ecb.europa.eu/home/html/rss.en.html
