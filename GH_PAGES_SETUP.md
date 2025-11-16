# 如何正确设置 GitHub Pages 部署源

为了让我们的分类归档页面（由 `jekyll-archives` 插件生成）能够正常访问，您必须手动将 GitHub Pages 的部署源设置为 `gh-pages` 分支。

这是因为 `jekyll-archives` 插件不被 GitHub Pages 官方支持，我们必须通过 GitHub Actions 工作流先将网站完整构建好（包括生成分类页面），然后将构建好的静态文件（位于 `_site` 目录）推送到一个专门用于部署的分支（我们配置的是 `gh-pages`），最后让 GitHub Pages 直接展示这个分支的内容。

请按照以下步骤操作：

---

### 第一步：进入您的 GitHub 仓库设置

1.  在您的 GitHub 仓库页面 (`https://github.com/ayuan2025/ayuan2025.github.io`)，点击右上角的 **Settings** 标签。

    ![Step 1](https://i.imgur.com/A5B8A2x.png)
    *(文字描述图片：GitHub 仓库页面，右上角的 "Settings" 标签被红色方框圈出)*

---

### 第二步：导航到 Pages 设置

1.  在左侧的菜单中，找到并点击 **Pages** 选项。

    ![Step 2](https://i.imgur.com/sTJa3gG.png)
    *(文字描述图片：仓库设置页面的左侧菜单，"Pages" 选项被红色方框圈出)*

---

### 第三步：更改部署源 (Build and deployment)

1.  在 "Build and deployment" 设置下，找到 "Source" 选项。
2.  确保您选择的是 **Deploy from a branch**。
3.  在 "Branch" 设置下，将分支从 `master` (或者 `main`) **更改为 `gh-pages`**。
4.  文件夹选项保持默认的 `/(root)` 即可。
5.  点击 **Save** 按钮。

    ![Step 3](https://i.imgur.com/L8hQ8gE.png)
    *(文字描述图片：GitHub Pages 设置页面，"Branch" 下拉菜单被打开，`gh-pages` 选项被红色方框圈出，旁边的 "Save" 按钮也被圈出)*

---

### 第四步：确认更改

保存后，页面会刷新。请再次确认 "Build and deployment" 部分现在显示的是您的网站正从 `gh-pages` 分支部署。

![Step 4](https://i.imgur.com/9g9g9gH.png)
*(文字描述图片：GitHub Pages 设置页面，显示 "Your site is being deployed from the gh-pages branch")*

完成以上步骤后，GitHub Pages 将会直接使用我们工作流推送到 `gh-pages` 分支的、已经构建好的静态文件。由于这些文件是在我们的环境中完整构建的，所以所有由 `jekyll-archives` 生成的分类页面都会包含在内，404 问题应该就能得到解决。

**请您务必完成此项设置。** 这是解决 404 问题的最关键一步。
