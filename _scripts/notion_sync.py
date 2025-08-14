name: Sync and Deploy
  on:
    push:
    workflow_dispatch: # 手动触发
    schedule:
      - cron: '0 */12 * * *' # 每 12 小时运行一次，可调整
  jobs:
    sync-and-deploy:
      runs-on: ubuntu-latest
      steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      - name: Install Python dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      - name: Sync from Notion
        run: python _scripts/notion_sync.py
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.0'
      - name: Install Ruby dependencies
        run: |
          gem install bundler
          bundle install
      - name: Build Jekyll site
        run: jekyll build --trace
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./_site
          publish_branch: gh-pages
