# リリース手順

公開したバージョンは**不変**です。公開後に直す場合は、同じタグを付け替えず、必ず新しいバージョンを切ります。

## 手順

1. `CHANGELOG.md` の先頭に、そのバージョンの節を追加する（既存の書式に合わせる）。
2. `package.json` の `version` を同じ番号に上げる。
3. `npm run check && npm test` を通す。
4. 検証してからコミットする。

   ```bash
   git add -A
   git commit -m "chore(release): v0.1.0"
   git push origin main
   git tag -a v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   ```

5. GitHub Release を作る。本文は `CHANGELOG.md` の該当節と揃える（利用者に出荷内容が伝わるようにする）。

   ```bash
   gh release create v0.1.0 --title v0.1.0 --notes-file - <<'EOF'
   （CHANGELOG の該当節）
   EOF
   ```

## タグで固定してインストールする

`main` を指すインストールは、後日の変更で中身が変わります。相手に渡すときや再現させたいときは**タグを指定**してください。

```bash
dsh plugin --profile <profile> add github:KnameSk/dsh-advisor-locale-ja#v0.1.0
```

## タグ公開後の検証（必須）

タグ付きインストールが成立することを、使い捨てのプロファイルで必ず確認します。

```bash
dsh plugin --profile release-check add github:KnameSk/dsh-advisor-locale-ja#v0.1.0
# 確認後に削除する
```

## やらないこと

- 公開済みタグの付け替え・削除・再アップロード。
- 未検証のコミットへのタグ付け。
- バージョン番号を上げずに公開物を差し替えること。
