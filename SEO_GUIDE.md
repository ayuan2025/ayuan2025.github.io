# SEO 优化指南

本文档将指导你如何将你的网站提交给主流搜索引擎（Google 和百度），以提高网站的可见性。

## 1. 获取你的站点地图 (Sitemap)

Jekyll 会自动为你生成一个站点地图文件 `sitemap.xml`。根据你的网站配置，这个文件通常位于 `https://ayuan2025.github.io/sitemap.xml`。

你可以在浏览器中访问该地址，确认文件是否存在且内容正确。

## 2. 提交到 Google Search Console

1.  **登录 Google Search Console**:
    *   访问 [Google Search Console](https://search.google.com/search-console) 并用你的 Google 账户登录。

2.  **添加你的网站**:
    *   在左上角的属性选择器中，点击“添加资源”。
    *   选择“网域”或“网址前缀”类型。对于 GitHub Pages，推荐使用“网址前缀”。
    *   输入你的完整网站 URL：`https://ayuan2025.github.io`。
    *   点击“继续”。

3.  **验证网站所有权**:
    *   Google 会提供多种验证方法。最简单的方法是使用 **HTML 标记**。
    *   复制提供给你的 `meta` 标记，它看起来像这样：
        ```html
        <meta name="google-site-verification" content="YOUR_UNIQUE_CODE" />
        ```
    *   将 `YOUR_UNIQUE_CODE` 这部分字符串，填入你的 `_config.yml` 文件中的 `google_site_verification` 字段。
        ```yaml
        # _config.yml
        google_site_verification: YOUR_UNIQUE_CODE
        ```
    *   保存文件，并将你的网站重新部署到 GitHub Pages。
    *   部署完成后，回到 Google Search Console，点击“验证”。

4.  **提交站点地图**:
    *   验证成功后，在左侧菜单中选择“站点地图”。
    *   在“添加新的站点地图”下，输入 `sitemap.xml`。
    *   点击“提交”。

Google 会在几天内抓取你的站点地图并开始索引你的网站内容。

## 3. 提交到百度资源平台

1.  **登录百度搜索资源平台**:
    *   访问 [百度搜索资源平台](https://ziyuan.baidu.com/) 并用你的百度账户登录。

2.  **添加你的网站**:
    *   在“用户中心” -> “站点管理”中，点击“添加网站”。
    *   输入你的网站 URL `https://ayuan2025.github.io`。

3.  **验证网站所有权**:
    *   百度同样提供多种验证方式。推荐使用 **HTML 标签验证**。
    *   复制 `meta` 标记中的 `content` 部分，它看起来像这样：
        ```html
        <meta name="baidu-site-verification" content="YOUR_UNIQUE_CODE" />
        ```
    *   将 `YOUR_UNIQUE_CODE` 这部分字符串，填入你的 `_config.yml` 文件中的 `baidu_site_verification` 字段。
        ```yaml
        # _config.yml
        baidu_site_verification: YOUR_UNIQUE_CODE
        ```
    *   保存文件，并将你的网站重新部署到 GitHub Pages。
    *   部署完成后，回到百度资源平台，点击“完成验证”。

4.  **提交站点地图**:
    *   在“普通收录”或“链接提交”部分，找到“自动提交” -> “sitemap”。
    *   输入你的站点地图地址：`https://ayuan2025.github.io/sitemap.xml`。
    *   点击“提交”。

## 总结

完成以上步骤后，你的网站就已经成功提交给了 Google 和百度。搜索引擎会定期访问你的站点地图，发现并收录你网站上的新内容。请注意，索引过程可能需要一些时间。
