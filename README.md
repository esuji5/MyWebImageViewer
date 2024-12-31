# Manga Viewer | マンガビューワー

A comprehensive manga/comic viewing application with Chrome extension and Flask backend integration, providing a seamless reading experience for both vertical manga-style and standard comic formats.

Chrome 拡張機能と Flask バックエンドを組み合わせた、快適な漫画閲覧体験を提供するビューワーです。

## Features | 機能 aa

- 📱 Responsive design for both desktop and mobile
- 📖 Dual-page spread viewing mode (optimal for desktop)
- 🔄 Configurable reading direction (right-to-left/left-to-right)
- ⌨️ Comprehensive keyboard shortcuts
- 📱 Touch gesture support
- ⚡ Quick launch with Alt+M
- 🖼️ Automatic aspect ratio detection
- 🎯 Optimized image loading and rendering

## Controls | 操作方法

### Keyboard Controls | キーボード操作

- `←` or `A`: Previous page | 前のページ
- `→` or `D`: Next page | 次のページ
- `↑` or `W`: Advance one page (even in dual-page mode) | 1 ページ進む（見開きモード時も 1 ページ単位）
- `↓` or `S`: Toggle dual-page mode (desktop only) | 見開きモード切替（PC 閲覧時のみ）
- `ESC`: Close viewer | ビューワーを閉じる
- `Alt+V`: Open viewer | ビューワーを開く

### Touch Controls | タッチ操作

- Swipe left: Next page | 次のページ
- Swipe right: Previous page | 前のページ

## Installation | インストール方法

### Prerequisites | 前提条件

- Python 3.x
- Google Chrome browser
- Node.js (for development)

### Chrome Extension Setup | Chrome 拡張機能のインストール

1. Clone this repository | このリポジトリをクローン

```bash
git clone [repository-url]
cd manga-viewer
```

2. Load the extension in Chrome | Chrome 拡張機能として読み込む

- Open `chrome://extensions`
- Enable "Developer mode" | 「デベロッパーモード」をオン
- Click "Load unpacked" | 「パッケージ化されていない拡張機能を読み込む」をクリック
- Select the `extension` folder | `extension` フォルダを選択

### Backend Setup | バックエンドの設定

```bash
# Install required packages | 必要なパッケージのインストール
pip install flask pillow flask-cors

# Start the server | サーバーの起動
python main.py
```

The server will start at `http://localhost:5000` | サーバーは `http://localhost:5000` で起動します。

## Usage | 使用方法

1. Click the Chrome extension icon | Chrome 拡張機能のアイコンをクリック
2. Configure viewing options | 設定パネルで以下のオプションを選択：
   - Reading direction (right-to-left for manga) | 右開きモード（漫画向け）
   - Dual-page display (recommended for desktop) | 見開き表示（PC での閲覧時推奨）
3. Click "Open Viewer" or press `Alt+M` | 「ビューワーを開く」をクリック、または `Alt+M` を押下

### Display Modes | 表示モードについて

- **Dual-page Mode** | **見開きモード**:
  Displays two pages simultaneously, optimal for desktop viewing.
  PC 画面で閲覧する際に最適な表示モード。2 ページ同時に表示されます。

- **Right-to-left Mode** | **右開きモード**:
  Traditional manga reading direction, pages flow right to left.
  日本の漫画向けの表示モード。ページめくりの方向が逆になります。

## Development | 開発環境

### Setup | セットアップ

```bash
# Install frontend dependencies | フロントエンド依存関係のインストール
npm install

# Install backend dependencies | バックエンド依存関係のインストール
pip install -r requirements.txt

# Start development server | 開発用サーバーの起動
python main.py
```

### Generate Sample Images | サンプル画像の生成

```bash
python generate_manga_images.py
```

## Technical Stack | 技術仕様

### Frontend

- React.js for the viewer interface
- TypeScript for type safety
- Vite for development and building
- Chrome Extension APIs

### Backend

- Flask (Python)
- Pillow for image processing
- Flask-CORS for cross-origin support

### Features

- Responsive design using CSS Grid and Flexbox
- Dynamic image loading and caching
- Touch event handling
- Keyboard shortcut management
- Automatic aspect ratio detection

## Contributing | コントリビューション

Contributions are welcome! Please feel free to submit a Pull Request.
プルリクエストを歓迎します！

## License | ライセンス

This project is licensed under the MIT License - see the LICENSE file for details.
このプロジェクトは MIT ライセンスの下で公開されています。詳細は LICENSE ファイルをご覧ください。
