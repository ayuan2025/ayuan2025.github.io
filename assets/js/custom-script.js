document.addEventListener("DOMContentLoaded", function() {
    // 查找所有的代码块
    const codeBlocks = document.querySelectorAll("div.highlighter-rouge, pre.highlight");

    codeBlocks.forEach(function(codeBlock) {
        // 创建复制按钮
        const copyButton = document.createElement("button");
        copyButton.className = "btn btn--primary btn--small";
        copyButton.innerText = "复制";

        // 创建一个容器来包裹按钮
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "code-copy-button-container";
        buttonContainer.appendChild(copyButton);

        // 将按钮容器添加到代码块之前
        codeBlock.parentNode.insertBefore(buttonContainer, codeBlock);

        // 添加点击事件
        copyButton.addEventListener("click", function() {
            const code = codeBlock.querySelector("code").innerText;
            navigator.clipboard.writeText(code).then(function() {
                // 复制成功
                copyButton.innerText = "已复制!";
                setTimeout(function() {
                    copyButton.innerText = "复制";
                }, 2000);
            }, function() {
                // 复制失败
                copyButton.innerText = "失败";
            });
        });
    });

    // 添加一些基本样式
    const style = document.createElement('style');
    style.innerHTML = `
        .code-copy-button-container {
            position: relative;
            margin-bottom: -2.5em;
            float: right;
            z-index: 1;
        }
    `;
    document.head.appendChild(style);
});
