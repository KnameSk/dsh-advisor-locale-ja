<div align="center">

# dsh-advisor-locale-ja

[dsh-advisor](https://github.com/KnameSk/dsh-advisor) の **Advisor 設定画面を日本語化する**、独立した DSH プラグイン

</div>

## 概要

DeepSeek Harness（DSH）の **Advisor 設定画面**の文字列だけを日本語にします。

- **設定**・**相談予算**・**履歴**・**接続テスト**のタブと、その中にある項目名・説明・ボタン・エラー・確認メッセージを日本語化します。
- 翻訳がない項目は **英語でそのまま表示**されます（英語へのフォールバック）。
- **Advisor 本体とは独立**してインストール・アンインストールできます。
- **DSH 標準の言語設定に連動**します。DSH の言語が日本語のときだけ日本語で表示され、English や 中文 に戻せば元の表示に戻ります。
- **Advisor 本体の機能には一切影響しません。** このプラグインは翻訳の登録だけを行い、Advisor の設定値・相談処理・モデル呼び出しには触れません。
- 既存の翻訳辞書を壊したり上書きしたりしません。

## 対応環境

- DSH `0.2.1-rc.2`
- `dsh-advisor` `0.2.0` 以降

## インストール

GitHub から直接インストールできます。`<profile>` は実際に使用しているプロファイル名（`web` / `desktop` など）に置き換えてください。

```bash
dsh plugin --profile <profile> add github:KnameSk/dsh-advisor-locale-ja
```

アンインストールする場合は、次のコマンドを実行します。

```bash
dsh plugin --profile <profile> remove dsh-advisor-locale-ja
```

## 使い方

1. DSH の **アカウントメニュー → Settings → General → Language**（**設定 → 一般 → 言語**）を開きます。
2. **日本語** を選びます。
3. **Settings → Advisor** を開くと、Advisor 設定画面が日本語で表示されます。

日本語を選ぶ手段は 2 通りあり、どちらでも動作します。

| 構成 | 日本語の選択肢を提供するもの | このプラグインの役割 |
| --- | --- | --- |
| `dsh-locale-ja` を併用 | [`@fang2hou/dsh-locale-ja`](https://github.com/fang2hou/dsh-locale-ja) | Advisor の辞書だけを追加 |
| このプラグイン単体 | `dsh-advisor-locale-ja` | Advisor の辞書を追加し、**日本語の選択肢も追加** |

`dsh-locale-ja` を併用する場合、このプラグインは **言語の定義を再登録しません**。言語の定義は `dsh-locale-ja` が所有し、このプラグインは Advisor の辞書だけを担当します。これにより、どちらのプラグインを先に読み込んでも衝突しません。

## 翻訳の範囲

| 対象 | 翻訳 |
| --- | --- |
| Advisor 設定画面（`settings.advisor` 名前空間） | する |
| DSH 全体の UI | しない |
| Advisor の設定値・動作 | しない（文字列のみ） |

`Advisor`・`Executor`・`Provider`・`block-tool`・`provider/model`・`/advisor`・`API`・`JSON`・`USD` などの識別子は、原文のまま表示します。

## フォントについて

このプラグインは **フォントを変更しません**。日本語表示用のシステムフォントは、言語パックである `dsh-locale-ja` が担当します。将来的に DSH 側でフォントが改善された場合に、古いフォント指定を上書きし続けないための判断です。

## 開発

```bash
npm run check   # 構文チェック + バンドルの鮮度 + manifest の整合性
npm test        # ロケールサービス契約に対する検証
npm run build   # dsh/client.js を再生成
```

`dsh/client.js` は `scripts/build-client.mjs` が生成する成果物です。**手で編集しないでください。** ソースを変更したら `npm run build` を実行し、生成物もコミットします。`npm run check` はバンドルが古い場合に失敗します。

### 構成

| パス | 役割 |
| --- | --- |
| `dsh/client.js` | DSH が配信するブラウザー用バンドル（生成物） |
| `dsh/client/index.js` | クライアント側の入口。`locale` を inject して翻訳を登録 |
| `dsh/client/japanese.js` | 言語と辞書の登録。衝突を避ける調停処理 |
| `dsh/client/constants.js` | 名前空間と言語 ID |
| `dsh/client/locale/ja.js` | 日本語辞書（169 項目） |
| `dsh/index.js` | ホスト側の入口（Loader 行として登録するだけ） |
| `cordis.patch.yml` | プラグインを有効化するパッチ |

## ライセンス

[MIT](./LICENSE)

## 謝辞

このプラグインは、日本語化プラグイン [`@fang2hou/dsh-locale-ja`](https://github.com/fang2hou/dsh-locale-ja)（MIT、Copyright (c) 2026 fang2hou）が確立した **DSH Locale サービスへの登録方式**（`ctx.locale.addLanguage` と `ctx.locale.register` を `ctx.effect` で所有する構成、ホスト側を空の `apply` にして Loader 行として登録する構成、`dsh.client` で `immediately` と `inject` を宣言する構成）を手本にしています。ライセンス条件に従い、原作者に感謝します。
