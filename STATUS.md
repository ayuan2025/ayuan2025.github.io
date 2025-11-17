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
