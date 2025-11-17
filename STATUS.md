# 项目状态与计划

这是一个用于追踪网站修改进度和未来计划的文档。

## 今日已完成 (2025年11月17日)

1.  **网站访问统计**:
    *   在 `_config.yml` 中配置了 Google Analytics (gtag.js)。
    *   请将 `_config.yml` 中的 `analytics.google.tracking_id` 替换为您的 Google Analytics 跟踪 ID (例如：`G-XXXXXXXXXX`)。

2.  **文章评论系统**:
    *   在 `_config.yml` 中启用了 Staticman v2 作为评论提供者。
    *   在 `staticman.yml` 中调整了评论数据存储路径。
    *   在 `_config.yml` 中为文章默认开启了评论。
    *   **重要提示**: 您需要部署自己的 Staticman API 实例，并将 `_config.yml` 中的 `staticman.endpoint` 替换为您的 Staticman API 地址。同时，您还需要在 Google reCAPTCHA 注册您的网站，并将 `_config.yml` 中的 `reCaptcha.siteKey` 和 `reCaptcha.secret` 替换为您的 reCAPTCHA 密钥。

3.  **文章分类修正**:
    *   修正了文章 "与书有关的诗" 的分类，将其从 'IT' 更改为 '雕花铁栏杆的阴影'。

## 后续任务 (待办)

1.  图片如何使用，本地图片或者使用图床，哪种更简单，在VS里如何使用图床功能，有没有更简单的方案。

## 开发规范与调试指南

1.  **代理交互语言**:
    *   代理（我）将始终使用中文进行交流。

2.  **本地开发与调试**:
    *   **环境**: 用户主要使用 VS Code (或 Visual Studio) 进行本地编辑和文件上传。
    *   **文件同步**: 如果在 VS Code 中未看到代理所做的文件更改，请尝试刷新 VS Code 的文件资源管理器。
    *   **Git 同步**: 确保本地 Git 仓库与远程仓库同步。如果本地仓库落后于远程，请执行 `git pull` 命令。
    *   **Jekyll 构建**: 任何对 `_config.yml`、`staticman.yml` 或 Markdown 文章的更改，都需要通过 Jekyll 构建才能生效。
        *   **本地预览**: 在项目根目录运行 `bundle install` (首次或依赖更新时) 和 `bundle exec jekyll serve`。然后在浏览器中访问 `http://localhost:4000` 进行本地预览和调试。
        *   **部署验证**: 如果是 GitHub Pages 部署，请检查 GitHub 仓库的 `Actions` 选项卡，确认构建流程成功完成，且没有错误。
    *   **浏览器缓存**: 在查看网站更新时，请尝试硬刷新浏览器 (Ctrl+F5 或 Cmd+Shift+R) 或清除浏览器缓存，以避免旧内容显示。
